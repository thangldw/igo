import { test } from 'node:test';
import assert from 'node:assert/strict';
import { empty, move, score, bot } from '../engine.js';

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
const flipHistory = (h) =>
  h.map((s) => [...s].map((c) => (c === '0' ? '0' : String(3 - Number(c)))).join(''));

// Plays one 9x9 game: the bot (as `botColor`) against a player choosing uniformly among legal moves.
function botBeatsRandom(botColor, seed) {
  const n = 9,
    random = mulberry32(seed);
  let board = empty(n),
    history = [board.join('')],
    color = 1,
    passes = 0;
  for (let turn = 0; turn < 300 && passes < 2; turn++) {
    let point = null;
    if (color === botColor) {
      point =
        color === 2
          ? bot(board, n, history, { random })
          : bot(flip(board), n, flipHistory(history), { random });
    } else {
      const legal = [];
      for (let i = 0; i < board.length; i++)
        if (!move(board, i, color, n, history).error) legal.push(i);
      // The random player stops once the board is crowded so that games terminate.
      if (legal.length > 12) point = legal[Math.floor(random() * legal.length)];
    }
    const result = point === null ? null : move(board, point, color, n, history);
    if (!result || result.error) passes++;
    else {
      board = result.board;
      history.push(board.join(''));
      passes = 0;
    }
    color = 3 - color;
  }
  const s = score(board, n, 6.5);
  return botColor === 1 ? s.black > s.white : s.white > s.black;
}

test('the bot clearly beats a random legal-move player on 9x9, as either colour', () => {
  let wins = 0;
  for (let g = 0; g < 20; g++) if (botBeatsRandom(g % 2 === 0 ? 2 : 1, 100 + g)) wins++;
  assert.ok(wins >= 17, `bot won only ${wins}/20`);
});
