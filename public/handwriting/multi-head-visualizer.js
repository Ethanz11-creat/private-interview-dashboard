(function () {
  'use strict';

  function init() {
    const axes = document.getElementById('axes');
    if (!axes || document.getElementById('multi-head-visualizer')) return;

    const T = 2;
    const dModel = 4;
    const heads = 2;
    const dK = dModel / heads;
    const Q = [[1, 0, 2, 0], [0, 1, 0, 2]];
    const K = [[1, 0, 1, 0], [0, 1, 0, 1]];
    const V = [[10, 11, 20, 21], [30, 31, 40, 41]];

    function split(matrix) {
      return Array.from({ length: heads }, (_, head) =>
        matrix.map(row => row.slice(head * dK, (head + 1) * dK))
      );
    }

    function transpose(matrix) {
      return matrix[0].map((_, col) => matrix.map(row => row[col]));
    }

    function matmul(a, b) {
      return a.map(row => b[0].map((_, col) => row.reduce((sum, value, i) => sum + value * b[i][col], 0)));
    }

    function softmaxRows(matrix) {
      return matrix.map(row => {
        const max = Math.max(...row);
        const exps = row.map(value => Math.exp(value - max));
        const total = exps.reduce((sum, value) => sum + value, 0);
        return exps.map(value => value / total);
      });
    }

    const qByHead = split(Q);
    const kByHead = split(K);
    const vByHead = split(V);
    const scores = qByHead.map((q, head) => matmul(q, transpose(kByHead[head])).map(row => row.map(value => value / Math.sqrt(dK))));
    const weights = scores.map(softmaxRows);
    const hByHead = weights.map((weight, head) => matmul(weight, vByHead[head]));
    const H = Array.from({ length: T }, (_, token) => hByHead.flatMap(head => head[token]));
    const O = H.map(row => row.slice());

    const steps = [
      {
        label: '1 · 完整 Q/K/V',
        title: '先得到完整的 (T, d_model) 矩阵',
        code: 'Q, K, V 形状都是 (T, d_model) = (2, 4)',
        body: '多头不是把 token 切成几段。每个 token 仍然保留完整的 4 维表示；后面切的是这一行的特征列。',
        render: () => flow([
          matrixCard('Q', Q, '(2, 4)', 'token 0 / token 1，各有 4 个特征', 'blue'),
          matrixCard('K', K, '(2, 4)', '用于被匹配', 'orange'),
          matrixCard('V', V, '(2, 4)', '最终被加权的信息', 'green')
        ])
      },
      {
        label: '2 · reshape 分组',
        title: 'reshape(T, h, d_k)：每个 token 的特征切成 h 组',
        code: 'Q.reshape(2, 2, 2)  # (token, head, feature)',
        body: 'd_model=4、h=2，所以 d_k=4/2=2。每一行连续的 4 个特征按顺序切成两组：头 0 拿列 0、1；头 1 拿列 2、3。',
        render: () => `<div class="mhv-split-flow">
          ${matrixCard('Q（完整）', Q, '(2, 4)', '每行连续 4 个特征', 'blue')}
          <div class="mhv-big-arrow"><span>→</span><small>reshape<br>不改变数据</small></div>
          <div class="mhv-group-grid">${qByHead.map((matrix, head) => matrixCard(`Q[:, head ${head}]`, matrix, '(2, 2)', `头 ${head} 的特征列 ${head * dK}～${head * dK + dK - 1}`, head === 0 ? 'head0' : 'head1')).join('')}</div>
        </div>`
      },
      {
        label: '3 · transpose 换轴',
        title: 'transpose(0, 1)：把 head 轴放到最前面',
        code: 'Q_heads = Q.reshape(T, h, d_k).transpose(0, 1)',
        body: 'reshape 后是 (token, head, feature)=(2,2,2)。交换前两轴后变成 (head, token, feature)=(2,2,2)，这样批量矩阵乘法就能把 head 当成批次。元素没有改变，只是访问路径改变了。',
        render: () => `<div class="mhv-split-flow">
          ${tensorCard('reshape 后', qByHead.map((_, token) => qByHead.map((headMatrix, head) => headMatrix[token])), '(T, h, d_k) = (2, 2, 2)', '先按 token 看：每个 token 里面有 h 组')}
          <div class="mhv-big-arrow"><span>⇄</span><small>transpose<br>换轴</small></div>
          ${tensorCard('Q_heads', qByHead, '(h, T, d_k) = (2, 2, 2)', '再按 head 看：每个 head 包含全部 token')}
        </div>`
      },
      {
        label: '4 · 每头得分',
        title: '每个 head 独立计算 T×T 的位置匹配',
        code: 'scores = Q_heads @ K_heads.transpose(-2, -1) / √d_k',
        body: '每个 head 都拿自己的 Q_i 和 K_i 做矩阵乘法，不会把 head 0 的 Q 和 head 1 的 K 混在一起。最后两维 (T,d_k) @ (d_k,T) 变成 (T,T)。',
        render: () => `<div class="mhv-score-layout">
          <div class="mhv-equation"><code>(h, T, d_k) @ (h, d_k, T) → (h, T, T)</code><p>这里 h 是批次维；真正做矩阵乘法的是每个 head 的最后两维。</p></div>
          <div class="mhv-head-grid">${scores.map((matrix, head) => matrixCard(`scores · head ${head}`, matrix, '(T, T) = (2, 2)', '行：Query；列：Key', head === 0 ? 'head0' : 'head1')).join('')}</div>
        </div>`
      },
      {
        label: '5 · Softmax dim=-1',
        title: '沿最后一维 Key 归一化：得到每个 head 的权重',
        code: 'attn_weights = torch.softmax(scores, dim=-1)',
        body: 'scores 的形状是 (head, Query, Key)。dim=-1 指最后的 Key 轴，所以固定一个 head 和一个 Query，只对这一行所有 Key 做 Softmax；每一行和约等于 1。',
        render: () => `<div class="mhv-score-layout">
          <div class="mhv-axis-callout"><strong>dim=-1</strong><span>固定 head、固定 Query</span><span>沿 Key 位置归一化</span><span>(h, T, T) → (h, T, T)</span></div>
          <div class="mhv-head-grid">${weights.map((matrix, head) => matrixCard(`attn_weights · head ${head}`, matrix, '(2, 2)', '每行都是一个概率分布', 'attention')).join('')}</div>
        </div>`
      },
      {
        label: '6 · 各头输出',
        title: '权重矩阵乘本头 V：每头得到 (T, d_k)',
        code: 'H_heads = attn_weights @ V_heads',
        body: '每个 head 只混合自己那一份 V 特征。两个 head 分别得到 2×2 的局部输出，合起来仍然是 (h,T,d_k)。',
        render: () => `<div class="mhv-split-flow">
          ${tensorCard('attn_weights', weights, '(h, T, T) = (2, 2, 2)', '每头的注意力分布', 'attention')}
          <div class="mhv-big-arrow"><span>×</span><small>matmul<br>逐 head</small></div>
          ${tensorCard('H_heads', hByHead, '(h, T, d_k) = (2, 2, 2)', '每头的局部输出', 'output')}
        </div>`
      },
      {
        label: '7 · 拼回 H',
        title: '先换回 (T, h, d_k)，再把 h×d_k 合成 d_model',
        code: 'H = H_heads.transpose(0, 1).reshape(T, d_model)',
        body: '不能直接对 head-major 的 H_heads 做 reshape，否则会把同一个 head 的不同 token 错拼到一起。先把轴换成 (token, head, feature)，再对最后两个轴展平。',
        render: () => `<div class="mhv-split-flow">
          ${tensorCard('H_heads', hByHead, '(h, T, d_k) = (2, 2, 2)', 'head 0、head 1 分开存放', 'output')}
          <div class="mhv-big-arrow"><span>→</span><small>transpose<br>再 reshape</small></div>
          ${matrixCard('H（拼接）', H, '(T, d_model) = (2, 4)', 'token 0：[头0的2维 | 头1的2维]', 'merged')}
        </div>`
      },
      {
        label: '8 · 输出投影',
        title: 'H 经过 W_O：让不同 head 的信息再次混合',
        code: 'O = H @ W_O + b_O',
        body: '拼接只是把各头特征放回同一行；输出线性层再学习如何混合这些特征。示例中用 W_O=I、b_O=0 方便观察，所以 O 与 H 数值相同，真实题目不一定相同。',
        render: () => `<div class="mhv-split-flow">
          ${matrixCard('H', H, '(2, 4)', '多头输出已经拼回完整维度', 'merged')}
          <div class="mhv-big-arrow"><span>×</span><small>W_O<br>+ b_O</small></div>
          ${matrixCard('O', O, '(2, 4)', '最终返回值', 'output')}
        </div>`
      }
    ];

    const visualizer = document.createElement('div');
    visualizer.id = 'multi-head-visualizer';
    visualizer.className = 'mhv-shell';
    visualizer.innerHTML = `
      <div class="mhv-kicker">张量维度实验 · T=2 / d_model=4 / h=2</div>
      <h3>把“分头 → 独立计算 → 拼头”画出来</h3>
      <p class="mhv-lead">核心结论：多头切分的是<strong>每个 token 的特征维</strong>，不是 token 数。一个 4 维 token 在 h=2 时变成两个 2 维子空间；两个 head 都仍然看到全部 T=2 个 token。</p>
      <div class="mhv-dimension-strip"><span><b>d_model=4</b><small>每个 token 的完整特征</small></span><i>÷ h=2</i><span><b>d_k=2</b><small>每个 head 的特征宽度</small></span><i>× h=2</i><span><b>回到 4 维</b><small>拼接后再过 W_O</small></span></div>
      <div class="mhv-controls" role="tablist" aria-label="多头注意力张量步骤"></div>
      <div class="mhv-step-head"><div><span class="mhv-index"></span><h4 class="mhv-title"></h4></div><code class="mhv-code"></code></div>
      <p class="mhv-body"></p>
      <div class="mhv-stage" aria-live="polite"></div>
      <div class="mhv-nav"><button type="button" class="btn mhv-prev">上一步</button><span class="mhv-progress"></span><button type="button" class="btn primary mhv-next">下一步</button></div>
      <div class="mhv-legend"><span><i class="mhv-dot head0"></i>head 0：特征列 0～1</span><span><i class="mhv-dot head1"></i>head 1：特征列 2～3</span><span><i class="mhv-dot attention"></i>注意力权重</span></div>
      <div class="mhv-cheatsheet"><h4>截图中每一行代码的形状对照</h4><div class="table-wrap"><table><thead><tr><th>代码</th><th>输入 → 输出</th><th>直观含义</th></tr></thead><tbody>
        <tr><td><code>Q.reshape(T,h,d_k)</code></td><td><span class="shape-badge">(T,d_model) → (T,h,d_k)</span></td><td>每个 token 的特征切成 h 组</td></tr>
        <tr><td><code>.transpose(0,1)</code></td><td><span class="shape-badge">(T,h,d_k) → (h,T,d_k)</span></td><td>把 head 轴放到最前，方便批量计算</td></tr>
        <tr><td><code>K_heads.transpose(-2,-1)</code></td><td><span class="shape-badge">(h,T,d_k) → (h,d_k,T)</span></td><td>只交换最后两轴，给每个 head 的 K 做转置</td></tr>
        <tr><td><code>scores</code></td><td><span class="shape-badge">(h,T,T)</span></td><td>每个 head 都有一张 T×T 的 Query-Key 得分表</td></tr>
        <tr><td><code>softmax(dim=-1)</code></td><td><span class="shape-badge">(h,T,T) → (h,T,T)</span></td><td>沿最后的 Key 轴逐行归一化</td></tr>
        <tr><td><code>H_heads</code></td><td><span class="shape-badge">(h,T,T) @ (h,T,d_k) → (h,T,d_k)</span></td><td>每个 head 产生自己的局部输出</td></tr>
        <tr><td><code>H_heads.transpose(0,1).reshape(T,d_model)</code></td><td><span class="shape-badge">(h,T,d_k) → (T,h,d_k) → (T,d_model)</span></td><td>同一个 token 的各头输出相邻放回一行</td></tr>
      </tbody></table></div></div>
      <div class="mhv-interview-answer"><strong>面试时可以这样说：</strong>“我先用完整的线性层得到 Q、K、V，形状都是 <code>(T,d_model)</code>。如果有 h 个 head，就令 <code>d_k=d_model/h</code>，把每个 token 的连续特征切成 h 组，reshape 后换成 <code>(h,T,d_k)</code>。每个 head 独立做 <code>(T,d_k)@(d_k,T)</code>，得到自己的 <code>(T,T)</code> 权重矩阵，Softmax 沿最后的 Key 轴归一化。各头输出是 <code>(h,T,d_k)</code>，换回 <code>(T,h,d_k)</code> 后把后两维合成 <code>(T,d_model)</code>，最后再经过输出投影。”</div>
    `;

    const firstHeading = axes.querySelector('h3');
    if (firstHeading) axes.insertBefore(visualizer, firstHeading);
    else axes.appendChild(visualizer);

    const controls = visualizer.querySelector('.mhv-controls');
    const title = visualizer.querySelector('.mhv-title');
    const index = visualizer.querySelector('.mhv-index');
    const code = visualizer.querySelector('.mhv-code');
    const body = visualizer.querySelector('.mhv-body');
    const stage = visualizer.querySelector('.mhv-stage');
    const progress = visualizer.querySelector('.mhv-progress');
    const prev = visualizer.querySelector('.mhv-prev');
    const next = visualizer.querySelector('.mhv-next');
    let current = 0;

    steps.forEach((step, stepIndex) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn mhv-step-button';
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
      controls.querySelectorAll('.mhv-step-button').forEach((button, i) => {
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

    function matrixCard(label, matrix, shape, hint, variant) {
      return `<div class="mhv-card ${variant || ''}"><div class="mhv-card-head"><strong>${label}</strong><span class="shape-badge">${shape}</span></div><div class="mhv-matrix-wrap">${matrixTable(matrix)}</div><div class="mhv-card-hint">${hint}</div></div>`;
    }

    function tensorCard(label, tensor, shape, hint, variant) {
      return `<div class="mhv-card mhv-tensor ${variant || ''}"><div class="mhv-card-head"><strong>${label}</strong><span class="shape-badge">${shape}</span></div><div class="mhv-head-grid">${tensor.map((matrix, head) => matrixCard(`head ${head}`, matrix, `${matrix.length}×${matrix[0].length}`, head === 0 ? '全部 token · 特征局部' : '全部 token · 特征局部', head === 0 ? 'head0' : 'head1')).join('')}</div><div class="mhv-card-hint">${hint}</div></div>`;
    }

    function matrixTable(matrix) {
      return `<table class="mhv-matrix"><thead><tr><th></th>${matrix[0].map((_, col) => `<th>f${col}</th>`).join('')}</tr></thead><tbody>${matrix.map((row, token) => `<tr><th>t${token}</th>${row.map(value => `<td>${format(value)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    }

    function flow(items) {
      return `<div class="mhv-flow">${items.join('')}</div>`;
    }
  
    const style = document.createElement('style');
    style.textContent = `
      #multi-head-visualizer{margin:26px 0 8px;padding:24px;background:linear-gradient(135deg,#f8fbff 0%,#f5f8fd 100%);border:1px solid #cbd9ee;border-radius:16px;box-shadow:0 9px 24px rgba(38,75,125,.07)}
      #multi-head-visualizer h3{margin:4px 0 8px;font-size:22px;color:#17233c}
      #multi-head-visualizer h4{margin:0;color:#17233c}
      .mhv-kicker{font-size:12px;letter-spacing:.12em;text-transform:uppercase;font-weight:700;color:#235cce}
      .mhv-lead{max-width:880px;margin:0 0 17px;color:#52627a;font-size:15px}
      .mhv-dimension-strip{display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap;padding:14px 16px;background:#fff;border:1px solid #dce3ee;border-radius:11px;margin:18px 0}
      .mhv-dimension-strip span{display:flex;flex-direction:column;gap:1px;padding:8px 12px;background:#edf3ff;border-radius:8px;text-align:center;color:#235cce}.mhv-dimension-strip span:nth-of-type(2){background:#eaf8f4;color:#087967}.mhv-dimension-strip span:nth-of-type(3){background:#fff3e9;color:#9c4b15}
      .mhv-dimension-strip b{font:600 15px ui-monospace,SFMono-Regular,Consolas,monospace}.mhv-dimension-strip small{font-size:11px;color:#52627a}.mhv-dimension-strip i{font-style:normal;color:#74839a;font-size:13px}
      .mhv-controls{display:flex;gap:7px;overflow-x:auto;padding:2px 0 8px;scrollbar-width:thin}.mhv-step-button{white-space:nowrap;font-size:13px;padding:7px 10px}
      .mhv-step-head{display:flex;justify-content:space-between;align-items:baseline;gap:14px;margin:14px 0 6px}.mhv-index{display:block;font-size:12px;color:#235cce;font-weight:700;margin-bottom:3px}.mhv-title{font-size:18px}.mhv-code{color:#087967;background:#edf8f5;border-radius:6px;padding:6px 9px;font-size:12px;white-space:pre-wrap}.mhv-body{margin:5px 0 15px;color:#52627a;font-size:14px}.mhv-stage{min-height:170px}
      .mhv-flow{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:15px;align-items:start}.mhv-flow-gap{display:none}
      .mhv-card{min-width:0;background:#fff;border:1px solid #dce3ee;border-radius:11px;padding:12px;box-shadow:0 4px 12px rgba(24,48,83,.04)}.mhv-card-head{display:flex;justify-content:space-between;align-items:center;gap:7px;margin-bottom:8px;font-size:14px}.mhv-card-head .shape-badge{white-space:nowrap}.mhv-matrix-wrap{overflow:auto}.mhv-matrix{width:100%;border-collapse:separate;border-spacing:3px;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:12px;table-layout:fixed}.mhv-matrix th{background:transparent;color:#74839a;font-size:10px;padding:2px;text-align:center;border:0;white-space:nowrap}.mhv-matrix td{background:#f4f7fb;border:1px solid #e2e8f1;border-radius:5px;text-align:center;padding:7px 3px;color:#17233c;font-variant-numeric:tabular-nums}.mhv-card.blue .mhv-matrix td{background:#eaf3ff;border-color:#9fc1f5}.mhv-card.orange .mhv-matrix td{background:#fff1e9;border-color:#f1b995}.mhv-card.green .mhv-matrix td{background:#edf8f5;border-color:#a9dfd1}.mhv-card.head0 .mhv-matrix td{background:#eaf3ff;border-color:#9fc1f5}.mhv-card.head1 .mhv-matrix td{background:#fff1e9;border-color:#f1b995}.mhv-card.attention .mhv-matrix td{background:#f0eaff;border-color:#cfc0f2}.mhv-card.output .mhv-matrix td{background:#edf8f5;border-color:#a9dfd1}.mhv-card.merged .mhv-matrix td{background:#eef2ff;border-color:#b8c9f2}.mhv-card-hint{font-size:12px;color:#74839a;margin-top:8px}
      .mhv-split-flow{display:grid;grid-template-columns:minmax(0,1fr) 80px minmax(0,1fr);gap:13px;align-items:center}.mhv-group-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.mhv-group-grid .mhv-card,.mhv-head-grid .mhv-card{padding:9px}.mhv-group-grid .mhv-card-head,.mhv-head-grid .mhv-card-head{font-size:12px}.mhv-big-arrow{text-align:center;color:#235cce}.mhv-big-arrow span{display:block;font-size:27px;line-height:1}.mhv-big-arrow small{display:block;color:#52627a;font-size:11px;line-height:1.35}.mhv-tensor{min-width:0}.mhv-tensor>.mhv-head-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.mhv-head-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.mhv-score-layout{display:grid;grid-template-columns:minmax(180px,.7fr) minmax(0,1.3fr);gap:15px;align-items:start}.mhv-equation,.mhv-axis-callout{padding:16px;border-radius:9px;background:#fff;border-left:3px solid #235cce;color:#52627a;font-size:14px}.mhv-equation code{color:#087967;background:#edf8f5;white-space:normal}.mhv-equation p{font-size:13px;margin:10px 0 0}.mhv-axis-callout{display:flex;flex-direction:column;gap:8px}.mhv-axis-callout strong{font:700 20px ui-monospace,SFMono-Regular,Consolas,monospace;color:#235cce}.mhv-axis-callout span{padding:5px 8px;background:#f5f8fd;border-radius:5px;font-size:12px}.mhv-nav{display:flex;justify-content:center;align-items:center;gap:12px;margin:16px 0 14px}.mhv-progress{font-size:12px;color:#52627a;min-width:96px;text-align:center}.mhv-legend{display:flex;flex-wrap:wrap;gap:15px;font-size:12px;color:#52627a;margin:8px 0 16px}.mhv-legend span{display:inline-flex;gap:6px;align-items:center}.mhv-dot{width:9px;height:9px;border-radius:50%;display:inline-block}.mhv-dot.head0{background:#75a9f1}.mhv-dot.head1{background:#e7a779}.mhv-dot.attention{background:#a895e4}.mhv-cheatsheet{border-top:1px solid #dce3ee;padding-top:16px}.mhv-cheatsheet h4{font-size:17px;margin-bottom:9px}.mhv-cheatsheet table{font-size:13px;background:#fff;border:1px solid #dce3ee}.mhv-cheatsheet td,.mhv-cheatsheet th{padding:9px 10px}.mhv-interview-answer{padding:12px 14px;border-radius:9px;background:#fff;border-left:3px solid #235cce;color:#52627a;font-size:14px;margin:16px 0 0}.mhv-interview-answer strong{color:#17233c}
      @media(max-width:900px){.mhv-flow{grid-template-columns:1fr 1fr}.mhv-flow .mhv-card:last-child:nth-child(3){grid-column:1 / -1;max-width:340px;justify-self:center;width:100%}.mhv-score-layout{grid-template-columns:1fr}.mhv-head-grid{gap:8px}}
      @media(max-width:700px){#multi-head-visualizer{padding:18px}.mhv-step-head{display:block}.mhv-code{display:inline-block;margin-top:8px}.mhv-split-flow{grid-template-columns:1fr}.mhv-big-arrow{display:flex;align-items:center;justify-content:center;gap:9px}.mhv-big-arrow span{transform:rotate(90deg)}.mhv-group-grid,.mhv-tensor>.mhv-head-grid,.mhv-head-grid{grid-template-columns:1fr}.mhv-flow{grid-template-columns:1fr}.mhv-flow .mhv-card:last-child:nth-child(3){grid-column:auto;max-width:none}.mhv-cheatsheet table{min-width:680px}}
      @media(max-width:430px){.mhv-dimension-strip{align-items:stretch;flex-direction:column}.mhv-dimension-strip i{text-align:center}.mhv-cheatsheet{overflow:hidden}}
    `;
    document.head.appendChild(style);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
