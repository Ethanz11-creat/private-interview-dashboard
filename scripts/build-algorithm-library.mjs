import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { groups, topics } from '../content/handwriting-algorithms.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directory = path.join(root, 'public', 'handwriting');
const python = fs.readFileSync(path.join(directory, 'standard_algorithms.py'), 'utf8');
const starts = [...python.matchAll(/^(?:def|class) (\w+)[(:]/gm)];
const blocks = new Map(starts.map((match, index) => [match[1], python.slice(match.index, starts[index + 1]?.index ?? python.length).trim()]));
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const ids = new Set();

function codeFor(topic) {
  let imports = topic.library === 'NumPy' ? 'import numpy as np' : topic.library === 'PyTorch' ? 'import math\nimport torch\nfrom torch import nn\nimport torch.nn.functional as F' : '';
  if (topic.id === 'bpe') imports = 'from collections import Counter, defaultdict';
  const definitions = topic.symbols.map(symbol => {
    if (!blocks.has(symbol)) throw new Error(`Missing Python definition: ${symbol}`);
    return blocks.get(symbol);
  }).join('\n\n\n');
  return (imports ? imports + '\n\n\n' : '') + definitions;
}

function render(topic, index) {
  if (ids.has(topic.id)) throw new Error(`Duplicate topic id: ${topic.id}`);
  ids.add(topic.id);
  const source = codeFor(topic);
  const lines = source.split('\n');
  let cursor = 0;
  const anchors = topic.steps.map(([anchor, title, body]) => {
    const line = lines.findIndex((text, i) => i >= cursor && text.includes(anchor));
    if (line < 0) throw new Error(`Missing explanation anchor in ${topic.id}: ${anchor}`);
    cursor = line + 1;
    return { line, title, body };
  });
  const code = lines.map((line, i) => {
    if (!line.trim()) return '<div class="algorithm-code-gap" aria-hidden="true"></div>';
    const stage = anchors.findLastIndex(anchor => anchor.line <= i);
    return `<button type="button" class="code-line" data-line="${i + 1}" data-stage="${stage}" aria-pressed="false" aria-label="第 ${i + 1} 行"><span class="line-no">${i + 1}</span><span class="code-text">${escape(line)}</span></button>`;
  }).join('');
  const data = JSON.stringify({ source, anchors }).replace(/</g, '\\u003c');
  return `<article class="algorithm-topic section" id="${topic.id}" data-group="${topic.group}">
    <div class="sec-no">${String(index + 1).padStart(2, '0')} / ${escape(topic.library)}</div><h2 tabindex="-1">${escape(topic.title)}</h2><p class="lead">${escape(topic.intro)}</p>
    <div class="topic-actions"><a class="btn" href="#${topic.id}-code">直接看实现 ↓</a>${topic.related ? `<a class="btn" href="./${topic.related}">打开已有逐步详解 →</a>` : ''}</div>
    <h3>输入、输出与约定</h3><div class="table-wrap"><table><thead><tr><th>对象</th><th>形状 / 类型</th><th>约定</th></tr></thead><tbody>${topic.contract.map(row => `<tr>${row.map(cell => `<td>${escape(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
    <h3>沿数据路径理解</h3><figure class="algorithm-flow" aria-label="${escape(topic.title)} 数据路径">${topic.flow.map((node, i) => `<div class="algorithm-flow-node"><span>${i + 1}</span><strong>${escape(node)}</strong></div>`).join('')}</figure>
    ${topic.id === 'kv-cache' ? '<div class="cache-map"><div><b>历史 K/V：位置 0、1、2</b><span>缓存已计算好的 K/V</span></div><div><b>新 Q：位置 3</b><code>允许 Key [0,1,2,3]；屏蔽 [4]</code></div><div><b>新 Q：位置 4</b><code>允许 Key [0,1,2,3,4]</code></div><div><b>返回 present K/V：位置 0…4</b><span>下一次 offset=5，继续读取历史</span></div></div>' : ''}
    ${topic.id === 'gqa' ? '<div class="group-map"><div class="kv-group"><h4>K/V head 0</h4><div class="query-heads"><span class="query-tag">Q head 0</span><span class="query-tag">Q head 1</span></div><p>两个 Q 独立计算权重，共读 KV0。</p></div><div class="kv-group"><h4>K/V head 1</h4><div class="query-heads"><span class="query-tag">Q head 2</span><span class="query-tag">Q head 3</span></div><p>两个 Q 独立计算权重，共读 KV1。</p></div></div>' : ''}
    ${topic.formulas.length ? `<div class="formula">${topic.formulas.map(tex => `<div class="math-line">\\[${escape(tex)}\\]</div>`).join('')}</div>` : ''}
    <h3>写代码时先记住这些阶段</h3><div class="algorithm-steps">${topic.steps.map(([, title, text], i) => `<div><b>${i + 1}. ${escape(title)}</b><p>${escape(text)}</p></div>`).join('')}</div>
    <section class="algorithm-code" id="${topic.id}-code" aria-label="${escape(topic.title)} 逐行实现"><h3>规范实现 · 点击代码行查看对应阶段</h3><p class="small">代码包含本题所需的辅助函数，可整段复制；下面的例子接在实现后面运行。相同辅助函数从一份经过测试的实现生成。</p>
      <div class="editor-grid"><div class="code-panel"><div class="code-toolbar"><span>${escape(topic.title)} · ${escape(topic.library)}</span><button type="button" class="btn" data-copy="implementation">复制完整实现</button></div><div class="code-scroll">${code}</div></div><aside class="detail-panel" aria-live="polite"><div class="detail-kicker">点击左侧代码行</div><h4 class="line-title"></h4><pre><code class="line-selected"></code></pre><p class="line-explanation"></p><div class="controls"><button type="button" class="btn" data-prev>上一行</button><button type="button" class="btn primary" data-next>下一行</button></div></aside></div>
      <p class="copy-status small" role="status"></p><script type="application/json" class="algorithm-data">${data}</script>
      <details class="plain-code"><summary>展开可直接选中复制的完整实现</summary><pre><code>${escape(source)}</code></pre></details>
    </section>
    <h3>最小运行例子</h3><div class="example-toolbar"><button type="button" class="btn" data-copy="example">复制例子</button></div><pre class="algorithm-example"><code>${escape(topic.example)}</code></pre>
    <h3>常见错误与适用边界</h3><ul>${topic.pitfalls.map(text => `<li>${escape(text)}</li>`).join('')}</ul><div class="callout"><strong>复杂度：</strong>${escape(topic.complexity)}</div>
    <p class="small">资料对应：${escape(topic.source)}；此页使用规范化教学实现。</p>
  </article>`;
}

const groupedNav = groups.map(([id, title]) => `<div class="algorithm-nav-group"><h3>${escape(title)}</h3>${topics.filter(topic => topic.group === id).map(topic => `<a href="#${topic.id}" data-topic="${topic.id}">${escape(topic.title)}</a>`).join('')}</div>`).join('');
const options = groups.map(([id, title]) => `<optgroup label="${escape(title)}">${topics.filter(topic => topic.group === id).map(topic => `<option value="${topic.id}">${escape(topic.title)}</option>`).join('')}</optgroup>`).join('');
const sections = topics.map(render).join('\n');
const page = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>算法与大模型组件 · 20 题规范手撕</title><link rel="stylesheet" href="./gqa-guide.css"><link rel="stylesheet" href="./handwriting.css"><link rel="stylesheet" href="./algorithm-library.css"><script src="./algorithm-library.js" defer></script></head>
<body class="algorithm-page"><header><div class="wrap hero"><div class="eyebrow">ALGORITHMS / STANDARD IMPLEMENTATIONS</div><h1>算法与大模型组件</h1><p class="lead">20 题沿着“接口 → 数据路径 → 公式 → 实现 → 自检”展开。先明确张量维度和计算约定，再复现代码；已有 Attention / RoPE 等矩阵演示也可以继续对照。</p><div class="pills"><span class="pill">20 个规范实现</span><span class="pill">4 类学习路径</span><span class="pill">iPad 阅读</span></div><p class="small">浏览器用于阅读和代码解析，Python 例子需要在本地安装 NumPy / PyTorch 后运行。</p><a class="btn" href="./standard_algorithms.py" download>下载全部 Python 实现 ↓</a></div></header>
<div class="algorithm-mobile-nav"><label for="algorithm-select">选择题目</label><select id="algorithm-select">${options}</select><a href="#current-code" class="btn" id="jump-code">看代码 ↓</a></div>
<div class="wrap algorithm-layout"><aside class="algorithm-sidebar"><nav aria-label="算法主题导航">${groupedNav}</nav></aside><main id="algorithm-main">${sections}<footer class="footer"><p><a href="../?round=handwriting">返回手撕题库</a> · <a href="./standard_algorithms.py" download>下载规范实现</a></p></footer></main></div>
<noscript><div class="wrap callout">JavaScript 未启用时全部题目依次展示，完整代码可以选中复制；左侧锚点仍可跳转。</div></noscript><script src="./math-render.js?v=20261008"></script></body></html>\n`;
fs.writeFileSync(path.join(directory, 'algorithm-library.html'), page.replace(/^[ \t]+$/gm, ''));
console.log(`Built algorithm library: ${topics.length} topics from tested Python definitions.`);
