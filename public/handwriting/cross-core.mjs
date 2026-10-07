// Numerical trace for the supplied, single-head cross-attention exercise.
export const example = {
  XQ: [[1,0,1,0],[0,1,0,1]], XK: [[1,1,0,0],[0,1,1,0]],
  WQ: [[1,0,1,0],[0,1,0,1],[1,0,0,1],[0,1,1,0]], bQ: [0,0,0,0],
  WK: [[1,1,0,0],[0,1,1,0],[1,0,0,1],[0,0,1,1]], bK: [0,0,0,0],
  WV: [[1,0,0,1],[1,1,0,0],[0,1,1,0],[0,0,1,1]], bV: [0,0,0,0],
  WO: [[1,0,1,0],[0,1,0,1],[1,0,0,1],[0,1,1,0]], bO: [0,0,0,0]
};
export const rectangularExample = { ...example, XK: [...example.XK, [0,0,0,1]] };

function matrix(name, m, rows, cols) {
  if (!Array.isArray(m) || m.length !== rows || m.some(row => !Array.isArray(row) || row.length !== cols || !row.every(Number.isFinite))) {
    throw new RangeError(`${name} 必须是有限数值矩阵 (${rows}, ${cols})`);
  }
}
const transpose = m => m[0].map((_, j) => m.map(row => row[j]));
const multiply = (a,b) => a.map(row => b[0].map((_,j) => row.reduce((sum,x,k) => sum + x*b[k][j],0)));
const project = (x,w,b) => multiply(x,w).map(row => row.map((x,j) => x+b[j]));

export function calculateCross(data) {
  const { XQ,XK,WQ,WK,WV,WO,bQ,bK,bV,bO } = data;
  for (const [name,x] of [['X_Q',XQ],['X_K',XK]]) {
    if (!Array.isArray(x) || !x.length || !Array.isArray(x[0]) || !x[0].length) throw new RangeError(`${name} 必须是非空二维矩阵`);
  }
  const TQ=XQ.length, TK=XK.length, M=XQ[0].length;
  for (const [name,m,rows,cols] of [['X_Q',XQ,TQ,M],['X_K',XK,TK,M],['W_Q',WQ,M,M],['W_K',WK,M,M],['W_V',WV,M,M],['W_O',WO,M,M]]) matrix(name,m,rows,cols);
  for (const [name,b] of [['b_Q',bQ],['b_K',bK],['b_V',bV],['b_O',bO]]) {
    if (!Array.isArray(b) || b.length!==M || !b.every(Number.isFinite)) throw new RangeError(`${name} 长度应为 ${M}`);
  }
  const Q=project(XQ,WQ,bQ), K=project(XK,WK,bK), V=project(XK,WV,bV);
  const KT=transpose(K), raw=multiply(Q,KT), S=raw.map(row=>row.map(x=>x/Math.sqrt(M)));
  const maxima=S.map(row=>[Math.max(...row)]);
  const shifted=S.map((row,i)=>row.map(x=>x-maxima[i][0]));
  const E=shifted.map(row=>row.map(Math.exp)), sums=E.map(row=>[row.reduce((sum,x)=>sum+x,0)]);
  const A=E.map((row,i)=>row.map(x=>x/sums[i][0]));
  const H=multiply(A,V), O=project(H,WO,bO);
  return { TQ,TK,M,dk:M,Q,K,V,KT,raw,S,maxima,shifted,E,sums,A,H,O };
}
