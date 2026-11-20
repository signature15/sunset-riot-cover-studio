import { createCoverRenderer } from './cover.js';

const canvas = document.querySelector('#coverCanvas');
const renderer = createCoverRenderer(canvas);
const photoInput = document.querySelector('#photoInput');
const captionInput = document.querySelector('#captionInput');
const captionCount = document.querySelector('#captionCount');
const photoStatus = document.querySelector('#photoStatus');
const panelPicker = document.querySelector('#panelPicker');
const panelRail = document.querySelector('#panelRail');
const activePanelLabel = document.querySelector('#activePanelLabel');
const selectionName = document.querySelector('#selectionName');
const zoomRange = document.querySelector('#zoomRange');
const zoomValue = document.querySelector('#zoomValue');
const gradeLabel = document.querySelector('#gradeLabel');
const exportSize = document.querySelector('#exportSize');
const exportButton = document.querySelector('#exportButton');
const exportStatus = document.querySelector('#exportStatus');
const resetCropButton = document.querySelector('#resetCrop');
const toast = document.querySelector('#toast');

const gradeNames = { riot: 'Riot Ink', sunset: 'Sunset', mono: 'Silver', raw: 'Raw' };
const panels = Array.from({ length: 6 }, () => ({ image: null, panX: 0, panY: 0, zoom: 1 }));
const state = { activeIndex: 0, caption: captionInput.value, grade: 'riot', dragging: false, lastPoint: null };
let toastTimer;

function setToast(message) {
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2600);
}

function imageFromUrl(url, label) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ image, label });
    image.onerror = reject;
    image.src = url;
  });
}

function draw() {
  renderer.render({ panels, caption: state.caption, grade: state.grade, activeIndex: state.activeIndex });
  updatePanelIndicators();
}

function updatePanelIndicators() {
  const active = panels[state.activeIndex];
  const name = renderer.panelNames[state.activeIndex];
  const zoom = active?.zoom ?? 1;
  selectionName.textContent = `${name} panel`;
  activePanelLabel.textContent = `${name.toLowerCase()} selected`;
  zoomRange.value = String(zoom);
  zoomValue.textContent = `${zoom.toFixed(2)}×`;
  document.querySelectorAll('.panel-button, .rail-button').forEach((button) => {
    button.classList.toggle('is-active', Number(button.dataset.index) === state.activeIndex);
  });
}

function selectPanel(index) {
  state.activeIndex = Number(index);
  updatePanelIndicators();
  draw();
}

function panelButton(index) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'panel-button';
  button.dataset.index = String(index);
  button.innerHTML = `<strong>${String(index + 1).padStart(2, '0')} ${renderer.panelNames[index]}</strong><span>${index === 0 ? 'hero position' : 'detail frame'}</span>`;
  button.addEventListener('click', () => selectPanel(index));
  return button;
}

function railButton(index) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'rail-button';
  button.dataset.index = String(index);
  button.setAttribute('aria-label', `Select ${renderer.panelNames[index]} panel`);
  const thumb = document.createElement('canvas');
  thumb.width = 240;
  thumb.height = 200;
  thumb.setAttribute('aria-hidden', 'true');
  button.append(thumb);
  const label = document.createElement('span');
  label.className = 'rail-label';
  label.textContent = renderer.panelNames[index];
  button.append(label);
  button.addEventListener('click', () => selectPanel(index));
  return button;
}

function refreshRail() {
  panelRail.replaceChildren();
  for (let i = 0; i < panels.length; i += 1) panelRail.append(railButton(i));
  for (const button of panelRail.querySelectorAll('.rail-button')) {
    const thumb = button.querySelector('canvas');
    const thumbRenderer = createCoverRenderer(thumb);
    thumbRenderer.render({ panels: [panels[Number(button.dataset.index)]], caption: '', grade: state.grade, activeIndex: -1 });
  }
}

function setImage(image, label) {
  panels.forEach((panel) => {
    panel.image = image;
    panel.panX = 0;
    panel.panY = 0;
    panel.zoom = 1;
  });
  photoStatus.textContent = label.length > 18 ? `${label.slice(0, 15)}…` : label;
  document.querySelector('#emptyState').hidden = true;
  refreshRail();
  draw();
}

