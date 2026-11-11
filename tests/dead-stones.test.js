import test from 'node:test';
import assert from 'node:assert/strict';
import {suggestDead,inSeki} from '../dead-stones.js';
import {group} from '../engine.js';
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

test('inSeki: shared liberties nobody can play are seki; an ordinary intruder is not',()=>{
  // Black owns everything except two liberties B1/D1 shared with the white stone C1: playing either is self-atari for both.
  const seki=parse(['XXXXX','XXXXX','XXXXX','XXXXX','X.O.X']);
  assert.equal(inSeki(seki,5,group(seki,22,5)),true);
  assert.equal(inSeki(seki,5,group(seki,0,5)),true);
  // Black has a liberty elsewhere, so black can play B1 safely and White's stone is just capturable.
  const open=parse(['XXXX.','XXXXX','XXXXX','XXXXX','X.O.X']);
  assert.equal(inSeki(open,5,group(open,22,5)),false);
  // A group in atari is not seki: the capture is available.
  const atari=parse(['XXXXX','XXXXX','XXXXX','XXXXX','XXO.X']);
  assert.equal(inSeki(atari,5,group(atari,22,5)),false);
  assert.deepEqual(suggestDead(seki,5,{seed:1}),[]);
});
