import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateCross,example,rectangularExample } from '../public/handwriting/cross-core.mjs';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-10, `${a} != ${b}`);
const identity=n=>Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>Number(i===j)));

test('supplied sample: Q from X_Q, both K and V from X_K, expected output',()=>{
  const r=calculateCross(example);
  assert.deepEqual(r.Q,[[2,0,1,1],[0,2,1,1]]);
  assert.deepEqual(r.K,[[1,2,1,0],[1,1,1,1]]);
  assert.deepEqual(r.V,[[2,1,0,1],[1,2,1,0]]);
  assert.deepEqual(r.S,[[1.5,2],[2.5,2]]);
  assert.deepEqual(r.O.map(row=>row.map(x=>Number(x.toFixed(2)))),[[2,2,1.76,2.24],[2,2,2.24,1.76]]);
});
test('different sequence lengths: weights have T_K columns; output has T_Q rows',()=>{
  const r=calculateCross(rectangularExample);
  assert.equal(r.A.length,2);assert.equal(r.A[0].length,3);
  assert.equal(r.O.length,2);assert.equal(r.O[0].length,4);
  r.A.forEach(row=>close(row.reduce((a,b)=>a+b),1));
  // Changing only the Query input must leave the KV projections intact.
  const changed=calculateCross({...rectangularExample,XQ:[[0,0,0,0]]});
  assert.deepEqual(changed.K,r.K);assert.deepEqual(changed.V,r.V);
  assert.deepEqual(changed.A,[[1/3,1/3,1/3]]);
});
test('one Key: each Query reads the same V; nonzero biases and output projection',()=>{
  const I=identity(2), r=calculateCross({XQ:[[4,2],[8,1],[3,9]],XK:[[1,2]],WQ:I,WK:I,WV:I,WO:I,bQ:[1,2],bK:[2,1],bV:[3,4],bO:[5,6]});
  assert.deepEqual(r.A,[[1],[1],[1]]);
  assert.deepEqual(r.O,[[9,12],[9,12],[9,12]]);
});
test('large finite scores remain stable and normalize along Key axis',()=>{
  const I=identity(2), r=calculateCross({XQ:[[1000,1000],[1000,-1000]],XK:[[1000,1000],[-1000,-1000]],WQ:I,WK:I,WV:I,WO:I,bQ:[0,0],bK:[0,0],bV:[0,0],bO:[0,0]});
  assert.deepEqual(r.A,[[1,0],[0.5,0.5]]);
  assert.ok(r.O.flat().every(Number.isFinite));
});
test('invalid feature dimensions, biases, empty sequences and non-finite inputs are rejected',()=>{
  for(const patch of [{XK:[[1,2]]},{XQ:[]},{bV:[0]},{WQ:[[1]]},{XQ:[[NaN,0,0,0]]}])assert.throws(()=>calculateCross({...example,...patch}),RangeError);
});
