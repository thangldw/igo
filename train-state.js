// Shared state and small helpers of the training page.

import { stages } from './curriculum.js';
import { storageStatusText } from './train-view.js';
import { createReadingClient } from './reading-client.js';
import { saveStudy } from './study-storage.js';
import { coordinate as boardCoordinate } from './board-view.js';

/** @type {(id: string) => any} DOM lookups are by known ids in the page markup. */
export const $ = (id) => document.getElementById(id),
  KEY = 'igo-study-v1';

/**
 * @typedef {{ board: number[], point: number, color: number, refute?: boolean }} TraceStep
 * @typedef {{ id: string, correct: boolean, ms: number }} TestResult
 * @typedef {{
 *   bank: any[], study: any, stage: string, topic: string, mode: string, queue: any[],
 *   index: number, puzzle: any, board: number[], history: string[], remaining: number,
 *   last: number, selected: number, hinted: number, busy: boolean, finished: boolean,
 *   wrong: number, assisted: boolean, attemptStarted: boolean, epoch: number,
 *   testResults: TestResult[], autoPlay: boolean, storageAvailable: boolean,
 *   storageWritable: boolean, trace: TraceStep[], viewStep: number, hintLevel: number,
 *   startedAt: number
 * }} TrainState  bank items, the study record and the current puzzle are validated elsewhere.
 */
/** @type {TrainState} */
export const train = {
  bank: [],
  study: undefined,
  stage: 'foundation',
  topic: 'all',
  mode: 'practice',
  queue: [],
  index: 0,
  puzzle: undefined,
  board: [],
  history: [],
  remaining: 0,
  last: -1,
  selected: -1,
  hinted: -2,
  busy: false,
  finished: false,
  wrong: 0,
  assisted: false,
  attemptStarted: false,
  epoch: 0,
  testResults: [],
  autoPlay: false,
  storageAvailable: true,
  storageWritable: true,
  trace: [],
  viewStep: -1,
  hintLevel: 0,
  startedAt: 0,
};

export const reading = createReadingClient();

export function showPuzzle() {
  const heading = $('test-result').hidden ? $('title') : $('test-result');
  heading.tabIndex = -1;
  heading.focus({ preventScroll: true });
  heading.scrollIntoView({ block: 'start' });
}

export const stageInfo = () => stages.find((s) => s.id === train.stage);

/** @param {number} point @param {number} size */
export const coordinate = (point, size) =>
  point === -1 ? 'bỏ lượt' : boardCoordinate(point, size);

/** @param {string} text @param {string} [type] */
export function feedback(text, type = '') {
  $('feedback').textContent = text;
  $('feedback').className = type;
}

export function save() {
  if (train.storageWritable && !saveStudy(KEY, train.study)) train.storageAvailable = false;
  $('storage-status').textContent = storageStatusText({
    writable: train.storageWritable,
    available: train.storageAvailable,
  });
}

/** @param {string} action @param {number} [point] */
export function ask(action, point) {
  return reading.ask({
    action,
    point,
    board: train.board,
    size: train.puzzle.size,
    target: train.puzzle.target,
    remaining: train.remaining,
    history: train.history,
    goal: train.puzzle.goal || 'capture',
  });
}
