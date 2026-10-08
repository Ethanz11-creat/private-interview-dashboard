import { calculateRope, example, standardExample } from './rope-core.mjs';
import { numpyCode, torchCode } from './rope-code.mjs';

const $ = id => document.getElementById(id);
const escape = text => String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = n => Math.abs(n)<1e-12 ? '0' : Number.isInteger(n) ? String(n) : n.toFixed(6);

function explain(line,mode) {
  const t=line.trim(), torch=mode==='torch';
  if(t==='import numpy as np')return ['NumPy 数组','np 是数组库的别名；本题用它完成切片、广播、三角函数和逐元素运算。','输入和输出都是二维 (T,D) 数组。'];
  if(t==='import torch')return ['PyTorch 张量','将同样的 RoPE 公式写成张量运算。torch.empty_like、torch.cos 和切片赋值对应 NumPy 版本。','所有计算设置为 float64，方便核对。'];
  if(t.startsWith('from typing import'))return ['类型提示','List[List[float]] 描述二维输入；Optional 表示 positions 可以省略。它不会自动检查矩阵形状。','positions=None 时使用连续位置 0…T−1。'];
  if(t==='class Solution:')return ['题目接口','Solution 类承载题目要求的方法，计算不依赖对象状态。','调用 Solution().apply_rope(x, positions, base)。'];
  if(t.startsWith('def apply_rope'))return ['RoPE 主函数','输入二维 token 矩阵、可选位置和频率底数，返回同形状的旋转后矩阵。','(T,D) → (T,D)，D 必须为偶数。'];
  if(t.startsWith('self,')||t.startsWith('x:'))return ['输入参数','x 的每一行是一个 token；positions 给每行的位置；base 控制频率从快到慢的跨度。','x：(T,D)，positions：(T,)，base 是标量。'];
  if(t.startsWith('positions:'))return ['位置参数','可以传入连续位置，也可以传入缓存推理中的非连续 position ids。','None → [0,1,…,T−1]。'];
  if(t.startsWith('base:'))return ['频率底数','默认 10000 是常见配置。演示把它改成 100，让第二对通道的 0.1 弧度变化看得见。','必须大于 1。'];
  if(t.startsWith(') ->'))return ['返回类型','输出转回二维浮点列表，形状和输入 X 完全相同。','List[List[float]]，(T,D)。'];
  if(t.includes('np.asarray(')||t.includes('torch.tensor('))return [`转换 ${t.split('=')[0].trim()}`,torch?'把 Python 列表转为 float64 张量，后续可以访问 ndim、shape 并做广播。':'把输入转为 float64 数组；asarray 不会额外复制同 dtype 数组。','保留二维布局，不会把 token 和 feature 展平。'];
  if(t.startsWith('if X.ndim'))return ['检查二维输入','RoPE 的教学实现只处理 (T,D)；如果传入 batch 或 head 维度，必须先明确广播规则。','X.ndim 必须等于 2。'];
  if(t.startsWith('raise ValueError("x'))return ['形状错误','输入不是二维矩阵时主动报错，避免后续切片得到难以理解的广播错误。','异常类型 ValueError。'];
  if(t.startsWith('T, D ='))return ['读取两个轴','T 是 token 数，D 是每个 token 的特征数。后面的 position 负责 T 轴，频率负责 D/2 对通道。','本例 T=3，D=4。'];
  if(t.startsWith('if D %'))return ['检查偶数维度','每次旋转需要两个坐标；D 为奇数时最后一个通道没有搭档，不能静默丢弃。','D % 2 必须为 0。'];
  if(t.startsWith('raise ValueError("D'))return ['维度错误','明确告诉调用者为什么不能旋转奇数维，而不是返回一个缺列的结果。','异常类型 ValueError。'];
  if(t.startsWith('if base'))return ['检查底数','base 需要大于 1，才能形成从快到慢的正频率序列。','base<=1 直接拒绝。'];
  if(t.startsWith('raise ValueError("base'))return ['底数错误','防止 0、负数或其他非法底数进入幂运算。','异常类型 ValueError。'];
  if(t.startsWith('if positions is None'))return ['生成默认位置','没有传 position ids 时，按矩阵行号生成 0 到 T−1。','pos.shape=(T,)。'];
  if(t.startsWith('pos = np.arange'))return ['NumPy 连续位置','arange(T) 生成 [0,1,…,T−1]，dtype=float64 便于和频率相乘。','本例 [0,1,2]。'];
  if(t.startsWith('pos = torch.arange'))return ['PyTorch 连续位置','torch.arange 与 NumPy 的 arange 相同，返回 float64 张量。','本例 [0,1,2]。'];
  if(t.startsWith('else:'))return ['使用显式位置','如果传入 positions，就保留调用者给出的绝对位置；不要把它重新压成 0…T−1。','下一行会把它转为 float64。'];
  if(t.startsWith('pos = np.asarray')||t.startsWith('pos = torch.tensor'))return ['转换位置向量',torch?'位置列表转为 float64 张量，shape 必须是一维。':'位置列表转为 float64 数组，shape 必须是一维。','pos.shape=(T,)。'];
  if(t.startsWith('if pos.shape'))return ['校验位置长度','每一行 token 必须有一个位置。长度不一致时广播会把错误藏在角度矩阵里，因此提前报错。','必须是 (T,)。'];
  if(t.startsWith('raise ValueError("positions'))return ['位置形状错误','positions 既不能少，也不能比 token 多；它是角度矩阵的第一轴。','异常类型 ValueError。'];
  if(t.startsWith('inv_freq ='))return ['生成逆频率','arange(0,D,2) 选每个 pair 的偶数坐标下标 0、2、4…；除以 D 后取 base 的负幂。','D=4、base=100 → [1,0.1]。'];
  if(t.startsWith('angles ='))return ['位置 × 频率','pos[:,None] 是 (T,1)，inv_freq[None,:] 是 (1,D/2)，广播相乘得到每个 token、每个 pair 的角度。','(T,1) × (1,D/2) → (T,D/2)。'];
  if(t.startsWith('cos ='))return ['角度的 cos','三角函数按弧度逐元素计算；结果形状和 angles 相同。','cos.shape=(T,D/2)。'];
  if(t.startsWith('sin ='))return ['角度的 sin','与 cos 配套，组成二维旋转矩阵的四个系数。','sin.shape=(T,D/2)。'];
  if(t.startsWith('even ='))return ['取偶数列','切片 0::2 表示从第 0 列开始每隔 2 列，得到每对的第一个坐标。','(T,D) → (T,D/2)。'];
  if(t.startsWith('odd ='))return ['取奇数列','切片 1::2 得到每对的第二个坐标；它和 even 一一对应。','(T,D) → (T,D/2)。'];
  if(t.startsWith('out ='))return ['分配输出空间',torch?'torch.empty_like(X) 只创建同形状张量，后面两次切片赋值会覆盖全部元素。':'np.empty_like(X) 不初始化为零；后面两次切片赋值会覆盖全部偶数列和奇数列。','out.shape=(T,D)。'];
  if(t.startsWith('out[:, 0::2]'))return ['旋转后第一个坐标','对应 x′₂ᵢ = x₂ᵢ cosθ − x₂ᵢ₊₁ sinθ；逐元素相乘，形状仍是 (T,D/2)。','写回每对的偶数列。'];
  if(t.startsWith('out[:, 1::2]'))return ['旋转后第二个坐标','对应 x′₂ᵢ₊₁ = x₂ᵢ sinθ + x₂ᵢ₊₁ cosθ；和上一行一起完成二维旋转。','写回每对的奇数列。'];
  if(t.startsWith('return out'))return ['返回旋转结果','把数组或张量转回 Python 嵌套列表；没有 round，不会截断精度。','返回 (T,D)。'];
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
  $('detail-title').textContent=item.note[0];$('detail-code').textContent=item.code;$('detail-body').textContent=item.note[1];$('detail-shape').textContent=item.note[2];
  $('line-status').textContent=`${lineIndex+1} / ${lines[mode].length} 个非空代码行`;$('prev-line').disabled=lineIndex===0;$('next-line').disabled=lineIndex===lines[mode].length-1;
}
function setMode(next) {
  mode=next;$('code-lines').innerHTML=lines[mode].map((line,i)=>`<button type="button" class="code-line" data-line="${i}" aria-label="第 ${line.number} 行：${escape(line.note[0])}"><span class="line-no">${line.number}</span><span class="code-text">${escape(line.code)}</span></button>`).join('');
  $('code-label').textContent=mode==='numpy'?'RoPE · NumPy':'RoPE · PyTorch';
  for(const name of ['numpy','torch']){$(`tab-${name}`).classList.toggle('active',name===mode);$(`tab-${name}`).setAttribute('aria-pressed',String(name===mode));} renderLine(0);
}
$('code-lines').addEventListener('click',e=>{const b=e.target.closest('[data-line]');if(b)renderLine(Number(b.dataset.line));});
for(const name of ['numpy','torch'])$(`tab-${name}`).addEventListener('click',()=>setMode(name));
$('prev-line').addEventListener('click',()=>renderLine(lineIndex-1));$('next-line').addEventListener('click',()=>renderLine(lineIndex+1));
$('copy-code').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(sources[mode]+'\n');$('copy-status').textContent='已复制当前版本完整代码。';}catch{$('copy-status').textContent='浏览器暂不允许自动复制，请展开下方代码复制。';}});
$('full-numpy').textContent=numpyCode;$('full-torch').textContent=torchCode;setMode('numpy');

