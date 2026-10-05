import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contentPath = path.join(root, 'content', 'model-architecture.html');
const publicRoot = path.join(root, 'public');
const allowedLabels = ['官方资料', '用户画板', '第三方说明', '待核实'];
const requiredSections = [
  'architecture-transformer',
  'architecture-components',
  'architecture-models',
  'architecture-training',
  'architecture-agent'
];

const errors = [];
const html = fs.readFileSync(contentPath, 'utf8');

function fail(message) {
  errors.push(message);
}

function headingFor(block, fallback) {
  const heading = block.match(/<h[1-6][^>]*>\s*([^<]+?)\s*<\/h[1-6]>/i);
  return heading ? heading[1].replace(/\s+/g, ' ') : fallback;
}

function articleBlocks(className) {
  const pattern = new RegExp(`<article\\b[^>]*class=["'][^"']*\\b${className}\\b[^"']*["'][^>]*>[\\s\\S]*?<\\/article>`, 'gi');
  return [...html.matchAll(pattern)].map((match) => match[0]);
}

for (const id of requiredSections) {
  const section = html.match(new RegExp(`<section\\b[^>]*\\bid=["']${id}["'][^>]*>[\\s\\S]*?<\\/section>`, 'i'));
  if (!section) {
    fail(`Missing required section #${id}`);
    continue;
  }
  if (!/<figure\b/i.test(section[0])) fail(`Section #${id} must contain at least one <figure>`);
}

if (!/id=["']architecture-jev["']/i.test(html)) fail('Missing JEV section #architecture-jev');
if (!/content\/model-architecture-sources\.html/i.test(html)) {
  fail('Missing source marker: expected a reference to content/model-architecture-sources.html');
}

for (const match of html.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)) {
  const assetPath = match[1];
  if (/^(?:[a-z]+:|\/\/)/i.test(assetPath)) {
    fail(`Image path must point into public/: ${assetPath}`);
    continue;
  }
  const resolved = path.resolve(publicRoot, assetPath);
  if (resolved !== publicRoot && !resolved.startsWith(`${publicRoot}${path.sep}`)) {
    fail(`Image path escapes public/: ${assetPath}`);
  } else if (!fs.existsSync(resolved)) {
    fail(`Missing image asset under public/: ${assetPath}`);
  }
}

const modelCards = articleBlocks('architecture-model-card');
if (modelCards.length === 0) fail('No model cards found (.architecture-model-card)');
for (const [index, card] of modelCards.entries()) {
  const title = headingFor(card, `model card ${index + 1}`);
  if (!allowedLabels.some((label) => card.includes(label))) {
    fail(`Model card "${title}" is missing a source label (${allowedLabels.join(' / ')})`);
  }
}

const algorithmCards = articleBlocks('architecture-algorithm-card');
if (algorithmCards.length === 0) fail('No external algorithm source blocks found (.architecture-algorithm-card)');
for (const [index, card] of algorithmCards.entries()) {
  const title = headingFor(card, `algorithm source block ${index + 1}`);
  if (!allowedLabels.some((label) => card.includes(label))) {
    fail(`External algorithm source block "${title}" is missing a source label (${allowedLabels.join(' / ')})`);
  }
}

if (errors.length > 0) {
  console.error('Architecture content validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log('Architecture content validation passed');
}
