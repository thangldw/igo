import {botCandidates,move,group,score} from './engine.js?v=20261005search';
function candidates(b,n,color,history){if(color===2)return botCandidates(b,n,history);return botCandidates(b.map(c=>c?3-c:0),n,history.map(s=>[...s].map(c=>c==='0'?'0':String(3-Number(c))).join('')));}
function evaluate(b,n,color){
 const area=score(b,n,0);let value=area.white-area.black;const seen=new Set();
 for(let i=0;i<b.length;i++)if(b[i]&&!seen.has(i)){const g=group(b,i,n);g.stones.forEach(p=>seen.add(p));const risk=g.liberties.length===1?g.stones.length*5:g.liberties.length===2?g.stones.length*1.5:0;value+=(b[i]===2?-risk:risk);}
 return color===2?value:-value;
}
export function analyzePosition(b,n,color,history=[],actual){
 const top=candidates(b,n,color,history).slice(0,6);if(actual!==undefined&&!top.some(x=>x.i===actual))top.push({i:actual});
 const options=[];
 for(const {i} of top){const first=i===-1?{board:[...b],captured:0}:move(b,i,color,n,history);if(first.error)continue;
  const h=i===-1?history:[...history,first.board.join('')];const replies=candidates(first.board,n,3-color,h).slice(0,6);let worst=Infinity,reply=-1;
  for(const c of replies){const r=move(first.board,c.i,3-color,n,h);if(r.error)continue;const value=evaluate(r.board,n,color);if(value<worst){worst=value;reply=c.i;}}
  if(worst===Infinity)worst=evaluate(first.board,n,color);options.push({point:i,reply,value:worst,captured:first.captured});
 }
 options.sort((a,b)=>b.value-a.value);
 return {best:options[0]||{point:-1,reply:-1,value:evaluate(b,n,color)},actual:options.find(x=>x.point===actual),options,nodes:top.length*6};
}
