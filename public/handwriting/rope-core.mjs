// Small, inspectable numerical engine for the RoPE guide.
export const example = {
  X: [[1,0,0,1],[1,1,1,0],[0,1,2,-1]],
  positions: [0,1,2],
  base: 100
};

export const standardExample = { ...example, base: 10000 };

function matrix(name,m,rows,cols) {
  if (!Array.isArray(m) || m.length!==rows || m.some(row=>!Array.isArray(row) || row.length!==cols || !row.every(Number.isFinite))) {
    throw new RangeError(`${name} 必须是有限数值矩阵 (${rows}, ${cols})`);
  }
}
function vector(name,v,size) {
  if (!Array.isArray(v) || v.length!==size || !v.every(Number.isFinite)) throw new RangeError(`${name} 长度应为 ${size}`);
}
function positionsFor(positions,T) {
  const p=positions==null?Array.from({length:T},(_,i)=>i):positions;
  vector('positions',p,T);
  return p;
}
const transpose=m=>m[0].map((_,j)=>m.map(row=>row[j]));
const multiply=(a,b)=>a.map(row=>b[0].map((_,j)=>row.reduce((sum,x,k)=>sum+x*b[k][j],0)));

export function calculateRope({X,positions=null,base=10000}) {
  if (!Array.isArray(X) || !X.length || !Array.isArray(X[0]) || !X[0].length) throw new RangeError('X 必须是非空二维矩阵');
  const T=X.length,D=X[0].length;
  matrix('X',X,T,D);
  if (D%2!==0) throw new RangeError('RoPE 要求特征维度 D 为偶数，才能两两配对旋转');
  if (!Number.isFinite(base) || base<=1) throw new RangeError('base 必须是大于 1 的有限数');
  const pos=positionsFor(positions,T);
  const pairs=D/2;
  const invFreq=Array.from({length:pairs},(_,i)=>1/(base**((2*i)/D)));
  const angles=pos.map(p=>invFreq.map(freq=>p*freq));
  const cos=angles.map(row=>row.map(Math.cos));
  const sin=angles.map(row=>row.map(Math.sin));
  const even=X.map(row=>row.filter((_,i)=>i%2===0));
  const odd=X.map(row=>row.filter((_,i)=>i%2===1));
  const rotated=X.map((row,t)=>Array.from({length:pairs},(_,i)=>[
    even[t][i]*cos[t][i]-odd[t][i]*sin[t][i],
    even[t][i]*sin[t][i]+odd[t][i]*cos[t][i]
  ]).flat());
  const pairNorms=X.map((row,t)=>Array.from({length:pairs},(_,i)=>row[2*i]**2+row[2*i+1]**2));
  const rotatedPairNorms=rotated.map((row,t)=>Array.from({length:pairs},(_,i)=>row[2*i]**2+row[2*i+1]**2));
  return {T,D,pairs,positions:pos,base,invFreq,angles,cos,sin,even,odd,rotated,pairNorms,rotatedPairNorms};
}

export function ropeAttention({Q,K,V,positions=null,base=10000}) {
  if (!Array.isArray(Q) || !Q.length || !Array.isArray(Q[0])) throw new RangeError('Q 必须是非空二维矩阵');
  if (!Array.isArray(K) || !K.length || !Array.isArray(K[0])) throw new RangeError('K 必须是非空二维矩阵');
  const D=Q[0].length,TQ=Q.length,TK=K.length;
  matrix('Q',Q,TQ,D); matrix('K',K,TK,D); matrix('V',V,TK,V[0]?.length ?? 0);
  const qPos=positionsFor(positions,TQ);
  const kPos=positionsFor(positions==null?null:positions,TK);
  const q=calculateRope({X:Q,positions:qPos,base}).rotated;
  const k=calculateRope({X:K,positions:kPos,base}).rotated;
  const raw=multiply(q,transpose(k));
  const S=raw.map(row=>row.map(x=>x/Math.sqrt(D)));
  const shifted=S.map(row=>{const max=Math.max(...row);return row.map(x=>x-max);});
  const E=shifted.map(row=>row.map(Math.exp));
  const A=E.map(row=>{const sum=row.reduce((s,x)=>s+x,0);return row.map(x=>x/sum);});
  return {Q: q,K:k,V,scores:S,attention:A,output:multiply(A,V)};
}
