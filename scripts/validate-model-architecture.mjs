import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contentPath = path.join(root, 'content', 'model-architecture.html');
const publicRoot = path.join(root, 'public');
const architectureCssPath = path.join(publicRoot, 'model-architecture.css');
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
const architectureCss = fs.readFileSync(architectureCssPath, 'utf8');

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

function hasScopedSourceLabel(block) {
  const sourceNotes = [...block.matchAll(/<div\b[^>]*class=["'][^"']*\barchitecture-source-note\b[^"']*["'][^>]*>[\s\S]*?<\/div>/gi)]
    .map((match) => match[0]);
  return sourceNotes.some((note) => {
    const labels = [...note.matchAll(/<span\b[^>]*class=["'][^"']*\barchitecture-source-label\b[^"']*["'][^>]*>([^<]*)<\/span>/gi)]
      .map((match) => match[1].trim());
    return labels.some((label) => allowedLabels.includes(label));
  });
}

for (const id of requiredSections) {
  const section = html.match(new RegExp(`<section\\b[^>]*\\bid=["']${id}["'][^>]*>[\\s\\S]*?<\\/section>`, 'i'));
  if (!section) {
    fail(`Missing required section #${id}`);
    continue;
  }
  if (!/<figure\b/i.test(section[0])) fail(`Section #${id} must contain at least one <figure>`);
}

if (!/<div\b[^>]*class=["'][^"']*\barchitecture-subsection\b[^"']*["'][^>]*id=["']architecture-jev["'][^>]*>/i.test(html)) {
  fail('Missing JEV subsection with the expected architecture-subsection structure');
}
if (!/<footer\b[^>]*class=["'][^"']*\barchitecture-footer\b/.test(html)) {
  fail('Missing chapter footer');
}
if (!fs.existsSync(path.join(root, 'content/model-architecture-sources.html'))) {
  fail('Missing source ledger');
}

for (const selector of ['.architecture-model-study', '.architecture-viewer', '.architecture-figure-button']) {
  if (!architectureCss.includes(selector)) fail(`Missing reading style: ${selector}`);
}
for (const obsolete of ['architecture-model-card', 'architecture-timeline-svg', '架构演进时间线']) {
  if (html.includes(obsolete)) fail(`Obsolete card/timeline remains: ${obsolete}`);
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

const modelCards = articleBlocks('architecture-model-study');
if (modelCards.length !== 9) fail('Expected nine full model studies');
for (const [index, card] of modelCards.entries()) {
  const title = headingFor(card, `model study ${index + 1}`);
  if (!hasScopedSourceLabel(card)) {
    fail(`Model study "${title}" is missing a source label (${allowedLabels.join(' / ')})`);
  }
}

const models = JSON.parse(fs.readFileSync(path.join(root, 'content/architecture/models.json'), 'utf8'));
const checkpoints = ['v3', 'v32', 'kimi', 'qwen3', 'coder', 'qwen35', 'step', 'minimax', 'glm'];
for (const [index, model] of models.entries()) {
  const config = JSON.parse(fs.readFileSync(path.join(root, `content/architecture/${checkpoints[index]}-config.json`), 'utf8'));
  const textConfig = config.text_config || config;
  const fields = {
    layers: textConfig.num_hidden_layers,
    hidden: textConfig.hidden_size,
    experts: textConfig.n_routed_experts ?? textConfig.num_experts ?? textConfig.num_local_experts ?? textConfig.moe_num_experts,
    top: textConfig.num_experts_per_tok ?? textConfig.moe_top_k
  };
  for (const [field, value] of Object.entries(fields)) {
    if (model[field] !== value) fail(`${model.name}: ${field} differs from checkpoint (${model[field]} / ${value})`);
  }
  const shared = textConfig.n_shared_experts ?? ((textConfig.shared_expert_intermediate_size ?? textConfig.share_expert_dim ?? textConfig.shared_intermediate_size ?? 0) > 0 ? 1 : 0);
  if (model.shared !== shared) fail(`${model.name}: shared experts differ from checkpoint`);
  const block = modelCards[index] || '';
  if (!block.includes(`assets/model-architecture/${model.id}.svg`)) fail(`${model.name}: missing full architecture diagram`);
  if (!block.includes(`source-new-architecture-0${index + 1}.png`)) fail(`${model.name}: original board mapping changed`);
}
for (const match of html.matchAll(/<img\b[^>]*\bsrc=["']([^"']+\.svg)["'][^>]*>/gi)) {
  const file = path.join(publicRoot, match[1]);
  if (!fs.existsSync(file)) continue;
  const svg = fs.readFileSync(file, 'utf8');
  if (!svg.includes('<title') || !svg.includes('viewBox=') || !svg.includes('fill:none')) fail(`Diagram lacks accessibility/scalable drawing styles: ${match[1]}`);
}

if (modelCards.length > 0) {
  const labelRemoved = modelCards[0].replace(
    /(<span\b[^>]*class=["'][^"']*\barchitecture-source-label\b[^"']*["'][^>]*>)(?:官方资料|用户画板|第三方说明|待核实)(<\/span>)/i,
    '$1$2'
  );
  if (hasScopedSourceLabel(labelRemoved)) {
    fail('Regression check failed: removing a model study source label must fail validation');
  }
}

if (errors.length > 0) {
  console.error('Architecture content validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log('Architecture content validation passed');
}
