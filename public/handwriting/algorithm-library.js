(() => {
  'use strict';
  const topics = [...document.querySelectorAll('.algorithm-topic')];
  const select = document.getElementById('algorithm-select');
  const nav = [...document.querySelectorAll('[data-topic]')];
  const states = new Map();
  const fallback = {title:'接口与初始化',body:'这一行声明依赖、接口或初始状态。先对照上面的输入输出约定；进入计算阶段后，右侧会显示对应的维度与公式解释。'};

  function renderLine(topic, index, scroll = false) {
    const state = states.get(topic.id);
    const buttons = state.buttons;
    const selected = Math.max(0, Math.min(index, buttons.length - 1));
    state.index = selected;
    const button = buttons[selected];
    const note = state.data.anchors[Number(button.dataset.stage)] || fallback;
    buttons.forEach((row, i) => { row.classList.toggle('active', i === selected); row.setAttribute('aria-pressed', String(i === selected)); });
    topic.querySelector('.detail-kicker').textContent = `第 ${button.dataset.line} 行 / ${selected + 1} of ${buttons.length}`;
    topic.querySelector('.line-title').textContent = note.title;
    topic.querySelector('.line-selected').textContent = button.querySelector('.code-text').textContent;
    topic.querySelector('.line-explanation').textContent = note.body;
    topic.querySelector('[data-prev]').disabled = selected === 0;
    topic.querySelector('[data-next]').disabled = selected === buttons.length - 1;
    if (scroll) {
      const viewport = topic.querySelector('.code-scroll');
      const r = button.getBoundingClientRect(), v = viewport.getBoundingClientRect();
      if (r.top < v.top || r.bottom > v.bottom) viewport.scrollTop += r.top - v.top - viewport.clientHeight / 3;
    }
  }

  for (const topic of topics) {
    const data = JSON.parse(topic.querySelector('.algorithm-data').textContent);
    states.set(topic.id, {data, buttons:[...topic.querySelectorAll('[data-line]')], index:0});
    topic.querySelector('.code-scroll').addEventListener('click', event => {
      const button = event.target.closest('[data-line]');
      if (button) renderLine(topic, states.get(topic.id).buttons.indexOf(button));
    });
    topic.querySelector('[data-prev]').addEventListener('click', () => renderLine(topic, states.get(topic.id).index - 1, true));
    topic.querySelector('[data-next]').addEventListener('click', () => renderLine(topic, states.get(topic.id).index + 1, true));
    topic.querySelectorAll('[data-copy]').forEach(button => button.addEventListener('click', async () => {
      const text = button.dataset.copy === 'example' ? topic.querySelector('.algorithm-example code').textContent : data.source;
      try {
        await navigator.clipboard.writeText(text + '\n');
        topic.querySelector('.copy-status').textContent = '已复制' + (button.dataset.copy === 'example' ? '运行例子。' : '本题完整实现（含依赖）。');
      } catch {
        topic.querySelector('.plain-code').open = true;
        topic.querySelector('.copy-status').textContent = '浏览器限制了自动复制，可在展开的完整代码中选中复制。';
      }
    }));
    renderLine(topic, 0);
  }

  function activateHash(focus = false) {
    const raw = location.hash.slice(1);
    const code = raw.endsWith('-code');
    const id = code ? raw.slice(0, -5) : raw;
    const active = topics.find(topic => topic.id === id) || topics[0];
    topics.forEach(topic => { topic.hidden = topic !== active; });
    select.value = active.id;
    nav.forEach(link => { if (link.dataset.topic === active.id) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current'); });
    document.getElementById('jump-code').href = `#${active.id}-code`;
    document.title = `${active.querySelector('h2').textContent} · 规范手撕`;
    if (focus) active.querySelector('h2').focus({preventScroll:true});
    if (raw) requestAnimationFrame(() => (code ? active.querySelector('.algorithm-code') : active).scrollIntoView({behavior:'instant',block:'start'}));
  }
  select.addEventListener('change', () => { location.hash = select.value; });
  window.addEventListener('hashchange', () => activateHash(true));
  activateHash();
})();
