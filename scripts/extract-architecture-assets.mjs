import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(root, 'public/assets/model-architecture');
const sources = [
  {
    file: '/Users/yiheng/Downloads/新架构解读讲解.excalidraw',
    label: 'new-architecture',
    prefix: 'source-new-architecture',
  },
  {
    file: '/Users/yiheng/Downloads/视频画板.excalidraw',
    label: 'video-board',
    prefix: 'source-video-board',
  },
];

function compare(a, b) {
  return a.sourceIndex - b.sourceIndex || a.y - b.y || a.x - b.x || a.fileId.localeCompare(b.fileId);
}

function decodeDataUrl(dataUrl, sourceFile, fileId) {
  const match = /^data:([^;,]+);base64,(.+)$/s.exec(dataUrl || '');
  if (!match) throw new Error(`Missing or invalid embedded dataURL for ${fileId} in ${sourceFile}`);
  return Buffer.from(match[2], 'base64');
}

await fs.mkdir(outputDir, { recursive: true });
const manifest = [];

for (let sourceIndex = 0; sourceIndex < sources.length; sourceIndex += 1) {
  const source = sources[sourceIndex];
  const document = JSON.parse(await fs.readFile(source.file, 'utf8'));
  const positions = new Map();
  for (const element of document.elements ?? []) {
    if (element.type !== 'image' || !element.fileId) continue;
    const position = { sourceIndex, sourceFile: source.file, fileId: element.fileId, x: element.x ?? 0, y: element.y ?? 0, width: element.width ?? 0, height: element.height ?? 0 };
    const existing = positions.get(element.fileId);
    if (!existing || position.y < existing.y || (position.y === existing.y && position.x < existing.x)) positions.set(element.fileId, position);
  }
  const assets = Object.keys(document.files ?? []).map((fileId) => {
    const position = positions.get(fileId);
    if (!position) return { sourceIndex, sourceFile: source.file, fileId, x: 0, y: 0, width: 0, height: 0 };
    return position;
  }).sort(compare);
  for (const asset of assets) {
    const file = document.files?.[asset.fileId];
    const bytes = decodeDataUrl(file?.dataURL, source.file, asset.fileId);
    const number = String(manifest.filter(item => item.sourceLabel === source.label).length + 1).padStart(2, '0');
    const output = `public/assets/model-architecture/${source.prefix}-${number}.png`;
    await fs.writeFile(path.join(root, output), bytes);
    manifest.push({
      sourceFile: source.file,
      fileId: asset.fileId,
      sourceLabel: source.label,
      x: asset.x,
      y: asset.y,
      width: asset.width,
      height: asset.height,
      output,
    });
  }
  console.log(`${source.file}: ${assets.length} assets`);
}

await fs.writeFile(path.join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote ${manifest.length} assets to ${path.relative(root, outputDir)}/manifest.json`);
