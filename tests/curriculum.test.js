import test from 'node:test';
import assert from 'node:assert/strict';
import {questions,stages} from '../curriculum.js';
test('new stages add 42 exercises without replacing old question ids',()=>{
  assert.equal(stages.length,7);assert.equal(questions.filter(q=>q.stage==='dan2').length,18);assert.equal(questions.filter(q=>q.stage==='dan3').length,24);
  assert.ok(questions.some(q=>q.id==='q-rank-proof'&&q.stage==='dan'));assert.equal(new Set(questions.map(q=>q.id)).size,87);
});
test('finite endgame exercise answers match two-outcome arithmetic',()=>{
  const family=questions.filter(q=>q.id.startsWith('q-yose-independent-'));
  assert.equal(family.length,8);assert.equal(new Set(family.map(q=>q.prompt)).size,8);
  for(const q of family){const match=q.prompt.match(/A = (\d+), B = (\d+)/);const a=Number(match[1]),b=Number(match[2]);
    const outcomeA=a-b,outcomeB=b-a;assert.equal(q.choices[q.answer],`${outcomeA-outcomeB} điểm`);
  }
  const sente=questions.find(q=>q.id==='q-reverse-sente-model');assert.equal(sente.choices[sente.answer],8-12>2-8?'Đen A trước':'Đen B trước');
});
test('ko answers match alternating independent threat expenditure',()=>{
  for(const q of questions.filter(q=>q.id.startsWith('q-ko-budget-'))){const m=q.prompt.match(/Trắng có (\d+).*Đen có (\d+)/);let white=Number(m[1]),black=Number(m[2]),holder='Đen';
    while(true){const challenger=holder==='Đen'?'Trắng':'Đen';if(challenger==='Trắng'){if(!white)break;white--;}else{if(!black)break;black--;}holder=challenger;}
    assert.equal(q.choices[q.answer],holder);
  }
});
test('close-game answers apply komi-adjusted margin exactly once',()=>{
  for(const q of questions.filter(q=>q.id.startsWith('q-safe-yose-'))){const m=q.prompt.match(/hơn (\d+) điểm.*giảm (\d+)/);assert.equal(q.choices[q.answer],String(Number(m[1])-Number(m[2])));}
});
