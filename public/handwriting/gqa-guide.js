import { calculateGqa, example, groupMapping } from './gqa-core.mjs';
import { numpyCode, torchCode } from './gqa-code.mjs';

const $ = id => document.getElementById(id);
const escape = text => String(text).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = n => Math.abs(n)<1e-12 ? '0' : Number.isInteger(n) ? String(n) : n.toFixed(6);
const result = calculateGqa(example);

function explain(line, mode) {
  const t=line.trim(), torch=mode==='torch';
  if(t==='import math')return ['数学工具','引入 math.sqrt，用每头维度 d_k 的平方根缩放得分。','sqrt(2) ≈ 1.414214'];
  if(t==='import numpy as np')return ['NumPy','np 是库的别名，后续 asarray、empty、exp 等都从这个库调用。','此版本按 Query head 循环，每次处理二维矩阵。'];
  if(t==='import torch')return ['PyTorch','使用张量、repeat_interleave 和批量矩阵乘法。所有数值设为 float64，便于核对小样例。','此版本一次处理所有 h_q 个 Query head。'];
  if(t==='from typing import List')return ['类型提示','List[List[float]] 表示二维浮点列表。类型注解帮助理解接口，本身不会自动验证矩阵尺寸。','输入 X 为二维列表，输出 O.tolist() 也是二维列表。'];
  if(t==='class Solution:')return ['题目接口','Solution 类承载题目要求的方法，计算不依赖其他对象状态。','调用：Solution().grouped_query_attention(...)'];
  if(t.startsWith('def '))return ['方法名','定义分组查询注意力方法。参数顺序与题干保持一致，后续先转数组／张量再计算。','输入：X、Q/K/V 权重与偏置、h_q、h_k、输出权重与偏置。'];
  if(t.includes('self, X:'))return ['输入序列','self 是实例；X 的每一行是一个 token，列是 d_model 个原始特征。','本例 X.shape = (2,4)'];
  for(const letter of ['Q','K','V','O'])if(t.startsWith(`W_${letter}:`))return [`${letter} 的权重与偏置`,letter==='K'||letter==='V'?'K/V 的投影宽度是 h_k*d_k。每个 token 仍读取完整 X，不是把输入预先切小。':'Q 与输出投影都是 d_model×d_model；偏置沿所有 token 行广播。',letter==='K'||letter==='V'?'权重 (4,2)，偏置 (2,)':'权重 (4,4)，偏置 (4,)'];
  if(t.startsWith('h_q:'))return ['两种 head 数','h_q 是 Query 头数；h_k 是 K/V 头数。要求正整数、h_q 能被 h_k 整除、d_model 能被 h_q 整除。','本例 h_q=2，h_k=1'];
  if(t.startsWith(') ->'))return ['返回类型','方法返回二维浮点列表。仅标注接口，不会让程序自动四舍五入。','返回形状 (T,d_model) = (2,4)'];
  if(t.includes('np.asarray(')||t.includes('torch.tensor(')){
    const variable=t.split('=')[0].trim();
    const narrow=/^(WK|WV|bK|bV|W_K|W_V|b_K|b_V)$/.test(variable);
    const isBias=/^b/.test(variable);
    return [`转换 ${variable}`,torch?'将 Python 列表复制为 float64 张量，保留原始行列布局。':'将列表转为 float64 数组；已是相同 dtype 的数组时，asarray 可能复用原数据。这段代码不原地改写输入。',narrow?(isBias?'偏置 (2,)':'K/V 投影权重 (4,2)'):(isBias?'偏置 (4,)':variable==='X'||variable==='Xn'?'输入序列 (2,4)':'投影权重 (4,4)')];
  }
  if(t.startsWith('T, d_model'))return ['读取序列与特征维度','shape 返回各轴长度，解包给 T、d_model。还没有进行拆头。','T=2，d_model=4'];
  if(t.startsWith('d_k ='))return ['每头维度','Query 的 d_model 维特征均分成 h_q 份，所以 d_k=d_model//h_q。整除依赖题目保证，不能改成除以 h_k。','4 // 2 = 2'];
  if(t.startsWith('group_size ='))return ['每组 Query 数','每组共有 h_q//h_k 个连续的 Query head，之后用这个数找到共享 K/V 组。','2 // 1 = 2：Q_0、Q_1 共用 KV_0'];
  if(t.startsWith('inv_sqrt'))return ['提前计算缩放因子','算出 1/√d_k，让循环内的每个 head 直接乘这个因子。与最后除以 √d_k 等价。','1/√2 ≈ 0.707107'];
  if(/^[QKV] =/.test(t)){
    const letter=t[0];
    return [`${letter} 线性投影`,'@ 是矩阵乘法；+ 偏置把同一向量加到每行。不是逐元素乘，也不是只读取某一组输入列。',letter==='Q'?'Q=[[2,2,1,3],[1,1,2,0]]；(2,4)':letter==='K'?'K=[[2,3],[1,1]]；(2,2)':'V=[[1,1],[1,2]]；(2,2)'];
  }
  if(/^[QKV]h = .*reshape/.test(t)){
    const q=t[0]==='Q';
    return [q?'拆 Query heads':'拆较少的 K/V heads',torch?'reshape 先将每个 token 的特征按 head 分组；transpose(0,1) 交换 token、head 两轴。':'reshape 先按 (token,head,feature) 分组；transpose(1,0,2) 指定新轴顺序 (head,token,feature)。',q?'(2,4) → (2,2,2) → (2,2,2)，Q_0=[[2,2],[1,1]]，Q_1=[[1,3],[2,0]]':'(2,2) → (2,1,2) → (1,2,2)：只有一组，包含全部 token。'];
  }
  if(t.includes('repeat_interleave'))return ['连续展开共享 K/V','沿 head 轴将每一组分别连续重复 group_size 次，以便对齐 Qh。这里会创建展开的临时张量；不是重新学习两份 K/V。','(h_k,T,d_k)=(1,2,2) → (h_q,T,d_k)=(2,2,2)。h_k=2、s=2 时顺序是 [KV0,KV0,KV1,KV1]。'];
  if(t.startsWith('Hh = np.empty'))return ['分配各头输出空间','empty 不保证全零，它只分配尚未初始化的数组。必须让循环把全部 h_q 个 head 都写完。','Hh.shape=(h_q,T,d_k)=(2,2,2)'];
  if(t.startsWith('for i '))return ['遍历 Query heads','循环次数为 h_q，不能用 h_k：每个 Query 都需要自己的输出。','本例 i=0、1，循环体每次写入 Hh[i]。'];
  if(t.startsWith('g ='))return ['找到共享组','用整数除法把相邻 Query head 归到同一 KV 组。这里不是取余，也不是按 token 下标选组。','i=0、1 时 g=i//2=0；h_q=8、h_k=2 时为 [0,0,0,0,1,1,1,1]。'];
  if(t==='Qi = Qh[i]')return ['选当前 Query head','取出当前 Query 的全部 T 行。Q_0、Q_1 是不同的投影特征，所以共享 K/V 也可产生不同的权重。','Qi.shape=(T,d_k)=(2,2)'];
  if(t==='Ki = Kh[g]')return ['读取共享 Key head','g 指向 KV 组。整份 (T,d_k) Key 都提供给当前 Query，不再在组内切成更小的块。','原题两次都读取 K_0=[[2,3],[1,1]]。'];
  if(t==='Vi = Vh[g]')return ['读取共享 Value head','每个 Query 用相同组的 V 进行加权。Key 和 Value 必须使用一致的组下标 g。','原题两次都读取 V_0=[[1,1],[1,2]]。'];
  if(t.startsWith('scores =')&&!t.includes('scores -'))return ['缩放点积得分',torch?'Kh.transpose(-2,-1) 只交换每头的矩阵最后两轴；@ 对齐 head 轴做批量矩阵乘法。':'Ki 是二维矩阵，Ki.T 将其转成 (d_k,T)，@ 得到每个 Query token 对所有 Key token 的得分。',torch?'(h_q,T,d_k)@(h_q,d_k,T) → (h_q,T,T)=(2,2,2)':'(T,d_k)@(d_k,T) → (T,T)=(2,2)，再乘 1/√d_k。'];
  if(t.startsWith('scores = scores -'))return ['逐行减最大值','scores.max 是数组方法。axis=1 沿 Key 列归约；keepdims=True 保持一列，广播回自己的整行。减最大值不改变 Softmax，却避免大正数指数溢出。','head 0 最大值=[[7.071068],[3.535534]]；移位后=[[0,-4.242641],[0,-2.121320]]。'];
  if(t==='attn = np.exp(scores)')return ['逐元素指数','np.exp 对每个得分取指数，不是矩阵指数。每行最大项已经移到 0，因此至少有一个 exp(0)=1。','输入、输出形状同为 (T,T)；所有指数为非负数。'];
  if(t.startsWith('attn = attn /'))return ['每行除自己的指数和','sum(axis=1,keepdims=True) 求每个 Query 对全部 Key 的指数和，保留 (T,1)。广播后逐元素相除，得到归一化概率。','A_0≈[[0.985834,0.014166],[0.892958,0.107042]]，每行和为 1。'];
  if(t.startsWith('attn = torch.softmax'))return ['沿最后一维 Softmax','scores 是 (head,Query,Key)，dim=-1 是 Key 轴。torch.softmax 已实现稳定的逐行归一化，不用再手动除分母。','每个 head、每个 Query 的 Key 权重和为 1；不同 head 可以不同。'];
  if(t==='Hh[i] = attn @ Vi'||t==='Hh = attn @ Vh')return ['用权重加权 Value','每个 Query token 的输出是这组 V 的各 token 向量按注意力权重求和。这里是矩阵乘法，不是直接将 attn 与 V 按元素相乘。',torch?'(h_q,T,T)@(h_q,T,d_k) → (h_q,T,d_k)=(2,2,2)':'(T,T)@(T,d_k) → (T,d_k)；写入 Hh[i]。'];
  if(t.startsWith('H ='))return ['拼回同一 token 的各头','先把 head、token 两轴交换，使同一个 token 的所有头挨在一起，再将 head 与 feature 合并。直接 reshape 虽能得到相同形状，却会拼错 token。','(h_q,T,d_k) → (T,h_q,d_k) → (T,d_model)。H[0]=[1,1.014166,1,1.007035]。'];
  if(t.startsWith('O ='))return ['输出投影','给拼接后的 H 乘 W_O，再给每个 token 加相同的 b_O。输出层可以混合来自不同 Query head 的特征。','(2,4)@(4,4)+(4,) → (2,4)。第一行约 [2,2.021201,2.007035,2.014166]。'];
  if(t==='return O.tolist()')return ['返回二维浮点列表','将数组／张量转为 Python 嵌套列表，满足题目接口。两位小数仅是样例展示，不在这里截断精度。','返回 List[List[float]]，形状仍为 (T,d_model)。'];
  throw new Error(`Missing line explanation: ${t}`);
}

