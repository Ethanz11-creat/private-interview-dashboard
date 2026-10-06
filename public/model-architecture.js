(() => {
  'use strict';
  const app = document.getElementById('app');
  const dialog = document.createElement('dialog');
  dialog.className = 'architecture-viewer';
  dialog.setAttribute('aria-labelledby', 'architecture-viewer-title');
  dialog.innerHTML = `<div class="architecture-viewer-head"><span class="architecture-viewer-title" id="architecture-viewer-title"></span><div class="architecture-viewer-actions"><button type="button" data-viewer="fit">适合宽度</button><button type="button" data-viewer="original">原始尺寸</button><button type="button" data-viewer="out" aria-label="缩小架构图">−</button><output aria-live="polite"></output><button type="button" data-viewer="in" aria-label="放大架构图">+</button><a target="_blank" rel="noopener" aria-label="在新标签页打开架构图">单独打开</a><button type="button" data-viewer="close" autofocus aria-label="关闭架构图">关闭</button></div></div><div class="architecture-viewer-stage"><img alt=""></div><p class="architecture-viewer-hint">放大后可横向、纵向滚动；Esc 关闭。手机也可用浏览器双指缩放。</p>`;
  document.body.append(dialog);
  const stage = dialog.querySelector('.architecture-viewer-stage');
  const image = dialog.querySelector('img');
  const title = dialog.querySelector('.architecture-viewer-title');
  const output = dialog.querySelector('output');
  let scale = 1;
  let originalWidth = 1040;
  let opener;
  function resize(nextScale) {
    scale = Math.min(4, Math.max(.01, nextScale));
    image.style.width = `${Math.round(originalWidth * scale)}px`;
    output.value = `${Math.round(scale * 100)}%`;
  }
  function fit() {
    const padding = parseFloat(getComputedStyle(stage).paddingLeft) * 2;
    resize((stage.clientWidth - padding) / originalWidth);
    stage.scrollTo(0, 0);
  }
  function show(button) {
    const source = button.closest('figure').querySelector('img');
    opener = button;
    title.textContent = source.alt;
    image.alt = source.alt;
    image.style.width = '100%';
    image.onload = () => { originalWidth = image.naturalWidth || 1040; fit(); };
    image.src = source.src;
    dialog.querySelector('a').href = source.src;
    dialog.showModal();
    // A cached image may have completed before the load listener runs.
    if (image.complete && image.naturalWidth) { originalWidth = image.naturalWidth; fit(); }
  }
  function prepare() {
    app.querySelectorAll('#architecture figure').forEach(figure => {
      const source = figure.querySelector('img');
      if (!source || figure.querySelector('.architecture-figure-button')) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'architecture-figure-button';
      button.textContent = '放大阅读 ↗';
      button.setAttribute('aria-label', `放大阅读：${source.alt}`);
      figure.querySelector('.architecture-image-header').append(button);
    });
  }
  app.addEventListener('click', event => {
    const button = event.target.closest('.architecture-figure-button');
    if (button) { show(button); return; }
    if (event.target.matches('#architecture figure img')) {
      show(event.target.closest('figure').querySelector('.architecture-figure-button'));
    }
  });
  dialog.addEventListener('click', event => {
    const action = event.target.closest('[data-viewer]')?.dataset.viewer;
    if (action === 'close') dialog.close();
    else if (action === 'fit') fit();
    else if (action === 'original') resize(1);
    else if (action === 'in') resize(scale * 1.25);
    else if (action === 'out') resize(scale / 1.25);
    else if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => opener?.focus());
  new MutationObserver(() => { if (dialog.open) dialog.close(); prepare(); }).observe(app, { childList: true });
  prepare();
})();
