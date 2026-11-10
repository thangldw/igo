import test from 'node:test';
import assert from 'node:assert/strict';
import {suggestDead} from '../dead-stones.js';
const parse=rows=>rows.join('').split('').map(c=>c==='X'?1:c==='O'?2:0);
// Black owns the left, White the right; the black stone at E5 (index 41) is surrounded inside white's area.
const settled=parse(['.X.XO.O..','XX.XOOO..','.XXXO.OO.','XXXXOOO.O','...XOXOOO','XXXXO.O..','.X.XOOO.O','XXXXO.OO.','.X.XO..O.']);

test('a surrounded stone in the opponent\'s area is suggested dead; living groups are not',()=>{
  const dead=suggestDead(settled,9,{seed:1});
  assert.deepEqual(dead,[41]);
});
test('result is stable across seeds and deterministic for one seed',()=>{
  for(const seed of [2,3,4])assert.deepEqual(suggestDead(settled,9,{seed}),[41]);
  assert.deepEqual(suggestDead(settled,9,{seed:9}),suggestDead(settled,9,{seed:9}));
});
test('without a wall the heuristic does not invent dead stones',()=>{
  const b=parse(['.........','.........','..X......','.........','.........','.........','......O..','.........','.........']);
  assert.deepEqual(suggestDead(b,9,{seed:3}),[]);
});