function asRows(value) { return Array.isArray(value[0]) ? value : [value]; }
function matrixBox(name,value,{rows='token',cols='feature',style='',highlightRow=-1,highlightCol=-1}={}) {
  const m=asRows(value);
  return `<article class="matrix-box ${escape(style)}"><h4>${escape(name)} · (${m.length},${m[0].length})</h4><div class="table-wrap"><table><thead><tr><th>${escape(rows)} / ${escape(cols)}</th>${m[0].map((_,j)=>`<th>${escape(cols)} ${j}</th>`).join('')}</tr></thead><tbody>${m.map((row,i)=>`<tr>${`<th>${escape(rows)} ${i}</th>`}${row.map((v,j)=>`<td class="${i===highlightRow&&j===highlightCol?'angle-highlight':''}">${fmt(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p>行：${escape(rows)}；列：${escape(cols)}。显示时舍入，计算保留完整精度。</p></article>`;
}
const matrixFor = (name,m,style='') => matrixBox(name,m,{style});
let current=calculateRope(example),stageIndex=0;
const stages=[
  ['1 输入','X 与 position id 对齐',()=>`X (${current.T},${current.D})；positions (${current.T},)`,'每一行是一个 token；位置向量决定这一行每一对通道的旋转角。',()=>matrixFor('X',example.X,'head-0')+matrixFor('positions',[example.positions],'shared'),()=>`第 0 行的位置是 0，所以它稍后不会改变；base=${current.base} 只影响频率。`],
  ['2 逆频率','不同通道 pair 使用不同旋转速度',()=>`inv_freq (${current.pairs},)`,'低下标 pair 频率高，后面的 pair 频率低。公式是 base 的负幂。',()=>matrixFor('inv_freq',[current.invFreq],'shared')+matrixFor('position × inv_freq',current.angles,'head-0'),()=>`D=${current.D} → ${current.pairs} 个 pair；base=${current.base} 时逆频率为 [${current.invFreq.map(fmt).join(', ')}]。`],
  ['3 sin / cos','把角度变成旋转矩阵系数',()=>`cos、sin (${current.T},${current.pairs})`,'同一位置的 cos 和 sin 与每个 pair 对齐，后面会和 even / odd 逐元素相乘。',()=>matrixFor('cos(angles)',current.cos,'head-0')+matrixFor('sin(angles)',current.sin,'shared'),()=>`位置 ${current.positions[0]} 的角度全是 0，因此 cos=1、sin=0。`],
  ['4 拆成 pair','偶数列和奇数列组成二维坐标',()=>`even / odd (${current.T},${current.pairs})`,'0::2 取每对第一个坐标，1::2 取每对第二个坐标；两者形状一致。',()=>matrixFor('even = X[:,0::2]',current.even,'head-0')+matrixFor('odd = X[:,1::2]',current.odd,'shared'),()=>`例如 token 1 的 pair 0 是 [${current.even[1][0]},${current.odd[1][0]}]，pair 1 是 [${current.even[1][1]},${current.odd[1][1]}]。`],
  ['5 旋转','每个 pair 独立套二维旋转矩阵',()=>`rotated (${current.T},${current.D})`,'偶数列使用 even*cos−odd*sin，奇数列使用 even*sin+odd*cos。',()=>matrixFor('X（输入）',example.X,'head-0')+matrixFor('X_rot（输出）',current.rotated,'shared'),()=>`选中 position ${Number($('trace-token').value)} 的 pair ${Number($('trace-pair').value)}，下方会展开这一次二维计算。`],
  ['6 范数检查','旋转改变方向，不改变每对长度',()=>`pair norms (${current.T},${current.pairs})`,'比较每个 pair 的 x_even²+x_odd²；旋转前后应只存在浮点误差级差异。',()=>matrixFor('before norms',current.pairNorms,'head-0')+matrixFor('after norms',current.rotatedPairNorms,'shared'),()=>`所有 pair 的平方范数相等（误差约为浮点计算误差），这是正交旋转的结果。`]
];
function renderStage(index) {
  stageIndex=Math.max(0,Math.min(stages.length-1,index));const s=stages[stageIndex];
  $('trace-title').textContent=s[1];$('trace-shape').textContent=s[2]();$('trace-text').textContent=s[3];$('trace-matrices').innerHTML=s[4]();$('trace-summary').textContent=s[5]();
  $('trace-progress').textContent=`${stageIndex+1} / ${stages.length}`;$('trace-prev').disabled=stageIndex===0;$('trace-next').disabled=stageIndex===stages.length-1;
  $('stage-buttons').querySelectorAll('button').forEach((b,i)=>{b.classList.toggle('active',i===stageIndex);b.setAttribute('aria-pressed',String(i===stageIndex));});
  renderPairDetail();
}
function renderPairDetail() {
  const t=Number($('trace-token').value),i=Number($('trace-pair').value),x0=example.X[t][2*i],x1=example.X[t][2*i+1],angle=current.angles[t][i],c=current.cos[t][i],s=current.sin[t][i],y0=current.rotated[t][2*i],y1=current.rotated[t][2*i+1];
  $('pair-detail').innerHTML=`position ${t} 的 pair ${i}（通道 ${2*i}/${2*i+1}）：角度 θ=${fmt(angle)}，cosθ=${fmt(c)}，sinθ=${fmt(s)}。<br><strong>[${fmt(x0)}, ${fmt(x1)}] → [${fmt(x0)}×${fmt(c)} − ${fmt(x1)}×${fmt(s)}, ${fmt(x0)}×${fmt(s)} + ${fmt(x1)}×${fmt(c)}] = [${fmt(y0)}, ${fmt(y1)}]</strong>`;
}
$('stage-buttons').innerHTML=stages.map((s,i)=>`<button type="button" class="btn" data-stage="${i}">${s[0]}</button>`).join('');
$('stage-buttons').addEventListener('click',e=>{const b=e.target.closest('[data-stage]');if(b)renderStage(Number(b.dataset.stage));});
$('trace-prev').addEventListener('click',()=>renderStage(stageIndex-1));$('trace-next').addEventListener('click',()=>renderStage(stageIndex+1));
function refreshBase() { current=calculateRope(Number($('trace-base').value)===100?example:standardExample);renderStage(stageIndex); }
$('trace-base').addEventListener('change',refreshBase);$('trace-token').addEventListener('change',renderPairDetail);$('trace-pair').addEventListener('change',renderPairDetail);renderStage(0);
