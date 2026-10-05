import {neighbors} from './engine.js';
export function areaScore(board,n,dead=[]){
 const b=[...board];for(const i of dead){if(!Number.isInteger(i)||i<0||i>=b.length||!board[i])throw Error('Quân chết không hợp lệ.');b[i]=0;}
 const owners=Array(n*n).fill(0),seen=new Set();let blackStones=0,whiteStones=0,blackLand=0,whiteLand=0,neutral=0;
 b.forEach((c,i)=>{if(c===1)blackStones++;if(c===2)whiteStones++;if(c)owners[i]=c;});
 for(let i=0;i<b.length;i++)if(!b[i]&&!seen.has(i)){
  const region=[i],colors=new Set();seen.add(i);for(const p of region)for(const q of neighbors(p,n)){if(b[q])colors.add(b[q]);else if(!seen.has(q)){seen.add(q);region.push(q);}}
  const owner=colors.size===1?[...colors][0]:0;region.forEach(p=>owners[p]=owner);if(owner===1)blackLand+=region.length;else if(owner===2)whiteLand+=region.length;else neutral+=region.length;
 }
 return {owners,blackStones,whiteStones,blackLand,whiteLand,neutral,black:blackStones+blackLand,white:whiteStones+whiteLand+6.5};
}
