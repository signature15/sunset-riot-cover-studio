import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

// The entrypoint only stages files and records them. The browser work lives in app/;
// this side of the handoff stays deliberately small and deterministic.
const projectDir = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outputDir, { recursive: true });

function stageFolder(folderName: 'app' | 'screenshots'): void {
  // Both folders are required deliverables, so cpSync should surface a missing one.
  const sourcePath = join(projectDir, folderName);
  const targetPath = join(outputDir, folderName);
  cpSync(sourcePath, targetPath, { recursive: true, force: true });
}

for (const folderName of ['app', 'screenshots'] as const) stageFolder(folderName);

// Keep the same caps the bounty uses so local runs exercise the real submission shape.
const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
});

writeFileSync(join(outputDir, 'dossier.json'), dossier);
