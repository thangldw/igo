import fs from 'node:fs';
import {empty,group,move} from '../engine.js';
import {captureReader} from '../reading.js';

const results=[];
function connected(points,n){const b=empty(n);points.forEach(i=>b[i]=1);return group(b,points[0],n).stones.length===points.length}
function canonical(points,n){const versions=[];for(let flip=0;flip<2;flip++)for(let turn=0;turn<4;turn++){const out=points.map(i=>{let r=Math.floor(i/n),c=i%n;if(flip)c=n-1-c;for(let k=0;k<turn;k++)[r,c]=[c,n-1-r];return r*n+c}).sort((a,b)=>a-b);versions.push(out.join(','))}return versions.sort()[0]}
const seen=new Set();
for(let mask=1;mask<512;mask++){
 const points=Array.from({length:9},(_,i)=>i).filter(i=>mask&(1<<i));
 if(points.length<3||points.length>7||!connected(points,3))continue;
 const shape=canonical(points,3);if(seen.has(shape))continue;seen.add(shape);
 const n=7,b=empty(n),holes=points.map(i=>(Math.floor(i/3)+2)*n+(i%3+2));
 for(let r=0;r<n;r++)for(let c=0;c<n;c++){
  const i=r*n+c;
  if((r===0||r===6)&&(c===0||c===6))continue;
  b[i]=(r===0||r===6||c===0||c===6)?1:2;
 }
 holes.forEach(i=>b[i]=0);
 if(group(b,8,n).stones.length!==b.filter(c=>c===2).length)continue;
 let found;
 for(const depth of [3,5,7,9]){
  const reader=captureReader(b,n,8,depth,undefined,180000), verdict=reader.read();
  if(!verdict.certain)break;
  if(verdict.win){const moves=reader.winningMoves();if(moves.certain){found={size:n,setup:b.map((c,i)=>[i,c]).filter(x=>x[1]),target:8,depth,winning:moves.moves,holes:points.length,shape};}break}
 }
 if(found){results.push(found);console.log(`eyes ${results.length}: ${points.length} pts, depth ${found.depth}`)}
}
let seed=14279;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
const positions=new Set();let tactical=0; const quotas={1:8,3:12,5:12,7:12,9:12,11:8}; const counts={};
for(let trial=0;trial<20000&&tactical<64;trial++){
 const n=5;let b=empty(n),h=[b.join('')];
 for(let k=0;k<24+trial%13;k++){const r=move(b,Math.floor(rand()*25),k%2+1,n,h);if(!r.error){b=r.board;h.push(b.join(''))}}
 const signature=canonical(b.map((c,i)=>c===1?i:-1).filter(i=>i>=0),5)+'|'+canonical(b.map((c,i)=>c===2?i:-1).filter(i=>i>=0),5);
 if(positions.has(signature))continue;
 const visited=new Set();
 const targets=b.map((c,i)=>i).filter(i=>b[i]===2).sort((a,z)=>group(b,z,n).liberties.length-group(b,a,n).liberties.length);
 for(const target of targets){
  if(b[target]!==2||visited.has(target))continue;
  const g=group(b,target,n);g.stones.forEach(i=>visited.add(i));
  if(g.liberties.length<1||g.liberties.length>3)continue;
  let found;
  for(const depth of [1,3,5,7,9,11]){
   const reader=captureReader(b,n,target,depth,undefined,140000),verdict=reader.read();
   if(!verdict.certain)break;
   if(verdict.win){const wins=reader.winningMoves();if(wins.certain&&(counts[depth]||0)<quotas[depth])found={size:n,setup:b.map((c,i)=>[i,c]).filter(x=>x[1]),target,depth,winning:wins.moves,stones:g.stones.length,shape:'tactical'};break}
  }
  if(found){results.push(found);tactical++;counts[found.depth]=(counts[found.depth]||0)+1;positions.add(signature);console.log(`tactical ${tactical}: ${g.stones.length} stones, depth ${found.depth}`);break}
 }
}
for(const p of results){const b=empty(p.size);for(const [i,c] of p.setup)b[i]=c;const value=`${p.size}:${b.join('')}:${p.target}:${p.depth}`;let hash=2166136261;for(const c of value)hash=Math.imul(hash^c.charCodeAt(0),16777619)>>>0;p.id=`r-${hash.toString(16)}`;}
fs.writeFileSync('reading-bank.json',JSON.stringify(results));
console.log(JSON.stringify({total:results.length,depths:results.reduce((a,p)=>(a[p.depth]=(a[p.depth]||0)+1,a),{})}));