function canvasPoint(event) {
  const bounds = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - bounds.left) * (canvas.width / bounds.width),
    y: (event.clientY - bounds.top) * (canvas.height / bounds.height),
  };
}

function moveActivePanel(deltaX, deltaY) {
  const panel = panels[state.activeIndex];
  panel.panX = Math.max(-1, Math.min(1, panel.panX + deltaX / 260));
  panel.panY = Math.max(-1, Math.min(1, panel.panY + deltaY / 260));
  draw();
}

photoInput.addEventListener('change', () => {
  const [file] = photoInput.files;
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    imageFromUrl(reader.result, file.name).then(({ image, label }) => {
      setImage(image, label);
      setToast('Photo loaded into all six panels.');
    });
  };
  reader.readAsDataURL(file);
});

captionInput.addEventListener('input', () => {
  state.caption = captionInput.value;
  captionCount.textContent = `${state.caption.length} / 28`;
  draw();
});

zoomRange.addEventListener('input', () => {
  panels[state.activeIndex].zoom = Number(zoomRange.value);
  zoomValue.textContent = `${panels[state.activeIndex].zoom.toFixed(2)}×`;
  draw();
});

document.querySelectorAll('.grade-button').forEach((button) => {
  button.addEventListener('click', () => {
    state.grade = button.dataset.grade;
    gradeLabel.textContent = gradeNames[state.grade];
    document.querySelectorAll('.grade-button').forEach((item) => item.classList.toggle('is-active', item === button));
    refreshRail();
    draw();
  });
});

canvas.addEventListener('pointerdown', (event) => {
  const point = canvasPoint(event);
  const hit = renderer.hitTest(point.x, point.y);
  if (hit < 0) return;
  selectPanel(hit);
  state.dragging = true;
  state.lastPoint = point;
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener('pointermove', (event) => {
  if (!state.dragging || !state.lastPoint) return;
  const point = canvasPoint(event);
  moveActivePanel(point.x - state.lastPoint.x, point.y - state.lastPoint.y);
  state.lastPoint = point;
});

function stopDragging(event) {
  state.dragging = false;
  state.lastPoint = null;
  if (event?.pointerId !== undefined && canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
}

canvas.addEventListener('pointerup', stopDragging);
canvas.addEventListener('pointercancel', stopDragging);
canvas.addEventListener('wheel', (event) => {
  const point = canvasPoint(event);
  const hit = renderer.hitTest(point.x, point.y);
  if (hit < 0) return;
  event.preventDefault();
  selectPanel(hit);
  panels[hit].zoom = Math.max(1, Math.min(2.8, panels[hit].zoom + (event.deltaY > 0 ? -0.06 : 0.06)));
  draw();
}, { passive: false });

resetCropButton.addEventListener('click', () => {
  panels[state.activeIndex].panX = 0;
  panels[state.activeIndex].panY = 0;
  panels[state.activeIndex].zoom = 1;
  draw();
  setToast(`${renderer.panelNames[state.activeIndex]} crop reset.`);
});

function exportCover() {
  const size = Number(exportSize.value);
  const output = document.createElement('canvas');
  output.width = size;
  output.height = size;
  const exportRenderer = createCoverRenderer(output);
  exportRenderer.render({ panels, caption: state.caption, grade: state.grade, activeIndex: -1 });
  output.toBlob((blob) => {
    if (!blob) {
      exportStatus.textContent = 'Export failed. Try again.';
      return;
    }
    const link = document.createElement('a');
    link.download = `sunset-riot-${size}.png`;
    link.href = URL.createObjectURL(blob);
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    exportStatus.textContent = `Saved ${size}px PNG to your downloads.`;
    setToast('Cover exported. Your original photo stayed local.');
  }, 'image/png');
}

exportButton.addEventListener('click', exportCover);

for (let i = 0; i < panels.length; i += 1) panelPicker.append(panelButton(i));
captionCount.textContent = `${state.caption.length} / 28`;
refreshRail();
draw();

imageFromUrl('./samples/pier.jpg', 'pier.jpg').then(({ image, label }) => setImage(image, label)).catch(() => {
  photoStatus.textContent = 'waiting for photo';
  document.querySelector('#emptyState').hidden = false;
});
