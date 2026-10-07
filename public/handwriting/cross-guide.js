import { calculateCross, example, rectangularExample } from './cross-core.mjs';
import { numpyCode, torchCode } from './cross-code.mjs';

const $ = id => document.getElementById(id);
const escape = text => String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = n => Math.abs(n)<1e-12 ? '0' : Number.isInteger(n) ? String(n) : n.toFixed(6);

function explain(line,mode) {
  const t=line.trim(), torch=mode==='torch';
  if(t==='import numpy as np')return ['NumPy 数组运算','np 是库的别名。用 asarray 转换输入，用 @ 做矩阵乘法，再逐行计算稳定 Softmax。','本题所有计算对象均为二维矩阵或一维偏置。'];
  if(t==='import math')return ['平方根缩放','引入 math.sqrt，计算 Key 特征维度 d_k 的平方根。','d_k=4，math.sqrt(d_k)=2。'];
  if(t==='import torch')return ['PyTorch 张量','引入张量库，矩阵运算与 NumPy 版一致，用 torch.softmax 完成归一化。','不是多头实现：没有 batch 或 head 轴。'];
  if(t==='from typing import List')return ['类型提示','二维浮点列表用 List[List[float]] 标注。类型提示不自动验证尺寸，也不会改变计算精度。','输入、输出都是二维 Python 列表。'];
  if(t==='class Solution:')return ['题目接口','Solution 类提供题目要求的方法，计算不依赖额外实例状态。','Solution().cross_attention(...)'];
  if(t.startsWith('def '))return ['交叉注意力方法','接收两条序列、三组投影参数与输出投影参数，返回每个 Query 的输出。','参数顺序与题干一致。'];
  if(t.startsWith('self, X_Q:'))return ['两条序列','X_Q 提供查询；X_K 提供被检索的 Key 和 Value。两条序列的长度不必相同，但本题输入特征维度相同。','X_Q：(T_Q,M)；X_K：(T_K,M)。原题均为 (2,4)。'];
  for(const letter of ['Q','K','V','O'])if(t.startsWith(`W_${letter}:`))return [`${letter} 的权重与偏置`,letter==='Q'?'W_Q 只用于 X_Q 的查询投影。':letter==='K'||letter==='V'?`W_${letter} 用于 X_K；Key 和 Value 来源相同，但投影参数不同。`:'W_O 对读取结果 H 做特征混合，b_O 加到每一行。','权重 (4,4)，偏置 (4,)；+ 偏置沿 token 行广播。'];
  if(t.startsWith(') ->'))return ['返回类型','二维浮点列表对应最终 O。形状跟随 Query 序列，不跟随 Key 序列。','O：(T_Q,M)。'];
  if(t.includes('np.asarray(')||t.includes('torch.tensor(')) {
    const name=t.split('=')[0].trim();
    return [`转换 ${name}`,torch?'把 Python 列表复制为 float64 张量，支持矩阵乘法、shape 和 Softmax。':'将输入转为 float64 数组；若已是同类型数组，asarray 可能复用原数据。后续操作没有原地改写输入。',name==='X_Q'?'查询序列 (T_Q,M)=(2,4)':name==='X_K'?'Key/Value 序列 (T_K,M)=(2,4)':name.startsWith('b_')?'偏置向量 (M,)=(4,)':'投影矩阵 (M,M)=(4,4)'];
  }
  if(t.startsWith('Q ='))return ['Query 来自 X_Q','@ 将每个查询 token 的输入特征线性组合，再给每行加 b_Q。不要误写为 X_K。','Q=[[2,0,1,1],[0,2,1,1]]；(T_Q,M)=(2,4)。'];
  if(t.startsWith('K ='))return ['Key 来自 X_K','对信息侧序列独立做 Key 投影，提供用来匹配 Query 的向量。','K=[[1,2,1,0],[1,1,1,1]]；(T_K,M)=(2,4)。'];
  if(t.startsWith('V ='))return ['Value 也来自 X_K','V 与 K 读取同一条输入，但使用 W_V。不是用 X_Q，也不是在 K 上继续投影。','V=[[2,1,0,1],[1,2,1,0]]；(T_K,M)=(2,4)。'];
  if(t.startsWith('d_k ='))return ['读取 Key 特征宽度','shape[0] 是 Key token 数，shape[1] 才是特征数。这里不分头，所以等于 d_model。','K.shape=(2,4)，d_k=4，√d_k=2。'];
  if(t.startsWith('S = S -'))return ['每个 Query 减自己的最大值','axis=-1 沿 Key 列求 max；keepdims=True 保留一列，把最大值广播到其所在行。保证指数不溢出，同时保持 Softmax 分布不变。','[[1.5,2],[2.5,2]] − [[2],[2.5]] = [[-0.5,0],[0,-0.5]]。'];
  if(t.startsWith('S ='))return ['得到 Query × Key 分数矩阵','K.T 将 Key 的 token 轴移到列。Q 的每行与 K 的每行点积，然后除 √d_k。','(T_Q,M)@(M,T_K) → (T_Q,T_K)。原题 S=[[1.5,2],[2.5,2]]。'];
  if(t.startsWith('exp_S ='))return ['每项取指数','np.exp 是逐元素指数，不是矩阵指数。上一行已将最大项移到 0，每行至少有 exp(0)=1。','exp_S≈[[0.606531,1],[1,0.606531]]；(2,2)。'];
  if(t.startsWith('A = exp_S'))return ['除以每行自己的分母','np.sum 沿最后一轴把一行的指数相加，keepdims 保留 (T_Q,1)，再广播相除。','分母≈[[1.606531],[1.606531]]；A≈[[0.377541,0.622459],[0.622459,0.377541]]。'];
  if(t.startsWith('A = torch.softmax'))return ['沿 Key 轴稳定 Softmax','dim=-1 对二维 S 的列归一化，等价于 NumPy 的减 max、exp、除行 sum。每个 Query 有自己的概率分布。','A≈[[0.377541,0.622459],[0.622459,0.377541]]；每行和为 1。'];
  if(t.startsWith('H ='))return ['权重读取 Value','A 的每行按位置给 V 的所有行加权。一行 A 对应一个 Query，产生一行 H。','(T_Q,T_K)@(T_K,M) → (T_Q,M)。H[0]≈[1.377541,1.622459,0.622459,0.377541]。'];
  if(t.startsWith('O ='))return ['输出线性投影','W_O 混合读取结果的特征，b_O 加到每行。这里不再 Softmax，因此 O 不受概率范围限制。','O[0]≈[2,2,1.755081,2.244919]；O.shape=(T_Q,M)。'];
  if(t==='return O.tolist()')return ['返回二维列表','转回题目要求的嵌套浮点列表，保留计算精度。不要把样例的两位小数舍入放进算法。','返回 T_Q 行，每行 M 个浮点数。'];
  throw new Error(`Missing line explanation: ${t}`);
}

