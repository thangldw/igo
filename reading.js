import {group, move, neighbors} from './engine.js';

export function trueEyes(board,size,target){
  if(board[target]!==1)return [];
  const stones=new Set(group(board,target,size).stones);
  return board.map((c,i)=>i).filter(i=>!board[i]&&neighbors(i,size).every(p=>stones.has(p)));
}
export function goalAchieved(board,size,target,goal='capture'){
  return goal==='eyes'?trueEyes(board,size,target).length>=2:board[target]!==2;
}

// A bounded adversarial reading test, not a whole-game strength evaluator.
// Every legal placement is considered. White may also pass. Black must
// place a stone: passing lets White end the reading game with a second pass.
export function boundedReader(start, size, target, depth, startHistory = [start.join('')], limit = 250000, goal = 'capture') {
  let nodes = 0;
  const memo = new Map();
  function search(board, color, remaining, history) {
    if (goalAchieved(board,size,target,goal)) return {win: true, distance: 0};
    if (goal==='eyes'&&board[target]!==1) return {win:false,distance:0};
    if (!remaining) return {win: false, distance: 0};
    if (++nodes > limit) throw new Error('READING_LIMIT');
    // A defender can pass, so the attacker needs at least one placement per liberty.
    const liberties = group(board, target, size).liberties;
    const blackTurns = Math.floor((remaining + (color === 1 ? 1 : 0)) / 2);
    if (goal==='capture' && liberties.length > blackTurns) return {win: false, distance: 0};
    const key = `${board.join('')}:${color}:${remaining}:${history.join(',')}`;
    if (memo.has(key)) return memo.get(key);
    const options = [];
    for (let i = 0; i < board.length; i++) {
      if (board[i]) continue;
      const result = move(board, i, color, size, history);
      if (!result.error) options.push({point: i, board: result.board, priority: result.captured * 100 + (liberties.includes(i) ? 20 : 0)});
    }
    options.sort((a, b) => b.priority - a.priority || a.point - b.point);
    if (color === 2) options.push({point: -1, board});
    let selected = {win: color === 2, distance: 0, point: -1};
    for (const option of options) {
      const nextHistory = option.point === -1 ? history : [...history, option.board.join('')];
      const child = search(option.board, 3 - color, remaining - 1, nextHistory);
      const result = {win: child.win, distance: child.distance + 1, point: option.point};
      if (color === 1 && result.win) { selected = result; break; }
      if (color === 2 && !result.win) { selected = result; break; }
      if (color === 2 && result.win && result.distance >= selected.distance) selected = result;
    }
    memo.set(key, selected);
    return selected;
  }
  return {
    read(board = start, color = 1, remaining = depth, history = startHistory) {
      try { return {...search(board, color, remaining, history), nodes, certain: true}; }
      catch (error) { if (error.message !== 'READING_LIMIT') throw error; return {certain: false, nodes}; }
    },
    winningMoves(board = start, remaining = depth, history = startHistory) {
      const results = [];
      for (let i = 0; i < board.length; i++) {
        const result = move(board, i, 1, size, history);
        if (result.error) continue;
        const verdict = this.read(result.board, 2, remaining - 1, [...history, result.board.join('')]);
        if (!verdict.certain) return {certain: false, moves: results, nodes};
        if (verdict.win) results.push(i);
      }
      return {certain: true, moves: results, nodes};
    }
  };
}

export function captureReader(...args){return boundedReader(...args);}
