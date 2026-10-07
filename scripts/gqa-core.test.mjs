import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculateGqa, example, groupMapping } from '../public/handwriting/gqa-core.mjs';

function closeMatrix(actual, expected) {
  assert.equal(actual.length, expected.length);
  for (let i=0;i<expected.length;i++) {
    assert.equal(actual[i].length,expected[i].length);
    for (let j=0;j<expected[i].length;j++) assert.ok(Math.abs(actual[i][j]-expected[i][j])<1e-10, `${i},${j}: ${actual[i][j]} != ${expected[i][j]}`);
  }
}

test('original GQA sample preserves projection, head order and output', () => {
  const r=calculateGqa(example);
  assert.deepEqual(r.Q,[[2,2,1,3],[1,1,2,0]]);
  assert.deepEqual(r.K,[[2,3],[1,1]]);
  assert.deepEqual(r.V,[[1,1],[1,2]]);
  assert.deepEqual(r.Qh,[[[2,2],[1,1]],[[1,3],[2,0]]]);
  closeMatrix(r.O,[[2,2.021201386961862,2.0070353510851735,2.0141660358766886],[2,2.302612118958214,2.1955703174930434,2.1070418014651704]]);
  for(const a of r.A)for(const row of a) assert.ok(Math.abs(row.reduce((s,x)=>s+x,0)-1)<1e-12);
});

test('adjacent query heads share each KV group, without cycling groups', () => {
  assert.deepEqual(groupMapping(8,2),[0,0,0,0,1,1,1,1]);
  assert.deepEqual(groupMapping(8,4),[0,0,1,1,2,2,3,3]);
  assert.deepEqual(groupMapping(8,8),[0,1,2,3,4,5,6,7]);
  const zero=Array(4).fill(0), identity=Array.from({length:4},(_,i)=>Array.from({length:4},(_,j)=>+(i===j)));
  const r=calculateGqa({X:[[1,2,3,4]],WQ:identity,WK:[[1,0],[0,1],[0,0],[0,0]],WV:[[0,0],[0,0],[1,0],[0,1]],WO:identity,bQ:zero,bK:[1,2],bV:[1,2],bO:zero,hq:4,hk:2});
  assert.deepEqual(r.K,[[2,4]]);
  assert.deepEqual(r.O,[[4,4,6,6]]);
});

test('large finite scores keep weights and outputs finite', () => {
  const r=calculateGqa({...example,X:example.X.map(row=>row.map(x=>x*1000))});
  for(const a of r.A)for(const row of a){assert.ok(row.every(Number.isFinite));assert.ok(Math.abs(row.reduce((s,x)=>s+x,0)-1)<1e-12);}
  assert.ok(r.O.flat().every(Number.isFinite));
});

test('invalid head counts and compressed projection shapes are rejected', () => {
  for(const [hq,hk] of [[0,1],[3,1],[2,3],[4,3],[2,0],[2.5,1]]) assert.throws(()=>calculateGqa({...example,hq,hk}),/head|整除/);
  assert.throws(()=>calculateGqa({...example,WK:example.WQ}),/W_K/);
  assert.throws(()=>calculateGqa({...example,X:[]}),/X/);
});
