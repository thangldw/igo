import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformPoint,transformPuzzle} from '../symmetry.js';
import {exportBackup,parseBackup} from '../backup.js';
import {freshStudy,recordSolve} from '../study-state.js';
import {boundedReader} from '../reading.js';
import {buildBank} from '../curriculum.js';

test('every transform is a permutation and 4 rotations return to start',()=>{
  for(const size of [5,7,9])for(let k=0;k<8;k++){
    const seen=new Set(Array.from({length:size*size},(_,p)=>transformPoint(p,size,k)));
    assert.equal(seen.size,size*size);
  }
  for(let p=0;p<25;p++){let q=p;for(let i=0;i<4;i++)q=transformPoint(q,5,1);assert.equal(q,p);}
});
test('transformed reading puzzles have exactly the transformed set of winning moves',()=>{
  const bank=buildBank(JSON.parse(readFileSync(new URL('../reading-bank.json',import.meta.url))));
  const sample=bank.filter(p=>p.kind==='reading'&&p.size<=7).filter((_,i)=>i%9===0).slice(0,8);
  assert.ok(sample.length>=4);
  const winners=p=>{
    const board=Array(p.size*p.size).fill(0);for(const [pt,c] of p.setup)board[pt]=c;
    const r=boundedReader(board,p.size,p.target,p.depth,[board.join('')],250000,p.goal||'capture').winningMoves();
    assert.ok(r.certain);return r.moves.sort((x,y)=>x-y);
  };
  for(const p of sample){
    const base=winners(p);
    for(const k of [1,3,5,6]){
      const expected=base.map(m=>transformPoint(m,p.size,k)).sort((x,y)=>x-y);
      assert.deepEqual(winners(transformPuzzle(p,k)),expected,`${p.id} k=${k}`);
    }
  }
});
test('backup round-trips, drops unknown ids and rejects foreign files',()=>{
  const s=freshStudy();recordSolve(s,'a',true,Date.now());recordSolve(s,'zzz',true,Date.now());
  const parsed=parseBackup(exportBackup(s,{'igo-progress':'{}','evil':'x'}),['a']);
  assert.ok(parsed.ok);assert.deepEqual(Object.keys(parsed.study.records),['a']);assert.equal(parsed.skipped,1);
  assert.deepEqual(Object.keys(parsed.extras),['igo-progress']);
  assert.equal(parseBackup('nope',['a']).ok,false);
  assert.equal(parseBackup('{"hello":1}',['a']).ok,false);
});
