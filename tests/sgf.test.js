import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSgf,replaySgf,validateSgf,sgfPoint,trialMove} from '../sgf.js';
const game=text=>validateSgf(parseSgf(text));
test('SGF escaped comments, line continuations and sibling branches survive parsing',()=>{
  const g=game('(;FF[4]GM[1]SZ[19]PB[Đen]PW[Trắng]C[đóng \\] và \\\\ xuống\\\n dòng];B[pd](;W[dd];B[qp])(;W[dp];B[qq]))');
  assert.equal(g.root.props.C[0],'đóng ] và \\ xuống dòng');assert.equal(g.nodeCount,6);
  const a=replaySgf(g,[0,0,0]).at(-1),b=replaySgf(g,[0,1,0]).at(-1);
  assert.equal(a.count,3);assert.equal(a.board[3*19+3],2);assert.equal(b.board[15*19+3],2);assert.notDeepEqual(a.board,b.board);
});
test('root handicap setup, compressed rectangles, removals and PL replay',()=>{
  const g=game('(;SZ[9]AB[aa:bb]PL[W];AE[aa]AW[dd]PL[B];B[ee])');
  const frames=replaySgf(g,[0,0]);assert.equal(frames[0].board.filter(c=>c===1).length,4);assert.equal(frames[0].next,2);
  assert.equal(frames[1].board[0],0);assert.equal(frames[1].board[30],2);assert.equal(frames[2].count,1);
});
test('both pass encodings preserve board and advance side',()=>{
  const g=game('(;SZ[19];B[];W[tt];B[aa])'),frames=replaySgf(g,[0,0,0]);
  assert.equal(frames[1].count,1);assert.equal(frames[1].next,2);assert.deepEqual(frames[1].board,frames[2].board);assert.equal(frames[3].board[0],1);
});
test('a capture removes opponents and trials do not mutate original replay',()=>{
  const g=game('(;SZ[9]AB[ba]AW[aa]PL[B])');const initial=replaySgf(g)[0],before=[...initial.board],trial=trialMove(initial,9,9);
  assert.equal(trial.board[0],0);assert.equal(trial.board[9],1);assert.deepEqual(initial.board,before);
  assert.equal(trial.next,2);assert.throws(()=>trialMove(trial,9,9),/đã có quân/);
});
test('SGF replay and local trials both reject immediate ko but permit recapture after intervening passes',()=>{
  const setup='(;SZ[9]AB[ba][ab][bc]AW[bb][ca][db][cc]PL[B]';
  const g=game(setup+';B[cb])'),state=replaySgf(g,[0]).at(-1);
  assert.throws(()=>trialMove(state,10,9),/Ko/);
  assert.throws(()=>game(setup+';B[cb];W[bb])'),/Ko/);
  const passed=trialMove(trialMove(state,-1,9),-1,9);assert.equal(trialMove(passed,10,9).board[10],2);
});
test('all sibling variations are validated, including an illegal unselected branch',()=>{
  assert.throws(()=>game('(;SZ[9];B[aa](;W[bb])(;W[aa]))'),/đã có quân/);
});
test('unsupported or corrupt data fails explicitly',()=>{
  for(const text of ['(;SZ[8])','(;SZ[9:13])','(;GM[2])','(;FF[3])','(;SZ[9];B[jj])','(;SZ[9]AB[aa]AW[aa])','(;SZ[9]AB[aa][aa])','(;SZ[9];B[aa]W[bb])','(;SZ[9];SZ[13])','(;SZ[9]AB[aa]B[bb])','(;SZ[9]C[missing)','(;SZ[9])(;SZ[9])','(;SZ[9]PL[X])','(;SZ[9]KM[NaN])','(;SZ[9]CA[Shift_JIS])','(;SZ[9]PL[B]B[aa])'])assert.throws(()=>game(text),undefined,text);
  assert.throws(()=>parseSgf('x'.repeat(1000001)),/1 MB/);
  assert.throws(()=>replaySgf(game('(;SZ[9])'),[1]),/Đường biến/);
  assert.throws(()=>sgfPoint('tt',19),/Tọa độ/);
});
test('SGF preserves literal markup as text and trims BOM',()=>{
  const g=game('\uFEFF(;SZ[9]C[<script>alert(1)</script>])');assert.equal(replaySgf(g)[0].comment,'<script>alert(1)</script>');
});
test('the large sequential replay stores only the two positions needed for simple ko',()=>{
  const g=game('(;SZ[19]'+Array.from({length:800},(_,i)=>`;${i%2?'W':'B'}[]`).join('')+')');
  const frames=replaySgf(g,Array(800).fill(0));assert.equal(frames.at(-1).count,800);assert.ok(frames.every(f=>f.history.length<=2));
});

test('handicap chooses White while arbitrary black setup retains Black by default',()=>{
  assert.equal(replaySgf(game('(;SZ[19]HA[2]AB[dd][pp])'))[0].next,2);
  assert.equal(replaySgf(game('(;SZ[19]AB[dd][pp])'))[0].next,1);
  assert.equal(replaySgf(game('(;SZ[19]HA[2]AB[dd][pp]PL[B])'))[0].next,1);
});
