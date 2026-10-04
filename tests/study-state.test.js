import {test} from 'node:test';
import assert from 'node:assert/strict';
import {freshStudy,restoreStudy,beginAttempt,recordMiss,recordSolve,needsReview,studyStats,reveal,eligibleClean} from '../study-state.js';
const day1=new Date(2026,9,4,12).getTime(),day2=day1+86400000;
test('immediate retries cannot manufacture multi-day retention',()=>{
  const s=freshStudy();beginAttempt(s,'a');recordSolve(s,'a',true,day1);recordSolve(s,'a',true,day1);
  assert.equal(s.records.a.streak,1);assert.equal(studyStats([{id:'a'}],s).retained,0);
  recordSolve(s,'a',true,day2);assert.equal(s.records.a.streak,2);assert.equal(studyStats([{id:'a'}],s).retained,1);
});
test('a failure enters review immediately and resets recall streak',()=>{
  const s=freshStudy();recordSolve(s,'a',true,day1);recordMiss(s,'a',day1+1000);
  assert.equal(s.records.a.streak,0);assert.equal(needsReview(s.records.a,day1+1000),true);
});
test('hints and answer exposure exclude same-day fresh recall',()=>{
  const s=freshStudy();assert.equal(eligibleClean(s,'a',day1),true);reveal(s,'a',day1);
  assert.equal(eligibleClean(s,'a',day1),false);assert.equal(eligibleClean(s,'a',day2),true);
  recordSolve(s,'a',false,day1);assert.equal(s.records.a.clean,0);assert.equal(s.records.a.streak,0);
});
test('assisted repetition does not erase a clean recall already earned that day',()=>{
  const s=freshStudy();recordSolve(s,'a',true,day1);const due=s.records.a.due;recordSolve(s,'a',false,day1+1000);
  assert.equal(s.records.a.streak,1);assert.equal(s.records.a.due,due);
});
test('review becomes due at the scheduled time and stats count unique exercises',()=>{
  const s=freshStudy();for(let i=0;i<6;i++)recordSolve(s,'a',true,day1);
  assert.equal(needsReview(s.records.a,day1),false);assert.equal(needsReview(s.records.a,day2),true);
  assert.deepEqual(studyStats([{id:'a'},{id:'b'}],s,day2),{total:2,solved:1,clean:1,retained:0,due:1});
});
test('corrupt data is safely handled and valid progress survives reload',()=>{
  assert.deepEqual(restoreStudy('{bad',['a']),freshStudy());
  const s=freshStudy();recordSolve(s,'a',true,day1);reveal(s,'a',day1);
  const restored=restoreStudy(JSON.stringify(s),['a']);assert.deepEqual(restored,s);
});
