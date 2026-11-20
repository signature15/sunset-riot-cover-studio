const GUTTER = 16;
const PAPER = '#f2eadf';
const ORANGE = '#ff7445';
const TEAL = '#8ad2c8';
const BLACK = '#080808';

const PANEL_NAMES = ['Hero', 'Street', 'Heat', 'Night', 'Rush', 'Afterglow'];

function panelRects(size) {
  const usable = size - GUTTER * 4;
  const topHeight = Math.round(usable * 0.57);
  const bottomHeight = usable - topHeight;
  const topWidth = Math.round(usable * 0.44);
  const middleWidth = Math.round((usable - topWidth - GUTTER) * 0.5);
  const rightWidth = usable - topWidth - middleWidth - GUTTER * 2;
  const bottomWidth = Math.floor((usable - GUTTER * 2) / 3);
  const bottomLast = usable - bottomWidth * 2 - GUTTER * 2;
  const yTop = GUTTER;
  const yBottom = GUTTER * 2 + topHeight;

  return [
    { x: GUTTER, y: yTop, w: topWidth, h: topHeight },
    { x: GUTTER * 2 + topWidth, y: yTop, w: middleWidth, h: topHeight },
    { x: GUTTER * 3 + topWidth + middleWidth, y: yTop, w: rightWidth, h: topHeight },
    { x: GUTTER, y: yBottom, w: bottomWidth, h: bottomHeight },
    { x: GUTTER * 2 + bottomWidth, y: yBottom, w: bottomWidth, h: bottomHeight },
    { x: GUTTER * 3 + bottomWidth * 2, y: yBottom, w: bottomLast, h: bottomHeight },
  ];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function fitCrop(image, rect, settings) {
  const imageRatio = image.width / image.height;
  const panelRatio = rect.w / rect.h;
  const coverScale = imageRatio > panelRatio ? rect.h / image.height : rect.w / image.width;
  const scale = coverScale * (settings.zoom || 1);
  const drawW = image.width * scale;
  const drawH = image.height * scale;
  const spareX = drawW - rect.w;
  const spareY = drawH - rect.h;
  const panX = clamp(settings.panX || 0, -1, 1);
  const panY = clamp(settings.panY || 0, -1, 1);
  return {
    x: rect.x + (rect.w - drawW) / 2 + spareX * panX * 0.5,
    y: rect.y + (rect.h - drawH) / 2 + spareY * panY * 0.5,
    w: drawW,
    h: drawH,
  };
}

function posterize(value, levels = 5) {
  return Math.round(value / 255 * (levels - 1)) * (255 / (levels - 1));
}

function gradePixels(ctx, width, height, grade) {
  if (grade === 'raw') return;
  const frame = ctx.getImageData(0, 0, width, height);
  const { data } = frame;
  const source = new Uint8ClampedArray(data);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      let r = source[i];
      let g = source[i + 1];
      let b = source[i + 2];
      const luminance = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
      if (grade === 'mono') {
        const value = posterize(luminance * 255, 7);
        r = value * 1.02;
        g = value * 1.01;
        b = value;
      } else if (grade === 'sunset') {
        const value = posterize(luminance * 255, 6) / 255;
        r = 28 + value * 222;
        g = 18 + value * 150;
        b = 24 + value * 100;
      } else {
        const value = posterize(luminance * 255, 5) / 255;
        r = 24 + value * 231;
        g = 30 + value * 184;
        b = 25 + value * 178;
      }
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
    }
  }
  if (grade === 'riot') {
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const i = (y * width + x) * 4;
        const here = source[i] * 0.299 + source[i + 1] * 0.587 + source[i + 2] * 0.114;
        const right = source[i + 4] * 0.299 + source[i + 5] * 0.587 + source[i + 6] * 0.114;
        const belowIndex = ((y + 1) * width + x) * 4;
        const below = source[belowIndex] * 0.299 + source[belowIndex + 1] * 0.587 + source[belowIndex + 2] * 0.114;
        if (Math.abs(here - right) + Math.abs(here - below) > 80) {
          data[i] = 8;
          data[i + 1] = 8;
          data[i + 2] = 7;
        }
      }
    }
  }
  ctx.putImageData(frame, 0, 0);
}

function drawCaption(ctx, size, caption) {
  if (!caption.trim()) return;
  const text = caption.trim().toUpperCase();
  const fontSize = Math.max(26, Math.round(size * 0.058));
  const x = Math.round(size * 0.065);
  const y = size - Math.round(size * 0.062);
  ctx.save();
  ctx.font = `900 ${fontSize}px Arial Black, Impact, sans-serif`;
  ctx.textBaseline = 'bottom';
  ctx.textAlign = 'left';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(3, Math.round(size * 0.008));
  ctx.strokeStyle = BLACK;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = PAPER;
  ctx.fillText(text, x, y);
  ctx.fillStyle = ORANGE;
  ctx.fillRect(x, y + Math.round(size * 0.012), Math.min(size * 0.15, ctx.measureText(text).width), Math.max(4, size * 0.006));
  ctx.restore();
}

function drawPanel(ctx, image, rect, settings, grade, scratch) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  if (image) {
    const crop = fitCrop(image, rect, settings);
    scratch.width = Math.max(1, Math.round(rect.w));
    scratch.height = Math.max(1, Math.round(rect.h));
    const scratchContext = scratch.getContext('2d', { willReadFrequently: true });
    scratchContext.clearRect(0, 0, scratch.width, scratch.height);
    scratchContext.drawImage(image, crop.x - rect.x, crop.y - rect.y, crop.w, crop.h);
    gradePixels(scratchContext, scratch.width, scratch.height, grade);
    ctx.drawImage(scratch, rect.x, rect.y);
  } else {
    ctx.fillStyle = '#22201e';
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.fillStyle = '#615951';
    ctx.font = `${Math.round(rect.w * 0.07)}px sans-serif`;
    ctx.fillText('add photo', rect.x + rect.w * 0.08, rect.y + rect.h * 0.55);
  }
  ctx.restore();
}

export function createCoverRenderer(canvas) {
  const scratch = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
  let lastRects = panelRects(canvas.width);

  function render({ panels, caption, grade, activeIndex = 0 } = {}) {
    const size = canvas.width;
    lastRects = panelRects(size);
    ctx.fillStyle = BLACK;
    ctx.fillRect(0, 0, size, size);
    lastRects.forEach((rect, index) => {
      drawPanel(ctx, panels?.[index]?.image ?? null, rect, panels?.[index] ?? {}, grade ?? 'riot', scratch);
      if (index === activeIndex) {
        ctx.save();
        ctx.strokeStyle = index === 0 ? ORANGE : TEAL;
        ctx.lineWidth = Math.max(4, Math.round(size * 0.006));
        ctx.strokeRect(rect.x + ctx.lineWidth / 2, rect.y + ctx.lineWidth / 2, rect.w - ctx.lineWidth, rect.h - ctx.lineWidth);
        ctx.restore();
      }
    });
    drawCaption(ctx, size, caption ?? '');
  }

  function hitTest(x, y) {
    return lastRects.findIndex((rect) => x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h);
  }

  return { render, hitTest, panelRects: () => lastRects.map((rect) => ({ ...rect })), panelNames: PANEL_NAMES };
}
