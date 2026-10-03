(() => {
  'use strict';
  const app = document.getElementById('app');
  const nav = document.getElementById('topic-nav');
  const list = document.getElementById('topic-nav-list');
  const toggle = document.getElementById('topic-nav-toggle');
  const header = document.querySelector('body > header');
  const search = document.getElementById('topic-search');
  const searchStatus = document.getElementById('topic-search-status');
  const searchEmpty = document.getElementById('topic-search-empty');
  const collapse = document.getElementById('topic-collapse');
  const readingSize = document.getElementById('reading-size');
  const ipadReading = document.getElementById('ipad-reading');
  const compact = matchMedia('(max-width: 1199px)');
  let entries = [];
  let active = null;
  let frame = 0;
  let searchQuery = '';
  let savedExpansion = null;

  function setReadingSize(large) {
    document.body.classList.toggle('reading-large', large);
    readingSize.setAttribute('aria-pressed', String(large));
    readingSize.title = large ? '切换为常规字号' : '放大正文和答案字号';
    schedulePosition();
  }
  try { setReadingSize(localStorage.getItem('interview-reading-size') === 'large'); } catch { /* Reading still works without browser storage. */ }
  readingSize.addEventListener('click', () => {
    const large = !document.body.classList.contains('reading-large');
    setReadingSize(large);
    try { localStorage.setItem('interview-reading-size', large ? 'large' : 'normal'); } catch {}
  });

  function setIpadReading(enabled) {
    document.body.classList.toggle('ipad-reading', enabled);
    ipadReading.setAttribute('aria-pressed', String(enabled));
    ipadReading.title = enabled ? '关闭 iPad 9 阅读布局' : '启用 iPad 9 阅读布局';
    schedulePosition();
  }
  try { setIpadReading(localStorage.getItem('interview-ipad-reading') === 'on'); } catch { /* The toggle still works without browser storage. */ }
  ipadReading.addEventListener('click', () => {
    const enabled = !document.body.classList.contains('ipad-reading');
    setIpadReading(enabled);
    try { localStorage.setItem('interview-ipad-reading', enabled ? 'on' : 'off'); } catch {}
  });

  function labelOf(element) {
    const copy = (element.matches('summary') ? element.querySelector('h2') || element : element).cloneNode(true);
    copy.querySelectorAll('small,.kicker').forEach(node => node.remove());
    return copy.textContent.replace(/\s+/g, ' ').trim();
  }

  // Read the final rendered page, after each round's content transformations.
  // These rules describe heading levels, never a second copy of the article text.
  function topicLevel(element, round) {
    if (element.closest('.hero,.source-label')) return 0;
    if (round === 'technical') {
      if (element.matches('h2,.stage-panel > h3')) return 1;
      if (element.matches('.project-mode-label')) return 2;
      if (element.matches('.first-project-library > header > h3')) return 0;
      if (element.matches('.first-project-library h4:not(.chapter-subheading),.memory-subhead')) return element.matches('.memory-subhead') ? 4 : 3;
      if (element.matches('.school-selection-panel > h4')) return 3;
      if (element.matches('h3,.stage-notes summary,.business-routing h4')) return element.closest('#first') ? 3 : 2;
    } else if (round === 'fundamentals') {
      if (element.matches('.knowledge-group > h4')) return 1;
      if (element.matches('.qa > b')) return 2;
    } else if (round === 'supervisor') {
      if (element.matches('summary')) return 1;
      if (element.matches('h3') && !element.closest('summary')) return 2;
    } else if (round === 'hr') {
      if (element.matches('h4,.hr-panel > details > summary')) return 1;
      if (element.matches('h5,.qa-bilingual > b,.offer-item > b,.offer-table-wrap,.hr-panel h3')) return 2;
    }
    return 0;
  }

  function stableId(label, round) {
    let hash = 2166136261;
    for (const char of label) hash = Math.imul(hash ^ char.codePointAt(0), 16777619);
    const base = `toc-${round}-${(hash >>> 0).toString(36)}`;
    let id = base;
    for (let n = 2; document.getElementById(id); n++) id = `${base}-${n}`;
    return id;
  }

  function expand(entry, open) {
    if (!entry.button) return;
    entry.button.setAttribute('aria-expanded', String(open));
    entry.button.setAttribute('aria-label', `${open ? '收起' : '展开'} ${entry.label} 子目录`);
    entry.children.hidden = !open;
  }

  function ensureBranch(entry) {
    if (entry.children) return;
    entry.children = document.createElement('ul');
    entry.children.id = `children-${entry.target.id}`;
    entry.button = document.createElement('button');
    entry.button.type = 'button';
    entry.button.className = 'topic-nav-expand';
    entry.button.setAttribute('aria-controls', entry.children.id);
    entry.button.addEventListener('click', () => expand(entry, entry.children.hidden));
    entry.row.append(entry.button);
    entry.item.append(entry.children);
    expand(entry, false);
  }

  function filterTopics() {
    const query = search.value.trim().toLocaleLowerCase();
    if (query && !searchQuery) {
      savedExpansion = new Map(entries.filter(entry => entry.children).map(entry => [entry, !entry.children.hidden]));
    }
    searchQuery = query;
    const matches = new Set(query ? entries.filter(entry => entry.label.toLocaleLowerCase().includes(query)) : []);
    const shown = new Set(matches);
    for (const entry of matches) {
      for (let parent = entry.parent; parent; parent = parent.parent) shown.add(parent);
    }
    // A matching chapter includes its questions; a matching question keeps its path.
    for (const entry of entries) {
      for (let parent = entry.parent; parent; parent = parent.parent) {
        if (matches.has(parent)) { shown.add(entry); break; }
      }
      entry.item.hidden = Boolean(query) && !shown.has(entry);
      if (query && shown.has(entry)) expand(entry, true);
      if (!query && savedExpansion?.has(entry)) expand(entry, savedExpansion.get(entry));
    }
    if (!query) {
      // Keep the newly visited topic reachable when a search is cleared.
      if (savedExpansion) {
        for (let branch = active; branch; branch = branch.parent) expand(branch, true);
      }
      savedExpansion = null;
    }
    searchEmpty.hidden = !query || matches.size > 0;
    searchStatus.textContent = query ? `匹配 ${matches.size} 个主题标题` : '按主题快速定位';
    list.scrollTop = 0;
  }
  search.addEventListener('input', filterTopics);
  search.addEventListener('keydown', event => {
    if (event.key === 'Escape' && search.value) {
      event.stopPropagation();
      search.value = '';
      filterTopics();
    }
  });
  collapse.addEventListener('click', () => {
    search.value = '';
    filterTopics();
    entries.forEach(entry => expand(entry, false));
    list.scrollTop = 0;
  });

  function setActive(entry) {
    if (!entry || entry === active) return;
    active?.link.removeAttribute('aria-current');
    list.querySelectorAll('.active-branch').forEach(node => node.classList.remove('active-branch'));
    active = entry;
    entry.link.setAttribute('aria-current', 'location');
    for (let branch = entry; branch; branch = branch.parent) {
      branch.item.classList.add('active-branch');
      if (!searchQuery) expand(branch, true);
    }
    // Scroll only this rail, never the document, and don't fight someone browsing it.
    if (!searchQuery && !list.matches(':hover') && !nav.contains(document.activeElement)) {
      const bounds = list.getBoundingClientRect();
      const rect = entry.link.getBoundingClientRect();
      if (bounds.height && (rect.top < bounds.top || rect.bottom > bounds.bottom)) {
        list.scrollTop += rect.top - bounds.top - bounds.height / 3;
      }
    }
  }

  function visible(element) {
    for (let parent = element.parentElement; parent && parent !== app; parent = parent.parentElement) {
      if (parent.matches('details:not([open])') && !parent.querySelector(':scope > summary')?.contains(element)) return false;
    }
    return element.getClientRects().length > 0;
  }

  function updatePosition() {
    frame = 0;
    const threshold = header.getBoundingClientRect().bottom + 55;
    let candidate = null;
    let bestTop = -Infinity;
    for (const entry of entries) {
      if (!visible(entry.target)) continue;
      const top = entry.target.getBoundingClientRect().top;
      // Ties occur in two-column question grids: keep the explicitly selected question.
      if (top <= threshold && (top > bestTop + 1 || (Math.abs(top - bestTop) <= 1 && entry === active))) {
        candidate = entry;
        bestTop = top;
      }
    }
    setActive(candidate || entries[0]);
  }

  function schedulePosition() {
    if (!frame) frame = requestAnimationFrame(updatePosition);
  }

  function closePanel(returnFocus = false) {
    nav.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.textContent = '本页目录';
    if (returnFocus) toggle.focus();
  }

  function jumpTo(target, updateHash = true) {
    for (let parent = target.parentElement; parent && parent !== app; parent = parent.parentElement) {
      if (parent.tagName === 'DETAILS') parent.open = true;
    }
    // A summary is itself the destination of a closed section.
    if (target.matches('summary')) target.parentElement.open = true;
    if (updateHash) {
      const url = new URL(location.href);
      url.searchParams.set('round', document.body.dataset.round);
      url.hash = target.id;
      try { history.pushState(null, '', url); } catch { /* Local file preview still scrolls. */ }
    }
    closePanel();
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: 'start', behavior: 'instant' });
    const entry = entries.find(item => item.target === target);
    if (entry) setActive(entry);
    schedulePosition();
  }

  function followHash() {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    const target = document.getElementById(id);
    if (target && app.contains(target)) jumpTo(target, false);
  }

  function rebuild() {
    active = null;
    entries = [];
    searchQuery = '';
    savedExpansion = null;
    search.value = '';
    searchEmpty.hidden = true;
    searchStatus.textContent = '按主题快速定位';
    closePanel();
    const round = document.body.dataset.round;
    document.querySelectorAll('.side-nav [data-round]').forEach(button => {
      if (button.dataset.round === round) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    const root = document.createElement('ul');
    root.className = 'topic-nav-root';
    const stack = [];
    const candidates = app.querySelectorAll('h2,h3,h4,h5,summary,.qa > b,.qa-bilingual > b,.offer-item > b,.offer-table-wrap,.project-mode-label');
    for (const target of candidates) {
      const level = topicLevel(target, round);
      if (!level) continue;
      const label = target.matches('.offer-table-wrap') ? '五险一金 · 基数与缴纳比例' : labelOf(target.matches('.project-mode-label') ? target.querySelector('b') : target);
      if (!label) continue;
      if (!target.id) target.id = stableId(label, round);
      target.dataset.topicTarget = '';
      while (stack.length && stack.at(-1).level >= level) stack.pop();
      const parent = stack.at(-1) || null;
      const item = document.createElement('li');
      const row = document.createElement('div');
      row.className = 'topic-nav-row';
      const link = document.createElement('a');
      link.className = 'topic-nav-link';
      link.href = `#${encodeURIComponent(target.id)}`;
      link.textContent = label;
      link.addEventListener('click', event => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        jumpTo(target);
      });
      row.append(link);
      item.append(row);
      const entry = { target, label, level, parent, item, row, link };
      if (parent) {
        ensureBranch(parent);
        parent.children.append(item);
      } else root.append(item);
      entries.push(entry);
      stack.push(entry);
    }
    list.replaceChildren(root);
    list.setAttribute('aria-busy', 'false');
    list.scrollTop = 0;
    document.getElementById('topic-nav-context').textContent = `${app.querySelector('.hero h2').textContent} · ${entries.filter(entry => !entry.parent).length} 个主题`;
    followHash();
    schedulePosition();
  }

  toggle.addEventListener('click', () => {
    const open = !nav.classList.contains('is-open');
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? '收起目录' : '本页目录';
    if (open) search.focus({ preventScroll: true });
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && nav.classList.contains('is-open')) closePanel(true);
  });
  document.addEventListener('click', event => {
    if (compact.matches && !nav.contains(event.target) && !toggle.contains(event.target)) closePanel();
  });
  nav.querySelector('.topic-nav-top').addEventListener('click', event => {
    event.preventDefault();
    closePanel();
    const url = new URL(location.href); url.hash = '';
    try { history.replaceState(null, '', url); } catch {}
    app.querySelector('.hero h2').setAttribute('tabindex', '-1');
    app.querySelector('.hero h2').focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
    schedulePosition();
  });
  window.addEventListener('scroll', schedulePosition, { passive: true });
  window.addEventListener('resize', schedulePosition);
  window.addEventListener('hashchange', followHash);
  compact.addEventListener('change', () => closePanel());
  app.addEventListener('toggle', schedulePosition, true);
  new ResizeObserver(() => {
    document.documentElement.style.setProperty('--page-header-height', `${header.offsetHeight}px`);
    schedulePosition();
  }).observe(header);
  new MutationObserver(rebuild).observe(app, { childList: true });
  rebuild();
})();
