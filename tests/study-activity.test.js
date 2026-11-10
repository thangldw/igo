import test from 'node:test';
import assert from 'node:assert/strict';
import {freshStudy,restoreStudy,recordSolve,recordMiss,beginAttempt,streakDays,todayCount,problemStatus,topicStats,dailyPlan,isoDay} from '../study-state.js';

const DAY=86400000, noon=new Date(2026,10,11,12).getTime();
const bank=[...'abcdef'].map((c,i)=>({id:c,stage:i<4?'s1':'s2',topic:i%2?'ko':'eyes'}));

test('activity counts solves and streak survives a quiet today',()=>{
  const s=freshStudy();
  for(const d of [2,1])recordSolve(s,'a',true,noon-d*DAY);
  assert.equal(streakDays(s,noon),2);
  recordSolve(s,'a',true,noon);
  assert.equal(todayCount(s,noon),1);assert.equal(streakDays(s,noon),3);
  assert.equal(streakDays(s,noon+3*DAY),0);
});
test('activity and goal round-trip through restoreStudy; old saves still load',()=>{
  const s=freshStudy();recordSolve(s,'a',true,noon);s.goal=8;
  const back=restoreStudy(JSON.stringify(s),['a']);
  assert.equal(back.goal,8);assert.equal(back.activity[isoDay(noon)],1);
  const old=restoreStudy(JSON.stringify({version:1,records:{a:{attempts:1,solves:1,clean:1,streak:1,due:0,lastResult:'clean'}},games:[]}),['a']);
  assert.deepEqual(old.activity,{});assert.equal(old.goal,5);
  assert.equal(restoreStudy(JSON.stringify({version:1,records:{},activity:{bad:1,'2026-11-11':-4},goal:999}),[]).goal,5);
});
test('problemStatus has four states',()=>{
  const s=freshStudy();
  assert.equal(problemStatus(s.records.a,noon),'new');
  beginAttempt(s,'a');recordMiss(s,'a',noon);assert.equal(problemStatus(s.records.a,noon),'due');
  recordSolve(s,'a',false,noon);assert.equal(problemStatus(s.records.a,noon),'solved');
  s.records.a.streak=2;s.records.a.due=noon+DAY;assert.equal(problemStatus(s.records.a,noon),'retained');
  assert.equal(problemStatus(s.records.a,noon+2*DAY),'due');
});
test('topicStats flags weak topics only with enough attempts',()=>{
  const s=freshStudy();
  for(const id of ['a','c','e']){beginAttempt(s,id);recordMiss(s,id,noon);}
  const stats=topicStats(bank,s,noon);
  assert.equal(stats[0].topic,'eyes');assert.equal(stats[0].weak,true);
  assert.equal(stats.find(t=>t.topic==='ko').weak,false);
});
test('dailyPlan puts due first, then new problems by stage, up to the goal',()=>{
  const s=freshStudy();s.goal=4;
  beginAttempt(s,'e');recordMiss(s,'e',noon-DAY);
  const plan=dailyPlan(bank,s,noon,['s1','s2']);
  assert.deepEqual(plan.items.map(p=>p.id),['e','a','b','c']);assert.equal(plan.due,1);assert.equal(plan.done,0);
});
