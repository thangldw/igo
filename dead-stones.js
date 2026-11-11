import {move,group,neighbors} from './engine.js';
// Suggests dead stones at the end of a game by Monte-Carlo ownership: play random games to the end
// (never filling an own eye) and see which colour owns each stone's point most of the time.
// It is a heuristic suggestion; the player can still toggle any group. Groups in a simple seki (every liberty is a point
// where neither colour can play without self-atari or capturing) are never suggested.
export function mulberry32(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function fillsOwnEye(b,i,color,n){return neighbors(i,n).every(q=>b[q]===color);}
function ownership(b,n){
  const owners=Array(b.length).fill(0),seen=new Set();
  b.forEach((c,i)=>{if(c)owners[i]=c;});
  for(let i=0;i<b.length;i++)if(!b[i]&&!seen.has(i)){
    const region=[i],colors=new Set();seen.add(i);
    for(const p of region)for(const q of neighbors(p,n)){if(b[q])colors.add(b[q]);else if(!seen.has(q)){seen.add(q);region.push(q);}}
    const owner=colors.size===1?[...colors][0]:0;for(const p of region)owners[p]=owner;
  }
  return owners;
}
// Light policy: capture a group in atari if possible, otherwise rescue an own group in atari, otherwise random.
function urgentMoves(b,n,color){
  const capture=new Set(),save=new Set(),seen=new Set();
  for(let i=0;i<b.length;i++)if(b[i]&&!seen.has(i)){
    const g=group(b,i,n);g.stones.forEach(p=>seen.add(p));
    if(g.liberties.length===1)(b[i]===color?save:capture).add(g.liberties[0]);
  }
  return [...capture,...save];
}
function playout(start,n,toMove,rand){
  let b=start,color=toMove,passes=0;
  for(let step=0,limit=n*n*2;step<limit&&passes<2;step++){
    let played=false;
    if(rand()<.9)for(const i of urgentMoves(b,n,color)){const r=move(b,i,color,n);if(!r.error){b=r.board;played=true;break;}}
    if(!played){
      const empties=[];for(let i=0;i<b.length;i++)if(!b[i]&&!fillsOwnEye(b,i,color,n))empties.push(i);
      while(empties.length){
        const k=Math.floor(rand()*empties.length),i=empties[k];empties[k]=empties[empties.length-1];empties.pop();
        const r=move(b,i,color,n);if(!r.error){b=r.board;played=true;break;}
      }
    }
    passes=played?0:passes+1;color=3-color;
  }
  return ownership(b,n);
}
// Simple seki: each liberty of the group is a point where neither colour can play without ending in atari, and no
// capture follows. Seki with ko or outside liberties is not detected; those groups can still be toggled by hand.
export function inSeki(board,n,g){
  if(!g.liberties.length)return false;
  return g.liberties.every(p=>[1,2].every(color=>{
    const r=move(board,p,color,n);
    return !r.error&&r.captured===0&&group(r.board,p,n).liberties.length<=1;
  }));
}
export function suggestDead(board,n,{playouts=n<=9?160:n<=13?90:50,threshold=.8,seed=1,toMove=1}={}){
  const rand=mulberry32(seed),mine=Array(board.length).fill(0);
  for(let k=0;k<playouts;k++){const o=playout(board,n,k%2?3-toMove:toMove,rand);for(let i=0;i<o.length;i++)if(o[i]===board[i])mine[i]++;}
  // A stone is dead when the opponent owns its point in most playouts; judge whole groups by their average.
  const dead=[],seen=new Set();
  for(let i=0;i<board.length;i++)if(board[i]&&!seen.has(i)){
    const g=group(board,i,n);g.stones.forEach(p=>seen.add(p));
    const kept=g.stones.reduce((s,p)=>s+mine[p],0)/(g.stones.length*playouts);
    if(kept<1-threshold&&!inSeki(board,n,g))dead.push(...g.stones);
  }
  return dead.sort((a,b)=>a-b);
}
