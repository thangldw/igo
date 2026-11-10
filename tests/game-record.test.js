import test from 'node:test';
import assert from 'node:assert/strict';
import {replayRecord,recordSgf} from '../game-record.js';
import {parseSgf,replaySgf} from '../sgf.js';
test('saved game replays passes, pending bot turn and undo boundary',()=>{
 const r={version:1,size:9,moves:[{color:1,point:0},{color:2,point:10},{color:1,point:-1}]};
 const s=replayRecord(r);assert.equal(s.next,2);assert.equal(s.passes,1);assert.equal(s.snapshots.at(-1).moveCount,2);assert.equal(s.board[10],2);
 r.moves.push({color:2,point:-1});assert.equal(replayRecord(r).ended,true);
});
test('SGF export round trips all supported board sizes and pass',()=>{
 for(const size of [9,13,19]){const r={version:1,size,moves:[{color:1,point:size*size-1},{color:2,point:-1}]};const g=parseSgf(recordSgf(r));const frames=replaySgf(g,[0,0]);assert.deepEqual(frames.at(-1).board,replayRecord(r).board);}
});
test('corrupt saved sequences fail rather than fabricate progress',()=>{
 for(const moves of [[{color:2,point:0}],[{color:1,point:400}],[{color:1,point:0},{color:2,point:0}]])assert.throws(()=>replayRecord({version:1,size:9,moves}));
});

import {handicapPoints,recordKomi} from '../game-record.js';
test('handicap games start with black stones on star points and white to move; SGF round-trips',()=>{
  for(const size of [9,13,19])for(let h=2;h<=9;h++){
    const pts=handicapPoints(size,h);assert.equal(new Set(pts).size,h,`${size}/${h}`);
  }
  const r={version:1,size:19,handicap:4,komi:0.5,moves:[{color:2,point:3*19+9},{color:1,point:9*19+9}]};
  const s=replayRecord(r);assert.equal(s.next,2);assert.equal(s.board.filter(x=>x===1).length,5);
  const sgf=recordSgf(r);assert.match(sgf,/HA\[4\]AB\[pd\]\[dp\]\[pp\]\[dd\]/);assert.match(sgf,/KM\[0\.5\]/);
  const g=parseSgf(sgf);assert.ok(g);
  assert.throws(()=>replayRecord({...r,moves:[{color:1,point:0}]}));      // black cannot open a handicap game
  assert.throws(()=>replayRecord({...r,handicap:1}));
  assert.equal(recordKomi({}),6.5);assert.equal(recordKomi({handicap:3}),0.5);assert.equal(recordKomi({komi:7.5}),7.5);assert.equal(recordKomi({komi:7.3}),6.5);
});
