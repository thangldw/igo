// Shared state and tiny helpers of the lesson/play page.

import { lessons, levels } from './lessons.js';
import { createSearchClient } from './search-client.js';
import { createGameClock } from './game-clock.js';
import { loadProgress } from './lesson-storage.js';
import { coordinate } from './board-view.js';

/** @type {(id: string) => any} DOM lookups are by known ids in the page markup. */
export const $ = (id) => document.getElementById(id);

export const search = createSearchClient();

/**
 * @typedef {{ board: number[], history: string[], last: number, captures: number[], passes: number,
 *   moveCount: number }} Snapshot
 * @typedef {{ color: number, point: number }} GameMove
 * @typedef {{
 *   done: string[], lesson: number, level: string, n: number, board: number[], history: string[],
 *   snapshots: Snapshot[], last: number, mode: 'lesson' | 'game', passes: number, ended: boolean,
 *   captures: number[], selected: number, hinted: boolean, busy: boolean, epoch: number,
 *   solved: boolean, lineStep: number, candidates: number[][], gameMoves: GameMove[],
 *   deadStones: Set<number>, pendingPoint: number, handicap: number, komi: number
 * }} AppState
 */
/** @type {AppState} */
export const app = {
  done: loadProgress(lessons),
  lesson: 0,
  level: 'beginner',
  n: 5,
  board: [],
  history: [],
  snapshots: [],
  last: -1,
  mode: 'lesson',
  passes: 0,
  ended: false,
  captures: [0, 0],
  selected: -1,
  hinted: false,
  busy: false,
  epoch: 0,
  solved: false,
  lineStep: 0,
  candidates: [],
  gameMoves: [],
  deadStones: new Set(),
  pendingPoint: -1,
  handicap: 0,
  komi: 6.5,
};

/** @param {number} i */
export const pointName = (i) => coordinate(i, app.n);

export const current = () => lessons[app.lesson];

export const currentLevel = () => levels.find((l) => l.id === app.level);

export const levelLessons = () => lessons.filter((l) => l.level === app.level);

export const targets = () =>
  current().lines
    ? [...new Set(app.candidates.map((line) => line[app.lineStep]))]
    : [current().target];

/** @param {string} text @param {string} [type] */
export function message(text, type = '') {
  $('feedback').textContent = text;
  $('feedback').className = type;
}

export const clock = createGameClock({
  element: $('game-clock'),
  getLimit: () => Number($('clock-limit').value),
  isRunning: () => !app.busy,
  onExpire: () =>
    message('Hết giờ do bạn đặt. Ván tập vẫn tiếp tục; đây chỉ là nhắc nhịp suy nghĩ.'),
});
