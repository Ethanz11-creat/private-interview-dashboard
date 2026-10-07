// Small, inspectable numerical engine for the guide; no framework dependency.
export const example = {
  X: [[1,0,1,2],[0,1,1,0]],
  WQ: [[1,0,0,1],[0,1,1,0],[1,0,1,0],[0,1,0,1]], bQ: [0,0,0,0],
  WK: [[1,1],[0,1],[1,0],[0,1]], bK: [0,0],
  WV: [[1,0],[1,1],[0,1],[0,0]], bV: [0,0],
  hq: 2, hk: 1,
  WO: [[1,0,1,0],[0,1,0,1],[1,0,0,1],[0,1,1,0]], bO: [0,0,0,0]
};

export function groupMapping(hq, hk) {
  if (!Number.isInteger(hq) || !Number.isInteger(hk) || hq<1 || hk<1 || hk>hq || hq%hk!==0) {
    throw new RangeError('head 数必须为正整数，且 h_q 能被 h_k 整除');
  }
  return Array.from({length:hq},(_,i)=>Math.floor(i/(hq/hk)));
}

function matrix(name, m, rows, cols) {
  if (!Array.isArray(m) || m.length!==rows || m.some(row=>!Array.isArray(row) || row.length!==cols || !row.every(Number.isFinite))) {
    throw new RangeError(`${name} 必须是有限数值矩阵 (${rows}, ${cols})`);
  }
}
function bias(name,b,size) {
  if (!Array.isArray(b) || b.length!==size || !b.every(Number.isFinite)) throw new RangeError(`${name} 长度应为 ${size}`);
}
const transpose = m=>m[0].map((_,j)=>m.map(row=>row[j]));
const multiply = (a,b)=>a.map(row=>b[0].map((_,j)=>row.reduce((sum,x,k)=>sum+x*b[k][j],0)));
const project = (x,w,b)=>multiply(x,w).map(row=>row.map((v,j)=>v+b[j]));
const split = (m,heads,dk)=>Array.from({length:heads},(_,head)=>m.map(row=>row.slice(head*dk,(head+1)*dk)));

export function calculateGqa(data) {
  const {X,WQ,WK,WV,WO,bQ,bK,bV,bO,hq,hk}=data;
  const mapping=groupMapping(hq,hk);
  if (!Array.isArray(X) || !X.length || !Array.isArray(X[0]) || !X[0].length) throw new RangeError('X 必须是非空二维矩阵');
  const T=X.length, M=X[0].length;
  if(M%hq!==0)throw new RangeError('d_model 必须能被 Query head 数整除');
  const dk=M/hq, kvWidth=hk*dk;
  for(const [name,m,rows,cols] of [['X',X,T,M],['W_Q',WQ,M,M],['W_K',WK,M,kvWidth],['W_V',WV,M,kvWidth],['W_O',WO,M,M]])matrix(name,m,rows,cols);
  for(const [name,b,size] of [['b_Q',bQ,M],['b_K',bK,kvWidth],['b_V',bV,kvWidth],['b_O',bO,M]])bias(name,b,size);
  const Q=project(X,WQ,bQ), K=project(X,WK,bK), V=project(X,WV,bV);
  const Qh=split(Q,hq,dk), Kh=split(K,hk,dk), Vh=split(V,hk,dk);
  const S=Qh.map((q,i)=>multiply(q,transpose(Kh[mapping[i]])).map(row=>row.map(x=>x/Math.sqrt(dk))));
  const shifted=S.map(m=>m.map(row=>{const max=Math.max(...row);return row.map(x=>x-max);}));
  const E=shifted.map(m=>m.map(row=>row.map(Math.exp)));
  const sums=E.map(m=>m.map(row=>[row.reduce((sum,x)=>sum+x,0)]));
  const A=E.map((m,i)=>m.map((row,j)=>row.map(x=>x/sums[i][j][0])));
  const Hh=A.map((a,i)=>multiply(a,Vh[mapping[i]]));
  const H=Array.from({length:T},(_,token)=>Hh.flatMap(head=>head[token]));
  const O=project(H,WO,bO);
  return {T,M,dk,hq,hk,groupSize:hq/hk,mapping,Q,K,V,Qh,Kh,Vh,S,shifted,E,sums,A,Hh,H,O};
}
