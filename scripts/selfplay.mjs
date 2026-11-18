// Pits two bot engines against each other on a small board and reports the win rate.
// Usage: node scripts/selfplay.mjs <candidateEngine.js> <baselineEngine.js> [games] [size]
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const [candidatePath, baselinePath, games = '100', size = '9'] = process.argv.slice(2);
const load = async (p) => import(pathToFileURL(resolve(p)).href);
const [A, B] = [await load(candidatePath), await load(baselinePath)];
const n = Number(size);

function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const flip = (b) => b.map((c) => (c ? 3 - c : 0));
const flipHistory = (h) => h.map((s) => [...s].map((c) => (c === '0' ? '0' : String(3 - Number(c)))).join(''));

// The engines' bot() always plays White; Black asks the same question on the colour-flipped board.
function pick(engine, board, color, history, random) {
  if (color === 2) return engine.bot(board, n, history, { difficulty: 'basic', random });
  return engine.bot(flip(board), n, flipHistory(history), { difficulty: 'basic', random });
}

function play(blackEngine, whiteEngine, seed) {
  const random = mulberry32(seed);
  let board = blackEngine.empty(n),
    history = [board.join('')],
    color = 1,
    passes = 0;
  for (let turn = 0; turn < n * n * 3 && passes < 2; turn++) {
    const engine = color === 1 ? blackEngine : whiteEngine;
    const point = pick(engine, board, color, history, random);
    const result = point === null ? null : blackEngine.move(board, point, color, n, history);
    if (!result || result.error) passes++;
    else {
      board = result.board;
      history.push(board.join(''));
      passes = 0;
    }
    color = 3 - color;
  }
  const s = blackEngine.score(board, n, 6.5);
  return s.black > s.white ? 1 : 2;
}

let candidateWins = 0;
const total = Number(games);
for (let g = 0; g < total; g++) {
  const candidateIsBlack = g % 2 === 0,
    winner = candidateIsBlack ? play(A, B, g + 1) : play(B, A, g + 1);
  if ((winner === 1) === candidateIsBlack) candidateWins++;
}
console.log(`candidate won ${candidateWins}/${total} (${((100 * candidateWins) / total).toFixed(0)}%) on ${n}x${n}`);