const sources={numpy:numpyCode,torch:torchCode};
const lines=Object.fromEntries(Object.entries(sources).map(([mode,source])=>[mode,source.split('\n').map((code,i)=>({code,number:i+1})).filter(x=>x.code.trim()).map(x=>({...x,note:explain(x.code,mode)}))]));
let mode='numpy', lineIndex=0;
function renderLine(index) {
  lineIndex=Math.max(0,Math.min(lines[mode].length-1,index));
  const item=lines[mode][lineIndex];
  document.querySelectorAll('.code-line').forEach((button,i)=>{button.classList.toggle('active',i===lineIndex);button.setAttribute('aria-pressed',String(i===lineIndex));});
  $('detail-kicker').textContent=`${mode==='numpy'?'NUMPY':'PYTORCH'} / 第 ${item.number} 行`;
  $('detail-title').textContent=item.note[0];
  $('detail-code').textContent=item.code;
  $('detail-body').textContent=item.note[1];
  $('detail-shape').textContent=item.note[2];
  $('line-status').textContent=`${lineIndex+1} / ${lines[mode].length} 个非空代码行`;
  $('prev-line').disabled=lineIndex===0;
  $('next-line').disabled=lineIndex===lines[mode].length-1;
}
function setMode(next) {
  mode=next;
  $('code-lines').innerHTML=lines[mode].map((line,i)=>`<button type="button" class="code-line" data-line="${i}" aria-label="第 ${line.number} 行：${escape(line.note[0])}"><span class="line-no">${line.number}</span><span class="code-text">${escape(line.code)}</span></button>`).join('');
  $('code-label').textContent=mode==='numpy'?'NumPy · 按 Query head 循环':'PyTorch · 批量张量运算';
  for(const name of ['numpy','torch']){$(`tab-${name}`).classList.toggle('active',name===mode);$(`tab-${name}`).setAttribute('aria-pressed',String(name===mode));}
  renderLine(0);
}
$('code-lines').addEventListener('click',e=>{const button=e.target.closest('[data-line]');if(button)renderLine(Number(button.dataset.line));});
for(const name of ['numpy','torch'])$(`tab-${name}`).addEventListener('click',()=>setMode(name));
$('prev-line').addEventListener('click',()=>renderLine(lineIndex-1));
$('next-line').addEventListener('click',()=>renderLine(lineIndex+1));
$('copy-code').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(sources[mode]+'\n');$('copy-status').textContent='已复制当前版本完整代码。';}catch{$('copy-status').textContent='浏览器暂不允许自动复制，请展开下方完整实现，选中代码复制。';}});
$('full-numpy').textContent=numpyCode;
$('full-torch').textContent=torchCode;
setMode('numpy');

