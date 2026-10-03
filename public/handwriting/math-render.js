(() => {
  'use strict';

  const storageKey = 'interview-ipad-reading';
  const bar = document.createElement('div');
  bar.className = 'handwriting-backbar';
  bar.innerHTML = '<div class="handwriting-bar-inner"><a href="../?round=handwriting">← 返回手撕题库</a><span class="handwriting-current"></span><button id="handwriting-ipad-reading" type="button" aria-pressed="false"><span aria-hidden="true">▱</span> iPad 阅读</button></div>';
  document.body.prepend(bar);
  bar.querySelector('.handwriting-current').textContent = document.title.replace(/·.*$/, '').trim();

  const toggle = bar.querySelector('#handwriting-ipad-reading');
  function setIpadReading(enabled) {
    document.body.classList.toggle('ipad-reading', enabled);
    toggle.setAttribute('aria-pressed', String(enabled));
    toggle.title = enabled ? '关闭 iPad 9 阅读布局' : '启用 iPad 9 阅读布局';
  }
  try { setIpadReading(localStorage.getItem(storageKey) === 'on'); } catch { setIpadReading(false); }
  toggle.addEventListener('click', () => {
    const enabled = !document.body.classList.contains('ipad-reading');
    setIpadReading(enabled);
    try { localStorage.setItem(storageKey, enabled ? 'on' : 'off'); } catch {}
  });

  function textToTex(text) {
    return text
      .replace(/x̄/g, '\\bar{x}').replace(/ȳ/g, '\\bar{y}')
      .replace(/√\s*([A-Za-z0-9]+)/g, '\\sqrt{$1}')
      .replace(/∑/g, '\\sum ').replace(/Σ/g, '\\Sigma ')
      .replace(/×/g, '\\times ').replace(/·/g, '\\cdot ')
      .replace(/≤/g, '\\le ').replace(/≥/g, '\\ge ')
      .replace(/−/g, '-').replace(/…/g, '\\dots ')
      .replace(/²/g, '^2').replace(/³/g, '^3')
      .replace(/₀/g, '_0').replace(/₁/g, '_1').replace(/₂/g, '_2').replace(/₃/g, '_3')
      .replace(/ᵢ/g, '_i').replace(/ⱼ/g, '_j').replace(/ₖ/g, '_k').replace(/ᵣ/g, '_r');
  }

  function nodeToTex(node) {
    if (!node) return '';
    if (node.nodeType === Node.TEXT_NODE) return textToTex(node.nodeValue);
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    if (node.classList.contains('fraction')) {
      const top = node.querySelector(':scope > .top');
      const bottom = node.querySelector(':scope > .bottom');
      return `\\frac{${nodeToTex(top)}}{${nodeToTex(bottom)}}`;
    }
    if (node.tagName === 'SUB') return `_{${[...node.childNodes].map(nodeToTex).join('')}}`;
    if (node.tagName === 'SUP') return `^{${[...node.childNodes].map(nodeToTex).join('')}}`;
    return [...node.childNodes].map(nodeToTex).join('');
  }

  function formulaBlocks() {
    const blocks = [...document.querySelectorAll('.formula')];
    for (const block of blocks) {
      if (block.dataset.mathPrepared === 'true') continue;
      const rows = [...block.querySelectorAll(':scope > .formula-row')];
      if (!rows.length) {
        // KNN has one inline formula paragraph. Keep the Chinese label and typeset the expression.
        const text = block.textContent.trim();
        const match = text.match(/^(.*?=)\s*(.+)$/);
        if (!match || !/[√∑Σ²³]/.test(match[2])) continue;
        block.replaceChildren(document.createTextNode(`${match[1]} `));
        const math = document.createElement('span');
        math.className = 'math-line';
        math.textContent = `\\(${textToTex(match[2])}\\)`;
        block.append(math);
        block.dataset.mathPrepared = 'true';
        continue;
      }
      const fragment = document.createDocumentFragment();
      for (const row of rows) {
        if (/[\u3400-\u9fff]/.test(row.textContent)) {
          fragment.append(row.cloneNode(true));
          continue;
        }
        const math = document.createElement('div');
        math.className = 'math-line';
        math.textContent = `\\[${nodeToTex(row).trim()}\\]`;
        fragment.append(math);
      }
      block.replaceChildren(fragment);
      block.dataset.mathPrepared = 'true';
    }
  }

  window.MathJax = {
    tex: { inlineMath: [['\\(', '\\)']], displayMath: [['\\[', '\\]']] },
    options: { skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'] },
    svg: { fontCache: 'global' }
  };
  const script = document.createElement('script');
  // Keep the renderer with the site so formula layout also works from a local
  // file server, an offline export, or a GitHub Pages cache without relying on
  // a third-party CDN request.
  script.src = './mathjax-tex-svg.js?v=20261003-13';
  script.async = true;
  let prepared = false;
  let typeset = false;
  const renderFormulas = () => {
    if (!window.MathJax?.typesetPromise) {
      window.setTimeout(renderFormulas, 80);
      return;
    }
    if (!prepared) {
      prepared = true;
      try { formulaBlocks(); }
      catch (error) {
        return;
      }
    }
    if (typeset) return;
    typeset = true;
    window.MathJax.typesetPromise().catch(() => {});
  };
  script.onload = renderFormulas;
  document.head.append(script);
  // Cover cached scripts whose load event fires before the handler is observed.
  window.setTimeout(renderFormulas, 0);
  // Some of the learning pages finish their own demo initialization in a
  // later task. Re-check once after that initialization so formula blocks are
  // still typeset if a demo redraws its container.
  window.setTimeout(() => {
    if (document.querySelector('.formula-row') && !document.querySelector('.math-line')) {
      prepared = false;
      typeset = false;
      renderFormulas();
    }
  }, 2200);
})();
