import {analyzePosition} from './search-engine.js';
import {empty,move} from './engine.js';
self.onmessage=({data})=>{try{
 if(data.type==='move')self.postMessage({result:analyzePosition(data.board,data.size,2,data.history)});
 else{
  const {record}=data;let board=empty(record.size),history=[board.join('')];const findings=[];
  for(let k=0;k<record.moves.length;k++){const m=record.moves[k];if(m.color===1){const r=analyzePosition(board,record.size,1,history,m.point);if(r.actual&&r.best.point!==m.point)findings.push({move:k+1,played:m.point,...r.best,gap:r.best.value-r.actual.value});self.postMessage({progress:k+1,total:record.moves.length});}
   if(m.point!==-1){const r=move(board,m.point,m.color,record.size,history);if(r.error)throw Error(r.error);board=r.board;history.push(board.join(''));}
  }
  findings.sort((a,b)=>b.gap-a.gap);self.postMessage({findings:findings.slice(0,5)});
 }
}catch(e){self.postMessage({error:e.message});}};
