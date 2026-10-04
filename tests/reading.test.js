import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {empty,group,move,neighbors} from '../engine.js';
import {captureReader,boundedReader,goalAchieved,trueEyes} from '../reading.js';
import {handleReading} from '../reading-worker.js';
import {buildBank,questions,stages} from '../curriculum.js';
const raw=JSON.parse(fs.readFileSync(new URL('../reading-bank.json',import.meta.url)));
const bank=buildBank(raw);
function position(p){const b=empty(p.size);for(const [i,c] of p.setup)b[i]=c;return b;}
function brute(board,size,target,color,depth,history,goal='capture'){
  if(goal==='eyes'){
    if(board[target]!==1)return false;
    const connected=new Set(group(board,target,size).stones);
    let eyes=0;for(let i=0;i<board.length;i++)if(!board[i]&&neighbors(i,size).every(p=>connected.has(p)))eyes++;
    if(eyes>=2)return true;
  }else if(board[target]!==2)return true;
  if(!depth)return false;
  const outcomes=[];
  for(let i=0;i<board.length;i++){
    const r=move(board,i,color,size,history);
    if(r.error)continue;
    outcomes.push(()=>brute(r.board,size,target,3-color,depth-1,[...history,r.board.join('')],goal));
  }
  outcomes.push(()=>brute(board,size,target,3-color,depth-1,history,goal));
  return color===1?outcomes.some(f=>f()):outcomes.every(f=>f());
}
test('bounded reader agrees with unpruned exhaustive search on 3x3',()=>{
  let seed=7241;
  const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%9;};
  for(let trial=0;trial<70;trial++){
    let b=empty(3),history=[b.join('')];
    for(let k=0;k<8;k++){const r=move(b,rand(),k%2+1,3,history);if(!r.error){b=r.board;history.push(b.join(''));}}
    const target=b.indexOf(2);if(target<0)continue;
    for(const depth of [1,3,5]){
      const h=[b.join('')],result=captureReader(b,3,target,depth,h).read();
      assert.equal(result.certain,true);
      assert.equal(result.win,brute(b,3,target,1,depth,h),`trial ${trial}, depth ${depth}`);
    }
  }
});
test('every reading exercise has legal setup and complete winning first-move set',()=>{
  for(const p of raw){
    const b=position(p);
    assert.equal(b[p.target],p.goal==='eyes'?1:2);
    b.forEach((c,i)=>{if(c)assert.ok(group(b,i,p.size).liberties.length);});
    const reader=boundedReader(b,p.size,p.target,p.depth,undefined,250000,p.goal||'capture');
    const root=reader.read();assert.ok(root.certain&&root.win);
    const winning=reader.winningMoves();assert.equal(winning.certain,true);
    assert.deepEqual(winning.moves,p.winning);
    if(p.depth>1){const shorter=boundedReader(b,p.size,p.target,p.depth-2,undefined,250000,p.goal||'capture').read();assert.equal(shorter.certain,true);assert.equal(shorter.win,false);}
  }
});
test('worker plays a complete adversarial continuation for every exercise',()=>{
  for(const p of raw){
    let board=position(p),history=[board.join('')],remaining=p.depth,solved=false;
    while(remaining>0){
      const input={id:1,board,size:p.size,target:p.target,remaining,history,goal:p.goal||'capture'};
      const hint=handleReading({...input,action:'hint'});assert.equal(hint.status,'hint');
      const result=handleReading({...input,action:'check',point:hint.point});
      assert.ok(['solved','continue'].includes(result.status),`${p.depth}: ${result.status}`);
      board=result.board;history=result.history;remaining=result.remaining;
      if(result.status==='solved'){assert.equal(goalAchieved(board,p.size,p.target,p.goal||'capture'),true);solved=true;break;}
      assert.ok(remaining>0);
    }
    assert.equal(solved,true);
  }
});
test('worker accepts every independently verified winning first move',()=>{
  const p=raw.find(p=>p.winning.length>1),board=position(p);
  assert.ok(p);
  for(const point of p.winning){const result=handleReading({id:1,action:'check',board,size:p.size,target:p.target,remaining:p.depth,history:[board.join('')],point});assert.ok(['solved','continue'].includes(result.status));}
});
test('uncertain computation is separate from a losing result',()=>{
  const p=raw.find(p=>p.depth>=7),b=position(p),result=captureReader(b,p.size,p.target,p.depth,undefined,0).read();
  assert.equal(result.certain,false);
  assert.equal(result.win,undefined);
});
test('exercise ids, dimensions and choices are valid across all seven stages',()=>{
  assert.equal(bank.length,176);assert.equal(questions.length,87);
  assert.equal(new Set(bank.map(p=>p.id)).size,bank.length);
  for(const stage of stages)assert.ok(bank.filter(p=>p.stage===stage.id).length>=10);
  for(const p of bank){
    for(const [i,c] of p.setup){assert.ok(Number.isInteger(i)&&i>=0&&i<p.size*p.size);assert.ok(c===1||c===2);}
    if(p.kind==='quiz'){assert.ok(p.answer>=0&&p.answer<p.choices.length);assert.equal(new Set(p.choices).size,p.choices.length);}
  }
});
test('eye goal requires two empty points bounded by the same connected group',()=>{
  const cross=[0,1,0,1,1,1,0,1,0];
  assert.equal(trueEyes(cross,3,4).length,4);
  for(const p of [0,2,6,8])assert.match(move(cross,p,2,3).error,/Tự sát/);
  const disconnected=[0,1,0,1,0,1,0,1,0];
  assert.deepEqual(trueEyes(disconnected,3,1),[]);
});
test('eye reader agrees with separate unpruned search on 3x3',()=>{
  let seed=31591;
  for(let trial=0;trial<40;trial++){
    let b=empty(3),h=[b.join('')];
    for(let k=0;k<8;k++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const r=move(b,seed%9,k%2+1,3,h);if(!r.error){b=r.board;h.push(b.join(''));}}
    const target=b.indexOf(1);if(target<0)continue;
    for(const depth of [1,3,5]){
      const history=[b.join('')],v=boundedReader(b,3,target,depth,history,250000,'eyes').read();
      assert.equal(v.certain,true);assert.equal(v.win,brute(b,3,target,1,depth,history,'eyes'));
    }
  }
});
test('black cannot use double passing to claim an unfinished reading objective',()=>{
  const p=raw[0],board=position(p);
  const verdict=handleReading({id:1,action:'check',point:-1,board,size:p.size,target:p.target,remaining:p.depth,history:[board.join('')],goal:p.goal||'capture'});
  assert.equal(verdict.status,'wrong');assert.equal(verdict.counter,-1);
});
