import fs from 'node:fs';
import {empty,group} from '../engine.js';
import {boundedReader} from '../reading.js';
const bank=JSON.parse(fs.readFileSync('reading-bank.json')).filter(p=>p.goal!=='eyes');
const quotas={1:4,3:8,5:4,7:4},counts={},seen=new Set();
function canonical(points){const v=[];for(let flip=0;flip<2;flip++)for(let turn=0;turn<4;turn++){const out=points.map(i=>{let r=Math.floor(i/3),c=i%3;if(flip)c=2-c;for(let k=0;k<turn;k++)[r,c]=[c,2-r];return r*3+c;}).sort((a,b)=>a-b);v.push(out.join(','));}return v.sort()[0];}
for(let mask=1;mask<512;mask++){
 const cells=Array.from({length:9},(_,i)=>i).filter(i=>mask&(1<<i));if(cells.length<4||cells.length>8)continue;
 const shape=empty(3);cells.forEach(i=>shape[i]=1);if(group(shape,cells[0],3).stones.length!==cells.length)continue;
 const signature=canonical(cells);if(seen.has(signature))continue;seen.add(signature);
 const n=7,b=empty(n);for(let r=0;r<n;r++)for(let c=0;c<n;c++){
  if((r===0||r===6)&&(c===0||c===6))continue;b[r*n+c]=r===0||r===6||c===0||c===6?2:1;
 }
 cells.forEach(i=>b[(Math.floor(i/3)+2)*n+(i%3+2)]=0);
 if(group(b,8,n).stones.length!==b.filter(c=>c===1).length)continue;
 for(const depth of [1,3,5,7]){
  const reader=boundedReader(b,n,8,depth,undefined,200000,'eyes'),verdict=reader.read();
  if(!verdict.certain)break;
  if(verdict.win){
   if((counts[depth]||0)<quotas[depth]){
    const winning=reader.winningMoves();if(winning.certain){
     const p={size:n,setup:b.map((c,i)=>[i,c]).filter(x=>x[1]),target:8,depth,winning:winning.moves,holes:cells.length,shape:signature,goal:'eyes'};
     let hash=2166136261;for(const c of `eyes:${b.join('')}:${depth}`)hash=Math.imul(hash^c.charCodeAt(0),16777619)>>>0;p.id=`e-${hash.toString(16)}`;
     bank.push(p);counts[depth]=(counts[depth]||0)+1;console.log(`make eyes ${cells.length} points / ${depth} plies`);
    }
   }
   break;
  }
 }
}
fs.writeFileSync('reading-bank.json',JSON.stringify(bank));console.log(JSON.stringify({total:bank.length,eyes:counts}));
