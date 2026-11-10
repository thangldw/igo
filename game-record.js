import {empty,move} from './engine.js';
export const GAME_KEY='igo-game-v1',REVIEW_GAME_KEY='igo-game-review-v1';
export const DEFAULT_KOMI=6.5,HANDICAP_KOMI=0.5;
// Standard handicap points on the star points: corners first, then the sides, then the centre.
export function handicapPoints(size,count){
  if(!Number.isInteger(count)||count<2||count>9||![9,13,19].includes(size))return [];
  const e=size===9?2:3,m=(size-1)/2,f=size-1-e,at=(r,c)=>r*size+c;
  const corners=[at(e,f),at(f,e),at(f,f),at(e,e)],sides=[at(m,e),at(m,f)],ends=[at(e,m),at(f,m)],centre=at(m,m);
  const sets={2:[corners[0],corners[1]],3:corners.slice(0,3),4:corners,5:[...corners,centre],6:[...corners,...sides],7:[...corners,...sides,centre],8:[...corners,...sides,...ends],9:[...corners,...sides,...ends,centre]};
  return sets[count];
}
export function recordKomi(record){return Number.isFinite(record?.komi)&&record.komi>=-30&&record.komi<=30&&record.komi*2===Math.round(record.komi*2)?record.komi:(record?.handicap>=2?HANDICAP_KOMI:DEFAULT_KOMI);}
export function replayRecord(record){
  if(record?.version!==1||![9,13,19].includes(record.size)||!Array.isArray(record.moves)||record.moves.length>5000)throw Error('Ván lưu không hợp lệ.');
  const n=record.size,handicap=record.handicap===undefined?0:record.handicap;
  if(handicap!==0&&!(Number.isInteger(handicap)&&handicap>=2&&handicap<=9))throw Error('Số quân chấp không hợp lệ.');
  let board=empty(n);for(const p of handicapPoints(n,handicap))board[p]=1;
  let history=[board.join('')],last=-1,captures=[0,0],passes=0,next=handicap?2:1;const snapshots=[];
  for(let k=0;k<record.moves.length;k++){
    const m=record.moves[k];if(m.color!==next||!Number.isInteger(m.point)||m.point< -1||m.point>=n*n||passes>=2)throw Error('Chuỗi nước lưu không hợp lệ.');
    if(next===1)snapshots.push({board:[...board],history:[...history],last,captures:[...captures],passes,moveCount:k});
    if(m.point===-1)passes++;
    else{const r=move(board,m.point,next,n,history);if(r.error)throw Error(r.error);board=r.board;history.push(board.join(''));captures[next-1]+=r.captured;last=m.point;passes=0;}
    next=3-next;
  }
  return {board,history,last,captures,passes,next,snapshots,ended:passes>=2};
}
export function recordSgf(record){
  replayRecord(record);
  const escape=s=>String(s).replace(/\\/g,'\\\\').replace(/\]/g,'\\]');
  const coord=p=>String.fromCharCode(97+p%record.size,97+Math.floor(p/record.size)),stones=handicapPoints(record.size,record.handicap||0);
  return `(;FF[4]GM[1]CA[UTF-8]SZ[${record.size}]KM[${recordKomi(record)}]RU[Chinese]PB[Bạn]PW[${escape(record.difficulty||'Máy luyện tập')}]`+(stones.length?`HA[${stones.length}]AB${stones.map(p=>`[${coord(p)}]`).join('')}`:'')+
    record.moves.map(({color,point})=>`;${color===1?'B':'W'}[${point===-1?'':String.fromCharCode(97+point%record.size,97+Math.floor(point/record.size))}]`).join('')+')';
}
