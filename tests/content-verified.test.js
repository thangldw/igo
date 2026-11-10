import test from 'node:test';
import assert from 'node:assert/strict';
import {questions} from '../curriculum.js';
import {move,empty} from '../engine.js';
import {areaScore} from '../area-score.js';
import {handicapPoints} from '../game-record.js';

const byId=id=>questions.find(q=>q.id===`q-${id}`);
const boardOf=q=>{const b=empty(q.size);for(const [p,c] of q.setup)b[p]=c;return b;};
const point=(label,size)=>(size-Number(label.slice(1)))*size+'ABCDEFGHJKLMNOPQRST'.indexOf(label[0]);

test('corner-capture: only the keyed point captures, and it captures both stones',()=>{
  const q=byId('corner-capture'),b=boardOf(q);
  q.choices.forEach((label,i)=>{
    const r=move(b,point(label,q.size),1,q.size);assert.ok(!r.error,label);
    assert.equal(r.captured,i===q.answer?2:0,label);
  });
});
test('star-point: the 19x19 star points sit on the 4th line from both edges',()=>{
  const q=byId('star-point');assert.equal(q.choices[q.answer],'Đường thứ 4');
  const pts=handicapPoints(19,9);assert.equal(pts.length,9);
  for(const p of pts){const r=Math.floor(p/19),c=p%19;assert.ok([3,9,15].includes(r)&&[3,9,15].includes(c));}
  for(const p of handicapPoints(19,4)){const r=Math.floor(p/19),c=p%19;assert.ok([3,15].includes(r)&&[3,15].includes(c));}
  for(const l of ['D4','Q16','Q4','D16'])assert.ok(handicapPoints(19,4).includes(point(l,19)),l);
});
test('dame-area: playing a neutral point gains exactly one area point',()=>{
  const q=byId('dame-area'),b=boardOf(q),n=q.size;
  const base=areaScore(b,n,[],0),dame=point('D4',n);assert.equal(b[dame],0);
  assert.equal(base.neutral,7,'the whole D column is neutral');
  const r=move(b,dame,1,n);assert.ok(!r.error);
  const after=areaScore(r.board,n,[],0);
  assert.equal(after.black-base.black,1);assert.equal(after.white,base.white);
  assert.equal(q.choices[q.answer].startsWith('Tăng 1'),true);
});
