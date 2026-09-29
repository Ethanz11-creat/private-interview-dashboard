import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const source = fs.readFileSync(new URL('public/index.html', root), 'utf8');
const output = new URL('docs/业务面与AI-Coding-SOP-工具实践.md', root);
const assets = [];

function pandoc(input, from, to) {
  return execFileSync('pandoc', ['-f', from, '-t', to, '--wrap=none'], {
    input, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
  });
}

// Keep native SVG diagrams as portable images, including the CSS that the
// website normally supplies outside the SVG. No diagram labels are rewritten.
function exportDiagrams(fragment) {
  return fragment.replace(/<svg\b[\s\S]*?<\/svg>/g, (svg) => {
    const prefix = svg.includes('class="design-flow-svg"') ? '.design-flow-svg'
      : svg.includes('class="memory-svg"') ? '.memory-svg' : '#school .school-figure svg';
    const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rules = [...source.matchAll(new RegExp(escaped + ' ([^{}]+)\\{([^}]+)\\}', 'g'))]
      .map((m) => `${m[1]}{${m[2]}}`).join('\n');
    if (!rules.includes('text{')) throw new Error(`Missing SVG styles for ${prefix}`);
    const number = String(assets.length + 1).padStart(2, '0');
    const name = `business-sop-${number}.svg`;
    const title = svg.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1] || `项目图示 ${number}`;
    const standalone = svg.replace(/<svg\b[^>]*>/, (opening) => {
      const viewBox = opening.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
      if (!viewBox) throw new Error(`SVG ${number} needs explicit dimensions`);
      const tag = opening.replace(/>$/, ` xmlns="http://www.w3.org/2000/svg" width="${viewBox[1]}" height="${viewBox[2]}">`);
      return `${tag}<style>svg{background:#fff;font-family:system-ui,-apple-system,'PingFang SC',sans-serif}\n${rules}</style>`;
    });
    assets.push({ name, title, original: svg, content: standalone });
    return `<img src="assets/${name}" alt="${title.replaceAll('"', '&quot;')}">`;
  });
}

function markdownHtml(fragment) {
  return fragment
    .replace(/<div class="deep-code">([\s\S]*?)<\/div>/g, '<pre><code>$1</code></pre>')
    .replace(/<(section|div|h[1-6]|figure)\b([^>]*\bid="([^"]+)"[^>]*)>/g,
      (tag, _name, _attributes, id) => `<a id="${id}"></a>${tag}`)
    .replace(/<summary\b[^>]*>([\s\S]*?)<\/summary>/g,
      (_tag, body) => /<h[1-6]\b/.test(body) ? body : `<h4>${body}</h4>`)
    .replace(/(<\/(?:strong|b)>)(?=<span\b)/g, '$1<br>')
    .replace(/<(?:strong|b)\b[^>]*>/g, ' $&')
    .replace(/<\/(?:strong|b)>/g, '$& ');
}

function between(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  if (start < 0) throw new Error(`Cannot locate ${startMarker}`);
  const end = source.indexOf(endMarker, start);
  if (end < 0) throw new Error(`Cannot locate ${endMarker}`);
  return source.slice(start + startMarker.length, end);
}

function templateInner(id) {
  return between(`<template id="${id}">`, '</template>');
}

function templateString(name) {
  const startMarker = `const ${name} = \``;
  const start = source.indexOf(startMarker);
  if (start < 0) throw new Error(`Cannot locate template string ${name}`);
  const contentStart = start + startMarker.length;
  const end = source.indexOf('`;', contentStart);
  if (end < 0) throw new Error(`Unclosed template string ${name}`);
  return source.slice(contentStart, end);
}

// Pandoc treats <main> as the document's unique main landmark. The webpage
// template already has its own main wrapper, so convert this presentation-only
// tag to a neutral container before joining the fragments. No text or content
// is changed by this normalization.
function normalizeFragment(fragment) {
  return fragment.replace(/<\/?main\b/gi, (tag) => tag.startsWith('</') ? '</div' : '<div');
}

// Extract one outer <details> block without dropping any nested content.
function detailsBlockContaining(text, marker) {
  const markerIndex = text.indexOf(marker);
  if (markerIndex < 0) throw new Error(`Cannot locate details marker ${marker}`);
  const start = text.lastIndexOf('<details', markerIndex);
  if (start < 0) throw new Error(`Cannot locate opening details tag for ${marker}`);
  const token = /<\/?details\b[^>]*>/gi;
  token.lastIndex = start;
  let depth = 0;
  let match;
  while ((match = token.exec(text))) {
    if (match[0][1] === '/') depth -= 1;
    else depth += 1;
    if (depth === 0) return text.slice(start, token.lastIndex);
  }
  throw new Error(`Unclosed details block for ${marker}`);
}

