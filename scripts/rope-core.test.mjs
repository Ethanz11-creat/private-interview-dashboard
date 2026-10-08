import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateRope, example, ropeAttention } from '../public/handwriting/rope-core.mjs';

const close=(a,b,tol=1e-10)=>assert.ok(Math.abs(a-b)<=tol,`${a} != ${b}`);
const identity=n=>Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>Number(i===j)));

test('position zero is unchanged and sample rotation matches the formula',()=>{
  const r=calculateRope(example);
  assert.deepEqual(r.rotated[0],example.X[0]);
  close(r.rotated[1][0],-0.30116867893975674); close(r.rotated[1][1],1.3817732906760363);
  close(r.rotated[1][2],0.9950041652780258); close(r.rotated[1][3],0.09983341664682815);
  close(r.angles[2][0],2); close(r.angles[2][1],0.2);
});

test('each two-dimensional pair preserves its norm',()=>{
  const r=calculateRope(example);
  r.pairNorms.forEach((row,t)=>row.forEach((norm,i)=>close(norm,r.rotatedPairNorms[t][i],1e-9)));
});

test('explicit non-contiguous positions and standard base are supported',()=>{
  const r=calculateRope({X:[[1,0,2,0]],positions:[7],base:10000});
  close(r.angles[0][0],7); close(r.angles[0][1],0.07); assert.equal(r.positions[0],7);
});

test('rotary attention rotates Q and K but leaves V as values',()=>{
  const I=identity(2), r=ropeAttention({Q:[[1,0],[0,1]],K:[[1,0],[0,1]],V:[[3,4],[5,6]],positions:[0,1],base:100});
  assert.deepEqual(r.V,[[3,4],[5,6]]);
  r.attention.forEach(row=>close(row.reduce((a,b)=>a+b,0),1));
  assert.equal(r.output.length,2);assert.equal(r.output[0].length,2);
  // With the same position on both sides, the rotation is orthogonal and
  // preserves the matching dot product for each corresponding pair.
  const same=ropeAttention({Q:[[1,2]],K:[[3,4]],V:[[5,6]],positions:[4],base:100});
  close(same.scores[0][0],11/Math.sqrt(2),1e-9);
});

test('invalid dimensions and bases fail loudly',()=>{
  for(const patch of [{X:[[1,2,3]]},{X:[[1,2]],base:1},{X:[[1,2]],positions:[0,1]}]) assert.throws(()=>calculateRope({...example,...patch}),RangeError);
});