function renderMapping() {
  const hk=Number($('mapping-kv').value),mapping=groupMapping(8,hk),size=8/hk;
  $('group-map').innerHTML=Array.from({length:hk},(_,g)=>`<article class="kv-group"><h4>共享组 ${g} · K_${g} / V_${g}</h4><div class="query-heads">${mapping.flatMap((kv,i)=>kv===g?[`<span class="query-tag">Q_${i}</span>`]:[]).join('')}</div><p>↓ ${size} 个 Query 各自计算 A_i，读取同一整份 K_${g}、V_${g}。</p></article>`).join('');
  $('mapping-summary').textContent=`h_q=8，h_k=${hk}，group_size=${size}。g(i) 映射：[${mapping.join(', ')}]。每个 Query 都保留独立输出，最后仍拼接 8 个输出头。`;
}
$('mapping-kv').addEventListener('change',renderMapping);renderMapping();

function matrixBox(name,m,{rows='token',cols='feature',style='',hint=''}={}) {
  return `<article class="matrix-box ${style}"><h4>${escape(name)} <span class="shape-badge">(${m.length},${m[0].length})</span></h4><div class="table-wrap"><table><thead><tr><th>${rows} / ${cols}</th>${m[0].map((_,i)=>`<th>${cols} ${i}</th>`).join('')}</tr></thead><tbody>${m.map((row,i)=>`<tr><th>${rows} ${i}</th>${row.map(x=>`<td>${fmt(x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>${hint?`<p>${escape(hint)}</p>`:''}</article>`;
}
const heads=(name,tensor,options={})=>tensor.map((m,i)=>matrixBox(`${name}_${i}`,m,{...options,style:`head-${i}`})).join('');
const r=result;
const stages=[
  ['1 投影','Q、K、V：Query 保持 4 列，K/V 只有 2 列','Q (2,4)；K/V (2,2)','X 的所有 4 列参与每次投影，偏置加到每一行。',()=>matrixBox('Q',r.Q)+matrixBox('K',r.K,{style:'shared'})+matrixBox('V',r.V,{style:'shared'}),'原题 h_k=1、d_k=2，所以 K/V 的总宽度就是 1×2=2。'],
  ['2 拆头','两个 Query heads，一个 Key / Value head','Qh (2,2,2)；Kh/Vh (1,2,2)','Q 沿列分为 Q_0、Q_1；K/V 只有一组，但保留两个 token。',()=>heads('Q',r.Qh)+matrixBox('K_0（共享）',r.Kh[0],{style:'shared'})+matrixBox('V_0（共享）',r.Vh[0],{style:'shared'}),'每个 head 都包含全部 token；head 0 和 head 1 不是句子的前后两段。'],
  ['3 共享映射','Q_0、Q_1 都使用 K_0 和 V_0','g(i)=[0,0]','group_size=2；0//2=0，1//2=0。K_0 不再被组内切分。',()=>heads('Q',r.Qh)+matrixBox('K_0 ← 两个 Q 共享',r.Kh[0],{style:'shared'})+matrixBox('V_0 ← 两个 Q 共享',r.Vh[0],{style:'shared'}),'K/V 相同，Query 不同。后续每个 head 都单独算一份得分和 Softmax。'],
  ['4 得分','每个 Query head 都生成一个 T×T 得分矩阵','S (2,2,2)','S_i = Q_i @ K_0.T / √2。行是 Query，列是 Key。',()=>heads('S',r.S,{rows:'Query',cols:'Key'}),'Q_0 的 token 0 是 [2,2]，与 K_0 的 [2,3] 点积为 10，与 [1,1] 点积为 4，再各除以 √2。'],
  ['5 Softmax','每行减最大值 → 指数 → 行分母 → 权重','A (2,2,2)','每个 head 的每个 Query token 沿 Key 列归一化。',()=>r.A.map((a,i)=>matrixBox(`S_${i} 移位后`,r.shifted[i],{rows:'Query',cols:'Key',style:`head-${i}`})+matrixBox(`exp(S_${i})`,r.E[i],{rows:'Query',cols:'Key',style:`head-${i}`})+matrixBox(`行分母_${i}`,r.sums[i],{rows:'Query',cols:'sum',style:`head-${i}`})+matrixBox(`A_${i}`,a,{rows:'Query',cols:'Key',style:`head-${i}`})).join(''),'A_0[0]=[0.985834,0.014166]，A_1[0]=[0.992965,0.007035]。共享 K/V 并没有让两头权重相同。'],
  ['6 加权 V','各自的权重乘同一个 V_0','Hh (2,2,2)','H_i = A_i @ V_0。对全部 Value token 加权求和，不是对 head 求平均。',()=>heads('H',r.Hh)+matrixBox('V_0（共享）',r.Vh[0],{style:'shared'}),'V_0 两行的第一列都为 1，所以每行输出第一列为 1；第二列分别为 1、2，因此权重变化会改变输出第二列。'],
  ['7 拼头','按 token 收集所有 head，再拼接特征','H (2,4)','Hh 从 (head,token,feature) 换成 (token,head,feature)，再合并 head、feature 两轴。',()=>heads('H',r.Hh)+matrixBox('H = concat(H_0,H_1)',r.H),'H 的 token 0 是 H_0[0] 与 H_1[0] 拼接，不是 H_0[0] 与 H_0[1] 拼接。'],
  ['8 输出','H @ W_O + b_O','O (2,4)','输出投影混合各 Query head 的特征；最终接口返回二维列表。',()=>matrixBox('H',r.H)+matrixBox('W_O',example.WO,{rows:'input',cols:'output'})+matrixBox('O（完整精度计算）',r.O),'四舍五入到两位小数后：[[2.00,2.02,2.01,2.01],[2.00,2.30,2.20,2.11]]。']
];
let stageIndex=0;
$('stage-buttons').innerHTML=stages.map((s,i)=>`<button type="button" class="btn" data-stage="${i}">${s[0]}</button>`).join('');
function renderStage(i) {
  stageIndex=Math.max(0,Math.min(stages.length-1,i));const stage=stages[stageIndex];
  $('trace-title').textContent=stage[1];$('trace-shape').textContent=stage[2];$('trace-text').textContent=stage[3];$('trace-matrices').innerHTML=stage[4]();$('trace-summary').textContent=stage[5];
  $('trace-progress').textContent=`${stageIndex+1} / ${stages.length}`;
  $('trace-prev').disabled=stageIndex===0;$('trace-next').disabled=stageIndex===stages.length-1;
  $('stage-buttons').querySelectorAll('button').forEach((button,j)=>{button.classList.toggle('active',j===stageIndex);button.setAttribute('aria-pressed',String(j===stageIndex));});
}
$('stage-buttons').addEventListener('click',e=>{const b=e.target.closest('[data-stage]');if(b)renderStage(Number(b.dataset.stage));});
$('trace-prev').addEventListener('click',()=>renderStage(stageIndex-1));$('trace-next').addEventListener('click',()=>renderStage(stageIndex+1));renderStage(0);

function renderWeights() {
  const head=Number($('weight-head').value),token=Number($('weight-token').value),weights=r.A[head][token];
  $('weights').innerHTML=weights.map((w,j)=>`<div class="weight-row"><span>Key ${j}</span><div class="bar"><div class="fill" style="width:${w*100}%"></div></div><span>${fmt(w)}</span></div>`).join('');
  $('weighted-output').textContent=`Q_${head} 的 token ${token} 读取 V_0：${fmt(weights[0])}×[1,1] + ${fmt(weights[1])}×[1,2] = [${r.Hh[head][token].map(fmt).join(', ')}]。`;
}
$('weight-head').addEventListener('change',renderWeights);$('weight-token').addEventListener('change',renderWeights);renderWeights();
