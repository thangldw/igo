import {empty,move} from './engine.js';
export const GAME_KEY='igo-game-v1',REVIEW_GAME_KEY='igo-game-review-v1';
export function replayRecord(record){
  if(record?.version!==1||![9,13,19].includes(record.size)||!Array.isArray(record.moves)||record.moves.length>5000)throw Error('Ván lưu không hợp lệ.');
  const n=record.size;let board=empty(n),history=[board.join('')],last=-1,captures=[0,0],passes=0,next=1;const snapshots=[];
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
  return `(;FF[4]GM[1]CA[UTF-8]SZ[${record.size}]KM[6.5]RU[Chinese]PB[Bạn]PW[${escape(record.difficulty||'Máy luyện tập')}]`+
    record.moves.map(({color,point})=>`;${color===1?'B':'W'}[${point===-1?'':String.fromCharCode(97+point%record.size,97+Math.floor(point/record.size))}]`).join('')+')';
}