const sources={numpy:numpyCode,torch:torchCode};
const lines=Object.fromEntries(Object.entries(sources).map(([mode,source])=>[mode,source.split('\n').map((code,i)=>({code,number:i+1})).filter(x=>x.code.trim()).map(x=>({...x,note:explain(x.code,mode)}))]));
let mode='numpy',lineIndex=0;
function renderLine(index) {
  lineIndex=Math.max(0,Math.min(lines[mode].length-1,index));
  const item=lines[mode][lineIndex];
  $('code-lines').querySelectorAll('button').forEach((b,i)=>{b.classList.toggle('active',i===lineIndex);b.setAttribute('aria-pressed',String(i===lineIndex));});
  $('detail-kicker').textContent=`${mode==='numpy'?'NUMPY':'PYTORCH'} / 第 ${item.number} 行`;
  $('detail-title').textContent=item.note[0];$('detail-code').textContent=item.code;
  $('detail-body').textContent=item.note[1];$('detail-shape').textContent=item.note[2];
  $('line-status').textContent=`${lineIndex+1} / ${lines[mode].length} 个非空代码行`;
  $('prev-line').disabled=lineIndex===0;$('next-line').disabled=lineIndex===lines[mode].length-1;
}
function setMode(next) {
  mode=next;
  $('code-lines').innerHTML=lines[mode].map((line,i)=>`<button type="button" class="code-line" data-line="${i}" aria-label="第 ${line.number} 行：${escape(line.note[0])}"><span class="line-no">${line.number}</span><span class="code-text">${escape(line.code)}</span></button>`).join('');
  $('code-label').textContent=mode==='numpy'?'NumPy · 稳定逐行 Softmax':'PyTorch · torch.softmax';
  for(const name of ['numpy','torch']){$(`tab-${name}`).classList.toggle('active',name===mode);$(`tab-${name}`).setAttribute('aria-pressed',String(name===mode));}
  renderLine(0);
}
$('code-lines').addEventListener('click',e=>{const b=e.target.closest('[data-line]');if(b)renderLine(Number(b.dataset.line));});
for(const name of ['numpy','torch'])$(`tab-${name}`).addEventListener('click',()=>setMode(name));
$('prev-line').addEventListener('click',()=>renderLine(lineIndex-1));$('next-line').addEventListener('click',()=>renderLine(lineIndex+1));
$('copy-code').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(sources[mode]+'\n');$('copy-status').textContent='已复制当前版本完整代码。';}catch{$('copy-status').textContent='浏览器暂不允许自动复制，请展开下方完整实现，选中代码复制。';}});
$('full-numpy').textContent=numpyCode;$('full-torch').textContent=torchCode;setMode('numpy');

