import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
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

export async function extractArchitectureAssets(sourceList = sources, outputRoot = root) {
  const stagedSources = [];
  // Validate both boards before touching generated output. Excalidraw keeps
  // deleted elements as history; only live image references require data.
  for (const [sourceIndex, source] of sourceList.entries()) {
    const document = JSON.parse(await fs.readFile(source.file, 'utf8'));
    const positions = new Map();
    let deletedImages = 0;
    for (const element of document.elements ?? []) {
      if (element.type !== 'image') continue;
      if (element.isDeleted === true) {
        deletedImages += 1;
        continue;
      }
      if (!element.fileId) {
        throw new Error(`Image element ${element.id ?? '(unknown)'} has no fileId in ${source.file}`);
      }
      decodeDataUrl(document.files?.[element.fileId]?.dataURL, source.file, element.fileId);
      const position = { sourceIndex, sourceFile: source.file, fileId: element.fileId, x: element.x ?? 0, y: element.y ?? 0, width: element.width ?? 0, height: element.height ?? 0 };
      const existing = positions.get(element.fileId);
      if (!existing || position.y < existing.y || (position.y === existing.y && position.x < existing.x)) positions.set(element.fileId, position);
    }
    const assets = Object.keys(document.files ?? []).map((fileId) => ({
      ...(positions.get(fileId) ?? { sourceIndex, sourceFile: source.file, fileId, x: 0, y: 0, width: 0, height: 0 }),
      bytes: decodeDataUrl(document.files[fileId]?.dataURL, source.file, fileId),
    })).sort(compare);
    stagedSources.push({ source, assets, deletedImages });
  }

  const outputDir = path.join(outputRoot, 'public/assets/model-architecture');
  await fs.mkdir(outputDir, { recursive: true });
  const manifest = [];
  for (const { source, assets, deletedImages } of stagedSources) {
    for (const [index, asset] of assets.entries()) {
      const number = String(index + 1).padStart(2, '0');
      const output = `public/assets/model-architecture/${source.prefix}-${number}.png`;
      await fs.writeFile(path.join(outputRoot, output), asset.bytes);
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
    console.log(`${source.file}: ${assets.length} assets; skipped ${deletedImages} deleted image elements`);
  }

  await fs.writeFile(path.join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Wrote ${manifest.length} assets to ${path.relative(outputRoot, outputDir)}/manifest.json`);
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await extractArchitectureAssets();
}
