import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { extractArchitectureAssets } from './extract-architecture-assets.mjs';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aJ1sAAAAASUVORK5CYII=', 'base64');
const embedded = { dataURL: `data:image/png;base64,${png.toString('base64')}` };

async function fixture(t, documents) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'architecture-assets-test-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const sources = [];
  for (const [index, document] of documents.entries()) {
    const file = path.join(directory, `board-${index}.excalidraw`);
    await fs.writeFile(file, JSON.stringify(document));
    sources.push({ file, label: `board-${index}`, prefix: `board-${index}` });
  }
  const outputRoot = path.join(directory, 'output');
  return { sources, outputRoot, outputDir: path.join(outputRoot, 'public/assets/model-architecture') };
}

test('preserves live images, deduplicates file references, and skips deleted history', async (t) => {
  const { sources, outputRoot } = await fixture(t, [{
    elements: [
      { type: 'image', fileId: 'b', x: 20, y: 10 },
      { type: 'image', fileId: 'a', x: 10, y: 10, width: 1, height: 1 },
      { type: 'image', fileId: 'a', x: 30, y: 20 },
      { type: 'image', fileId: 'absent', isDeleted: true },
    ],
    files: { b: embedded, a: embedded },
  }]);
  const originalSource = await fs.readFile(sources[0].file, 'utf8');
  const manifest = await extractArchitectureAssets(sources, outputRoot);
  assert.deepEqual(manifest.map(({ fileId }) => fileId), ['a', 'b']);
  assert.deepEqual(manifest.map(({ output }) => output), [
    'public/assets/model-architecture/board-0-01.png',
    'public/assets/model-architecture/board-0-02.png',
  ]);
  for (const { output } of manifest) assert.deepEqual(await fs.readFile(path.join(outputRoot, output)), png);
  assert.equal(await fs.readFile(sources[0].file, 'utf8'), originalSource);
  assert.deepEqual(await extractArchitectureAssets(sources, outputRoot), manifest);
});

test('a live image with a missing file record fails before any output is created', async (t) => {
  const { sources, outputRoot } = await fixture(t, [{
    elements: [{ type: 'image', fileId: 'missing-image' }], files: {},
  }]);
  await assert.rejects(extractArchitectureAssets(sources, outputRoot), (error) => {
    assert.match(error.message, /Missing or invalid embedded dataURL for missing-image/);
    assert.ok(error.message.includes(sources[0].file));
    return true;
  });
  await assert.rejects(fs.access(outputRoot), { code: 'ENOENT' });
});

test('invalid data in a later board leaves existing assets and manifest untouched', async (t) => {
  const { sources, outputRoot, outputDir } = await fixture(t, [
    { elements: [{ type: 'image', fileId: 'valid' }], files: { valid: embedded } },
    { elements: [{ type: 'image', fileId: 'no-data' }], files: { 'no-data': {} } },
  ]);
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(path.join(outputDir, 'manifest.json'), 'existing manifest');
  await fs.writeFile(path.join(outputDir, 'board-0-01.png'), 'existing asset');
  await assert.rejects(extractArchitectureAssets(sources, outputRoot), /no-data/);
  assert.equal(await fs.readFile(path.join(outputDir, 'manifest.json'), 'utf8'), 'existing manifest');
  assert.equal(await fs.readFile(path.join(outputDir, 'board-0-01.png'), 'utf8'), 'existing asset');
  assert.deepEqual((await fs.readdir(outputDir)).sort(), ['board-0-01.png', 'manifest.json']);
});

test('a live image without fileId reports its element and source', async (t) => {
  const { sources, outputRoot } = await fixture(t, [{
    elements: [{ type: 'image', id: 'unnamed-file' }], files: {},
  }]);
  await assert.rejects(extractArchitectureAssets(sources, outputRoot), (error) => {
    assert.match(error.message, /Image element unnamed-file has no fileId/);
    assert.ok(error.message.includes(sources[0].file));
    return true;
  });
  await assert.rejects(fs.access(outputRoot), { code: 'ENOENT' });
});