function matrixBox(name,m,{rows='Query',cols='feature',style='',selectedRow=-1,selectedCol=-1}={}) {
  return `<article class="matrix-box ${escape(style)}"><h4>${escape(name)} · (${m.length},${m[0].length})</h4><div class="table-wrap"><table><thead><tr><th scope="col">${escape(rows)} / ${escape(cols)}</th>${m[0].map((_,j)=>`<th scope="col">${escape(cols)} ${j}</th>`).join('')}</tr></thead><tbody>${m.map((row,i)=>`<tr class="${i===selectedRow?'selected-query':''}"><th scope="row">${escape(rows)} ${i}</th>${row.map((v,j)=>`<td class="${i===selectedRow&&j===selectedCol?'cell-focus':''}">${fmt(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p>行：${escape(rows)}；列：${escape(cols)}。数值仅在显示时舍入。</p></article>`;
}
let data=example,r=calculateCross(data),stageIndex=0;
const qBox=(name,m)=>matrixBox(name,m,{style:'head-0'});
const kvBox=(name,m)=>matrixBox(name,m,{rows:'Key/Value',style:'shared'});
const scoreBox=(name,m)=>matrixBox(name,m,{rows:'Query',cols:'Key'});
const stages=[
  ['1 输入','两条输入：查询侧与信息侧',()=>`X_Q (${r.TQ},${r.M})；X_K (${r.TK},${r.M})`,'查询侧生成 Q；信息侧用两套权重分别生成 K 和 V。',()=>qBox('X_Q',data.XQ)+kvBox('X_K',data.XK),()=>`当前 T_Q=${r.TQ}、T_K=${r.TK}，M=4。两种序列长度独立。`],
  ['2 投影','Q、K、V 保留各自来源的行数',()=>`Q (${r.TQ},4)；K/V (${r.TK},4)`,'@ 是矩阵乘法。各投影读取对应输入的全部特征，再给每行加偏置。',()=>qBox('Q = X_Q @ W_Q',r.Q)+kvBox('K = X_K @ W_K',r.K)+kvBox('V = X_K @ W_V',r.V),()=>`K 和 V 一一对应 ${r.TK} 个信息位置，但数值不同；Q 有 ${r.TQ} 个查询位置。`],
  ['3 得分','Query 对所有 Key 的匹配矩阵',()=>`S (${r.TQ},${r.TK})`,'K.T 将 Key 位置放到列；Q @ K.T 先得到原始点积，再除 √4=2。',()=>qBox('Q',r.Q)+matrixBox('K.T',r.KT,{rows:'feature',cols:'Key',style:'shared'})+scoreBox('Q @ K.T（缩放前）',r.raw)+scoreBox('S（缩放后）',r.S),()=>`每行对应一个 Query，每列对应一个 Key。本例 S[0,1]=[2,0,1,1]·[1,1,1,1]/2=2。`],
  ['4 稳定 Softmax','行最大值 → 移位 → 指数 → 分母 → 权重',()=>`A (${r.TQ},${r.TK})`,'每个 Query 在自己的 Key 轴上归一化，得到一行概率分布。',()=>matrixBox('行最大值',r.maxima,{cols:'max'})+scoreBox('S − 行最大值',r.shifted)+scoreBox('exp(S − max)',r.E)+matrixBox('每行指数和',r.sums,{cols:'sum'})+scoreBox('A',r.A),()=>`每行都有 ${r.TK} 个权重，和为 1。扩展示例改变了分母，不是只给原题权重补一个值。`],
  ['5 读取 V','A 的每行读取全部 Value 向量',()=>`H (${r.TQ},4)`,'H = A @ V。Query i 用 A[i,j] 对 V[j] 加权求和。',()=>scoreBox('A',r.A)+kvBox('V',r.V)+qBox('H = A @ V',r.H),()=>`求和消去 ${r.TK} 个 Key/Value 位置，保留 ${r.TQ} 个 Query 位置和 4 个特征。`],
  ['6 输出','读取结果再经过输出线性投影',()=>`O (${r.TQ},4)`,'O = H @ W_O + b_O。本题 b_O 为零，输出不是概率矩阵。',()=>qBox('H',r.H)+matrixBox('W_O',data.WO,{rows:'input',cols:'output'})+qBox('O（完整精度计算）',r.O),()=>data===example?'原题显示两位小数：[[2.00,2.00,1.76,2.24],[2.00,2.00,2.24,1.76]]。':'这是增加第 3 个 Key/Value 后重新计算的结果；最终仍是 2 行，不会变成 3 行。']
];
function renderStage(index) {
  stageIndex=Math.max(0,Math.min(stages.length-1,index));const s=stages[stageIndex];
  $('trace-title').textContent=s[1];$('trace-shape').textContent=s[2]();$('trace-text').textContent=s[3];
  $('trace-matrices').innerHTML=s[4]();$('trace-summary').textContent=s[5]();
  $('trace-progress').textContent=`${stageIndex+1} / ${stages.length}`;
  $('trace-prev').disabled=stageIndex===0;$('trace-next').disabled=stageIndex===stages.length-1;
  $('stage-buttons').querySelectorAll('button').forEach((b,i)=>{b.classList.toggle('active',i===stageIndex);b.setAttribute('aria-pressed',String(i===stageIndex));});
}
function renderWeights() {
  const token=Number($('weight-token').value),weights=r.A[token];
  $('weights').innerHTML=weights.map((w,j)=>`<div class="weight-row"><span>Key ${j}</span><div class="bar"><div class="fill" style="width:${w*100}%"></div></div><span>${fmt(w)}</span></div>`).join('');
  $('weighted-output').textContent=`Query ${token}：${weights.map((w,j)=>`${fmt(w)} × [${r.V[j].map(fmt).join(', ')}]`).join(' + ')} = [${r.H[token].map(fmt).join(', ')}]。这是 H，尚未经过 W_O。`;
}
$('stage-buttons').innerHTML=stages.map((s,i)=>`<button type="button" class="btn" data-stage="${i}">${s[0]}</button>`).join('');
$('stage-buttons').addEventListener('click',e=>{const b=e.target.closest('[data-stage]');if(b)renderStage(Number(b.dataset.stage));});
$('trace-prev').addEventListener('click',()=>renderStage(stageIndex-1));$('trace-next').addEventListener('click',()=>renderStage(stageIndex+1));
$('trace-example').addEventListener('change',()=>{data=$('trace-example').value==='original'?example:rectangularExample;r=calculateCross(data);renderStage(stageIndex);renderWeights();});
$('weight-token').addEventListener('change',renderWeights);renderStage(0);renderWeights();

const axis=calculateCross(rectangularExample);
function renderAxis() {
  const i=Number($('axis-query').value),j=Number($('axis-key').value);
  $('axis-matrix').innerHTML=matrixBox('扩展示例 S · axis=0 是行，axis=1/-1 是列',axis.S,{rows:'Query',cols:'Key',selectedRow:i,selectedCol:j});
  $('axis-explanation').textContent=`固定 Query ${i}，这一行比较 Key 0、1、2：S[${i}]=[${axis.S[i].map(fmt).join(', ')}]。选中 S[${i},${j}]=${fmt(axis.S[i][j])}，由 Q[${i}]=[${axis.Q[i].join(', ')}] 与 K[${j}]=[${axis.K[j].join(', ')}] 点积后除 2 得到；逐行 Softmax 后 A[${i},${j}]=${fmt(axis.A[i][j])}。`;
}
$('axis-query').addEventListener('change',renderAxis);$('axis-key').addEventListener('change',renderAxis);renderAxis();
