export const empty = n => Array(n*n).fill(0);
export function neighbors(i,n){return [i%n>0?i-1:-1,i%n<n-1?i+1:-1,i>=n?i-n:-1,i<n*(n-1)?i+n:-1].filter(x=>x>=0)}
export function group(b,i,n){const color=b[i], stones=new Set([i]), liberties=new Set(), queue=[i];for(const p of queue)for(const q of neighbors(p,n)){if(!b[q])liberties.add(q);else if(b[q]===color&&!stones.has(q)){stones.add(q);queue.push(q)}}return {stones:[...stones],liberties:[...liberties]}}
export function move(b,i,color,n,history=[]){if(b[i]||i<0||i>=b.length)return {error:'Giao điểm này đã có quân.'};const next=[...b];next[i]=color;let captured=0;for(const q of neighbors(i,n))if(next[q]===3-color){const g=group(next,q,n);if(!g.liberties.length){captured+=g.stones.length;g.stones.forEach(p=>next[p]=0)}}if(!group(next,i,n).liberties.length)return {error:'Tự sát: nhóm của bạn không còn khí. Hãy chọn điểm khác.'};if(history.includes(next.join('')))return {error:'Ko: không được lặp lại thế bàn đã xuất hiện. Hãy đi nơi khác.'};return {board:next,captured}}
export function score(b,n,komi=6.5){let black=b.filter(x=>x===1).length,white=b.filter(x=>x===2).length,neutral=0;const seen=new Set();for(let i=0;i<b.length;i++)if(!b[i]&&!seen.has(i)){const region=[i],colors=new Set();seen.add(i);for(const p of region)for(const q of neighbors(p,n)){if(b[q])colors.add(b[q]);else if(!seen.has(q)){seen.add(q);region.push(q)}}if(colors.size===1){if(colors.has(1))black+=region.length;else white+=region.length}else neutral+=region.length}return {black,white:white+komi,neutral}}
export function botCandidates(b,n,history=[]) {
  const before=score(b,n,0), candidates=[];
  for(let i=0;i<b.length;i++) {
    const result=move(b,i,2,n,history);
    if(result.error)continue;
    const own=group(result.board,i,n);
    let rescue=0,pressure=0;
    const seen=new Set();
    for(const q of neighbors(i,n)) {
      if(b[q]===2&&!seen.has(q)) {
        const g=group(b,q,n);g.stones.forEach(p=>seen.add(p));
        if(g.liberties.length===1&&own.liberties.length>1)rescue+=g.stones.length;
      }
      if(result.board[q]===1&&group(result.board,q,n).liberties.length===1)pressure++;
    }
    // Filling settled territory adds no area; keep captures and emergency saves.
    const after=score(result.board,n,0);
    const gain=(after.white-after.black)-(before.white-before.black);
    if(!result.captured&&!rescue&&(gain<=0||own.liberties.length===1))continue;
    const r=Math.floor(i/n),c=i%n;
    const value=result.captured*30+rescue*20+pressure*8+Math.min(own.liberties.length,5)*1.2
      -(Math.abs(r-(n-1)/2)+Math.abs(c-(n-1)/2))*.12;
    candidates.push({i,value});
  }
  candidates.sort((a,b)=>b.value-a.value);
  return candidates;
}
export function bot(b,n,history=[],{difficulty='basic',random=Math.random}={}){
  const candidates=botCandidates(b,n,history);
  if(!candidates.length)return null;
  const choices=difficulty==='easy'?candidates.slice(0,Math.min(8,candidates.length)):
    candidates.filter(c=>c.value>=candidates[0].value-.8);
  return choices[Math.min(choices.length-1,Math.floor(random()*choices.length))].i;
}