const businessStages = templateString('businessStages');
const projectSource = normalizeFragment(templateInner('projectSource'));
const supervisorSource = templateInner('supervisorSource');
// Match customizeSupervisor() so this is the text currently visible on the site.
const codingSop = detailsBlockContaining(supervisorSource, 'RIGHT 05 / KNOWLEDGE SHARING')
  .replaceAll('联想', '目标公司').replace('RIGHT 05 / KNOWLEDGE SHARING', 'RIGHT 04 / KNOWLEDGE SHARING');

const html = `<!doctype html>
<html lang="zh-CN">
<head><meta charset="utf-8"><title>业务面与 AI Coding SOP</title></head>
<body>
<h1>业务面与 AI Coding SOP / 工具实践</h1>
<p>来源：私人面试网站的业务面完整内容，以及主管面“对外输出：AI Coding SOP 与工具实践”模块。以下内容按网页原文导出，未压缩项目细节。</p>
<p>图表文件保存在同级 assets 目录；移动本文时请一并保留该目录。</p>
<h2>目录</h2>
<ul>
<li><a href="#business-stages">业务面通用主线与现场路由</a></li>
<li><a href="#first">第一项目：Voyager 业务信息查询 Agent</a></li>
<li><a href="#second">第二项目：Robotaxi 碰撞检测 VLM 评测</a></li>
<li><a href="#school">学校项目：低空经济多源异构文本智能问答与知识抽取系统</a></li>
<li><a href="#coding-sop">对外输出：AI Coding SOP 与工具实践</a></li>
</ul>
<h2>业务面页面说明</h2>
<p>业务面按固定主线持续沉淀每次业务面的新增问题、回答和复盘，不再按公司拆分。</p>
<ul>
<li><strong>自我介绍：</strong>背景与岗位价值</li>
<li><strong>项目拷打：</strong>机制、证据与取舍</li>
<li><strong>八股／基础题：</strong>技术深度与边界</li>
<li><strong>反问：</strong>团队、岗位与反馈</li>
</ul>
<h2 id="business-stages">一、业务面通用主线与现场路由</h2>
${businessStages}
<h2>二、业务面完整项目追问资料</h2>
${projectSource}
<h2 id="coding-sop">三、主管面补充：对外输出：AI Coding SOP 与工具实践</h2>
${codingSop}
</body>
</html>`;

const illustrated = exportDiagrams(html);
const markdown = pandoc(markdownHtml(illustrated), 'html-native_divs-native_spans', 'gfm')
  .replace(/<span id="([^"]+)"><\/span>/g, '<a id="$1"></a>');

// Compare every textual character, including tables and code, after a Markdown
// round trip. Ignore layout whitespace and text/emoji presentation selectors.
const normalize = (value) => value.replace(/[\s\uFE0E\uFE0F]+/g, '');
function textFragments(html) {
  const ast = JSON.parse(pandoc(html, 'html', 'json'));
  const text = [];
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(visit);
    if (node.t === 'Str') text.push(node.c);
    else if (['Code', 'CodeBlock', 'Math'].includes(node.t)) text.push(node.c[1]);
    else if (node.t === 'RawBlock' || node.t === 'RawInline') {
      if (!/^\s*(?:<[^>]+>\s*)*$/.test(node.c[1])) throw new Error(`Unverified raw text: ${node.c[1].slice(0, 100)}`);
    } else Object.values(node).forEach(visit);
  }
  visit(ast.blocks);
  return text;
}
const expectedFragments = textFragments(illustrated);
const actual = normalize(textFragments(pandoc(markdown, 'gfm', 'html')).join(''));
const expected = normalize(expectedFragments.join(''));
if (actual !== expected) {
  const tokens = [...new Set(expectedFragments.flatMap((fragment) =>
    fragment.match(/[\p{Script=Han}]{2,}|[A-Za-z0-9][A-Za-z0-9_./+:#-]{2,}/gu) || []))];
  const missing = tokens.filter((token) => !actual.includes(normalize(token)));
  if (missing.length) throw new Error(`Markdown dropped ${missing.length} text fragments: ${missing.slice(0, 8).join(' / ')}`);
}
const anchors = new Set([...markdown.matchAll(/<a id="([^"]+)"><\/a>/g)].map((m) => m[1]));
for (const [, id] of markdown.matchAll(/\]\(#([^ )]+)\)/g)) {
  if (!anchors.has(id)) throw new Error(`Broken document link: #${id}`);
}
if (assets.length !== 6) throw new Error(`Expected six native SVG diagrams, found ${assets.length}`);

fs.mkdirSync(new URL('docs/assets/', root), { recursive: true });
for (const asset of assets) fs.writeFileSync(new URL(`docs/assets/${asset.name}`, root), asset.content);
fs.writeFileSync(output, markdown);
console.log(`Wrote ${fileURLToPath(output)} (${markdown.length} characters)`);
console.log(`Verified ${expected.length} non-whitespace text characters, ${assets.length} SVG diagrams, and all document links.`);
