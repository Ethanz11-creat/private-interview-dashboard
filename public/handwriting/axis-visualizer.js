(function () {
  'use strict';

  function init() {
    const axisSection = document.getElementById('axis');
    if (!axisSection || document.getElementById('axis-visualizer')) return;

    const S = [
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9]
    ];
    const rowMax = S.map(row => Math.max(...row));
    const rowMaxCol = rowMax.map(value => [value]);
    const shifted = S.map((row, i) => row.map(value => value - rowMax[i]));
    const expS = shifted.map(row => row.map(value => Math.exp(value)));
    const rowSum = expS.map(row => row.reduce((sum, value) => sum + value, 0));
    const rowSumCol = rowSum.map(value => [value]);
    const attention = expS.map((row, i) => row.map(value => value / rowSum[i]));

    const steps = [
      {
        label: '1 · 原始 S',
        title: '先看一个二维矩阵：S.shape = (3, 3)',
        code: 'S = [[1, 2, 3], [4, 5, 6], [7, 8, 9]]',
        body: '把每一行想成一个位置对所有位置的得分。axis=1 要做的事情，就是沿着每一行的列方向，把这一行的 3 个数归约成 1 个结果。',
        render: () => flow([
          card('原始 S', S, '(3, 3)', '每行 3 个数')
        ])
      },
      {
        label: '2 · 每行取最大值',
        title: 'np.max(S, axis=1)：每行留下一个最大值',
        code: 'np.max(S, axis=1)',
        body: 'axis=1 表示“沿列方向计算”。第 0 行看 [1,2,3] 得到 3；第 1 行看 [4,5,6] 得到 6；第 2 行看 [7,8,9] 得到 9。',
        render: () => flow([
          card('输入 S', S, '(3, 3)', '沿每行横向扫描', 'row-focus'),
          arrow('每行取 max'),
          vectorCard('输出 row_max', rowMax, '(3,)', '一个一维向量')
        ])
      },
      {
        label: '3 · 保留维度',
        title: 'keepdims=True：把结果保留成 (3, 1) 的列向量',
        code: 'np.max(S, axis=1, keepdims=True)',
        body: '数值还是 [3,6,9]，但形状从 (3,) 变成 (3,1)。这一步没有增加信息，只是保留了“每个结果属于哪一行”的列维，方便后面广播。',
        render: () => `<div class="av-compare">
          ${vectorCard('keepdims=False', rowMax, '(3,)', '形状被压扁')}
          <div class="av-compare-arrow">→</div>
          ${card('keepdims=True', rowMaxCol, '(3, 1)', '一行一个最大值', 'column-focus')}
        </div>`
      },
      {
        label: '4 · 广播相减',
        title: 'S - 行最大值：每一行减自己的最大值',
        code: 'S = S - np.max(S, axis=1, keepdims=True)',
        body: '右侧 (3,1) 的列向量会沿列方向广播：3 只复制到第 0 行，6 只复制到第 1 行，9 只复制到第 2 行。结果每一行的最大值都变成 0。',
        render: () => flow([
          card('原始 S', S, '(3, 3)', '被减矩阵'),
          arrow('− 广播'),
          card('行最大值', rowMaxCol, '(3, 1)', '每行自己的数', 'column-focus'),
          arrow('=') ,
          card('平移后 S', shifted, '(3, 3)', '每行最大值为 0', 'shifted')
        ])
      },
      {
        label: '5 · 逐元素 exp',
        title: 'np.exp(S)：每个格子单独取指数',
        code: 'exp_S = np.exp(S)',
        body: '这里的 S 已经是平移后的矩阵。np.exp 不是矩阵乘法，也不是矩阵指数，而是对每一个元素分别计算 e 的幂；形状仍然是 (3,3)。',
        render: () => flow([
          card('平移后 S', shifted, '(3, 3)', '例如 e⁻²≈0.1353', 'shifted'),
          arrow('逐元素 exp'),
          card('exp_S', expS, '(3, 3)', '最大值 0 → 指数 1', 'exp')
        ])
      },
      {
        label: '6 · 每行求和',
        title: 'np.sum(exp_S, axis=1, keepdims=True)：得到每行分母',
        code: 'np.sum(exp_S, axis=1, keepdims=True)',
        body: '和 max 一样，axis=1 仍是“每行内部计算”。每行的 3 个指数加在一起，得到一个 (3,1) 的列向量，之后这一列会广播给对应行。',
        render: () => flow([
          card('exp_S', expS, '(3, 3)', '每行 3 个指数'),
          arrow('每行求 sum'),
          card('row_sum', rowSumCol, '(3, 1)', '每行一个分母', 'column-focus')
        ])
      },
      {
        label: '7 · 按行归一化',
        title: 'exp_S / row_sum：每行变成一个概率分布',
        code: 'A = exp_S / np.sum(exp_S, axis=1, keepdims=True)',
        body: '分母 row_sum 是 (3,1)，会按行广播到 (3,3)。每个元素除以自己所在行的总和，因此 A 的每一行加起来约等于 1，这就是行级 Softmax 的最后一步。',
        render: () => flow([
          card('exp_S', expS, '(3, 3)', '分子'),
          arrow('÷ 广播'),
          card('row_sum', rowSumCol, '(3, 1)', '行分母', 'column-focus'),
          arrow('=') ,
          card('A', attention, '(3, 3)', '每行和 ≈ 1', 'attention')
        ])
      }
    ];

    const visualizer = document.createElement('div');
    visualizer.id = 'axis-visualizer';
    visualizer.className = 'av-shell';
    visualizer.innerHTML = `
      <div class="av-kicker">矩阵变化实验 · 建议按顺序点击</div>
      <h3>把 <code>axis=1</code> 真的画出来</h3>
      <p class="av-lead">下面用一个 3×3 的 S，完整跟踪稳定 Softmax 的每一次形状变化。重点观察：二维数组的第 0 维是行，第 1 维是列；选择 <code>axis=1</code> 就是在每一行内部沿列方向归约。</p>
      <div class="av-axis-map">
        <div class="av-axis-title">二维数组的两个维度</div>
        <div class="av-axis-diagram"><span class="av-axis-chip axis-zero">axis=0 ↓ 沿行方向归约 → 每列一个结果</span><span class="av-axis-chip axis-one">axis=1 → 沿列方向归约 → 每行一个结果</span></div>
      </div>
      <div class="av-controls" role="tablist" aria-label="矩阵变化步骤"></div>
      <div class="av-step-head"><div><span class="av-step-index"></span><h4 class="av-step-title"></h4></div><code class="av-step-code"></code></div>
      <p class="av-step-body"></p>
      <div class="av-stage" aria-live="polite"></div>
      <div class="av-nav"><button type="button" class="btn av-prev">上一步</button><span class="av-progress"></span><button type="button" class="btn primary av-next">下一步</button></div>
      <div class="av-broadcast-note"><strong>广播的关键：</strong><code>(3,1)</code> 可以和 <code>(3,3)</code> 对齐，第一维都是 3，第二维的 1 可以扩展成 3；所以它代表“每行一个值，复制到这一行的所有列”。</div>
      <h4 class="av-subtitle">语法和形状速记</h4>
      <div class="table-wrap"><table class="av-reference"><thead><tr><th>代码</th><th>实际做什么</th><th>输出形状</th><th>在 Softmax 中扮演的角色</th></tr></thead><tbody>
        <tr><td><code>np.max(S, axis=1)</code></td><td>每行取最大值，丢掉被归约的列维</td><td><span class="shape-badge">(3,)</span></td><td>只适合查看结果；直接拿来和二维 S 相减容易广播错位</td></tr>
        <tr><td><code>np.max(S, axis=1, keepdims=True)</code></td><td>每行取最大值，保留成列向量</td><td><span class="shape-badge">(3,1)</span></td><td>给每一行做稳定平移</td></tr>
        <tr><td><code>np.exp(S)</code></td><td>每个元素单独算 <code>e^x</code></td><td><span class="shape-badge">(3,3)</span></td><td>把分数变成正数权重</td></tr>
        <tr><td><code>np.sum(exp_S, axis=1, keepdims=True)</code></td><td>每行 3 个指数相加，保留列维</td><td><span class="shape-badge">(3,1)</span></td><td>得到每行归一化的分母</td></tr>
        <tr><td><code>exp_S / row_sum</code></td><td>逐元素除法，row_sum 按行广播</td><td><span class="shape-badge">(3,3)</span></td><td>得到注意力权重 A，每行和约等于 1</td></tr>
      </tbody></table></div>
      <div class="av-interview-answer"><strong>面试时可以这样说：</strong>“对二维数组来说，<code>axis=1</code> 表示沿着列方向归约，也就是每一行单独计算。<code>keepdims=True</code> 把每行的结果保留成 <code>(n,1)</code>，这样在和 <code>(n,n)</code> 的得分矩阵做减法或除法时，NumPy 才会按行广播。<code>np.sum</code> 在这里就是求每行指数之和，作为 Softmax 的分母。”</div>
    `;

    const keepdimsHeading = axisSection.querySelectorAll('h3')[2];
    if (keepdimsHeading) axisSection.insertBefore(visualizer, keepdimsHeading);
    else axisSection.appendChild(visualizer);

    const controls = visualizer.querySelector('.av-controls');
    const stage = visualizer.querySelector('.av-stage');
    const title = visualizer.querySelector('.av-step-title');
    const index = visualizer.querySelector('.av-step-index');
    const code = visualizer.querySelector('.av-step-code');
    const body = visualizer.querySelector('.av-step-body');
    const progress = visualizer.querySelector('.av-progress');
    const prev = visualizer.querySelector('.av-prev');
    const next = visualizer.querySelector('.av-next');
    let current = 0;

    steps.forEach((step, stepIndex) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn av-step-button';
      button.setAttribute('role', 'tab');
      button.textContent = step.label;
      button.addEventListener('click', () => render(stepIndex));
      controls.appendChild(button);
    });

    function render(stepIndex) {
      current = Math.max(0, Math.min(steps.length - 1, stepIndex));
      const step = steps[current];
      index.textContent = `步骤 ${current + 1} / ${steps.length}`;
      title.textContent = step.title;
      code.textContent = step.code;
      body.textContent = step.body;
      stage.innerHTML = step.render();
      progress.textContent = `第 ${current + 1} 步，共 ${steps.length} 步`;
      prev.disabled = current === 0;
      next.disabled = current === steps.length - 1;
      controls.querySelectorAll('.av-step-button').forEach((button, i) => {
        const active = i === current;
        button.classList.toggle('active', active);
        button.setAttribute('aria-selected', String(active));
      });
    }

    prev.addEventListener('click', () => render(current - 1));
    next.addEventListener('click', () => render(current + 1));
    render(0);

    function format(value) {
      if (Math.abs(value) < 0.00005 && value !== 0) return value.toExponential(2);
      return Number(value).toFixed(4).replace(/\.0000$/, '');
    }

    function card(label, matrix, shape, hint, variant) {
      return `<div class="av-card ${variant || ''}"><div class="av-card-head"><strong>${label}</strong><span class="shape-badge">${shape}</span></div><div class="av-matrix-wrap">${matrixTable(matrix)}</div><div class="av-card-hint">${hint}</div></div>`;
    }

    function vectorCard(label, values, shape, hint) {
      return `<div class="av-card"><div class="av-card-head"><strong>${label}</strong><span class="shape-badge">${shape}</span></div><div class="av-vector">[${values.map(value => `<span>${format(value)}</span>`).join('')}</div><div class="av-card-hint">${hint}</div></div>`;
    }

    function matrixTable(matrix) {
      const cols = matrix[0].length;
      return `<table class="av-matrix"><thead><tr><th></th>${Array.from({ length: cols }, (_, i) => `<th>列 ${i}</th>`).join('')}</tr></thead><tbody>${matrix.map((row, rowIndex) => `<tr><th>行 ${rowIndex}</th>${row.map(value => `<td>${format(value)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    }

    function arrow(label) {
      return `<div class="av-flow-arrow"><span>→</span><small>${label}</small></div>`;
    }

    function flow(items) {
      return `<div class="av-flow">${items.join('')}</div>`;
    }

    const style = document.createElement('style');
    style.textContent = `
      #axis-visualizer{margin:28px 0 6px;padding:24px;background:linear-gradient(135deg,#f8fbff 0%,#f5f8fd 100%);border:1px solid #cbd9ee;border-radius:16px;box-shadow:0 9px 24px rgba(38,75,125,.07)}
      #axis-visualizer h3{margin:4px 0 8px;font-size:22px;color:#17233c}
      #axis-visualizer h4{margin:0;color:#17233c}
      .av-kicker{font-size:12px;letter-spacing:.12em;text-transform:uppercase;font-weight:700;color:#235cce}
      .av-lead{max-width:850px;margin:0 0 16px;color:#52627a;font-size:15px}
      .av-axis-map{padding:14px 16px;border:1px solid #dce3ee;border-radius:11px;background:#fff;margin:18px 0}
      .av-axis-title{font-size:13px;color:#52627a;font-weight:600;margin-bottom:10px}
      .av-axis-diagram{display:flex;gap:10px;flex-wrap:wrap}
      .av-axis-chip{display:inline-flex;align-items:center;padding:8px 12px;border-radius:8px;font-size:13px;font-family:ui-monospace,SFMono-Regular,Consolas,monospace}
      .axis-zero{background:#fff1e9;color:#9c4b15}.axis-one{background:#eaf3ff;color:#235cce}
      .av-controls{display:flex;gap:7px;overflow-x:auto;padding:2px 0 8px;scrollbar-width:thin}
      .av-step-button{white-space:nowrap;font-size:13px;padding:7px 10px}
      .av-step-head{display:flex;justify-content:space-between;align-items:baseline;gap:14px;margin:14px 0 6px}
      .av-step-index{display:block;font-size:12px;color:#235cce;font-weight:700;margin-bottom:3px}
      .av-step-title{font-size:18px}
      .av-step-code{color:#087967;background:#edf8f5;border-radius:6px;padding:6px 9px;font-size:12px;white-space:pre-wrap}
      .av-step-body{margin:5px 0 15px;color:#52627a;font-size:14px}
      .av-stage{min-height:164px}
      .av-flow{display:grid;grid-template-columns:minmax(0,1fr) 62px minmax(0,1fr) 62px minmax(0,1fr) 62px minmax(0,1fr);gap:9px;align-items:center}
      .av-flow > .av-card:only-child{grid-column:1 / -1;max-width:420px;justify-self:center;width:100%}
      .av-card{min-width:0;background:#fff;border:1px solid #dce3ee;border-radius:11px;padding:12px;box-shadow:0 4px 12px rgba(24,48,83,.04)}
      .av-card-head{display:flex;justify-content:space-between;align-items:center;gap:7px;margin-bottom:8px;font-size:14px}
      .av-card-head .shape-badge{white-space:nowrap}
      .av-matrix-wrap{overflow:auto}
      .av-matrix{width:100%;border-collapse:separate;border-spacing:3px;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:12px;table-layout:fixed}
      .av-matrix th{background:transparent;color:#74839a;font-size:10px;padding:2px;text-align:center;border:0;white-space:nowrap}
      .av-matrix td{background:#f4f7fb;border:1px solid #e2e8f1;border-radius:5px;text-align:center;padding:7px 3px;color:#17233c;font-variant-numeric:tabular-nums}
      .av-card.row-focus .av-matrix tbody tr:nth-child(1) td{background:#eaf3ff;border-color:#9fc1f5}
      .av-card.column-focus .av-matrix td{background:#fff1e9;border-color:#f1b995}
      .av-card.shifted .av-matrix td{background:#edf8f5;border-color:#a9dfd1}
      .av-card.exp .av-matrix td{background:#f3efff;border-color:#cfc0f2}
      .av-card.attention .av-matrix td{background:#eaf3ff;border-color:#9fc1f5}
      .av-card-hint{font-size:12px;color:#74839a;margin-top:8px}
      .av-flow-arrow{text-align:center;color:#235cce;min-width:0}
      .av-flow-arrow span{display:block;font-size:24px;line-height:1}
      .av-flow-arrow small{display:block;color:#52627a;font-size:10px;line-height:1.35;margin-top:3px;overflow-wrap:anywhere}
      .av-vector{display:flex;align-items:center;justify-content:center;gap:3px;padding:24px 4px;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:14px;overflow:auto;white-space:nowrap}
      .av-vector span{padding:8px 9px;background:#fff1e9;border:1px solid #f1b995;border-radius:5px;color:#17233c}
      .av-compare{display:grid;grid-template-columns:minmax(0,1fr) 40px minmax(0,1fr);align-items:center;gap:10px;max-width:680px;margin:0 auto}
      .av-compare-arrow{text-align:center;color:#235cce;font-size:24px}
      .av-nav{display:flex;justify-content:center;align-items:center;gap:12px;margin:16px 0 14px}
      .av-progress{font-size:12px;color:#52627a;min-width:96px;text-align:center}
      .av-broadcast-note,.av-interview-answer{padding:12px 14px;border-radius:9px;background:#fff;border-left:3px solid #235cce;color:#52627a;font-size:14px;margin:14px 0}
      .av-broadcast-note strong,.av-interview-answer strong{color:#17233c}
      .av-subtitle{font-size:17px;margin:21px 0 9px!important}
      .av-reference{font-size:13px;background:#fff;border:1px solid #dce3ee}
      .av-reference th{background:#f7f9fc;color:#52627a;font-weight:600}
      .av-reference td,.av-reference th{padding:9px 10px}
      @media(max-width:920px){.av-flow{grid-template-columns:minmax(0,1fr) 42px minmax(0,1fr) 42px minmax(0,1fr)}.av-flow > .av-card:nth-last-child(1){grid-column:auto}.av-flow > .av-card:nth-last-child(1):nth-child(7){grid-column:1 / -1;max-width:320px;justify-self:center;width:100%}}
      @media(max-width:700px){#axis-visualizer{padding:18px}.av-step-head{display:block}.av-step-code{display:inline-block;margin-top:8px}.av-flow{grid-template-columns:1fr}.av-flow-arrow{display:flex;align-items:center;justify-content:center;gap:8px}.av-flow-arrow span{transform:rotate(90deg)}.av-flow > .av-card,.av-flow > .av-card:nth-last-child(1):nth-child(7){grid-column:auto;max-width:none}.av-compare{grid-template-columns:1fr}.av-compare-arrow{transform:rotate(90deg)}}
      @media(max-width:430px){.av-axis-chip{width:100%;font-size:12px}.av-reference{min-width:650px}}
    `;
    document.head.appendChild(style);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
