// Board rendering and point clicks for the lesson/play page.

import { group } from './engine.js';
import { areaScore } from './area-score.js';
import { scoreSummary } from './game-text.js';
import { turnText, capturedText } from './lesson-view.js';
import {
  coordinate,
  colorName,
  isStarPoint,
  span,
  createPoint,
  appendStone,
  appendEdgeLabels,
  boardPixelWidth,
} from './board-view.js';
import { $, app, current, message, pointName, targets } from './play-state.js';
import { playGameMove, toggleDeadGroup } from './game-flow.js';
import { playLessonMove } from './lesson-flow.js';

function scoreDetails() {
  const s = areaScore(app.board, app.n, [...app.deadStones], app.komi);
  $('score-detail').textContent = scoreSummary(s, app.komi);
  return s;
}

export function draw() {
  const root = $('board');
  const large = app.mode === 'game' && app.n > 9;
  const width = boardPixelWidth({
    n: app.n,
    zoom: 1,
    columnWidth: document.querySelector('.stage-board').clientWidth - 48,
    viewportHeight: window.innerHeight,
  });
  root.style.minWidth = large ? `${width}px` : '';
  $('play-surface').style.minWidth = large ? `${width + 48}px` : '';
  root.replaceChildren();
  root.style.gridTemplateColumns = `repeat(${app.n},1fr)`;
  $('scoring-panel').hidden = $('analysis-panel').hidden = app.mode !== 'game' || !app.ended;
  const scored = app.mode === 'game' && app.ended ? scoreDetails() : null;
  $('confirm-point').hidden = $('cancel-point').hidden = app.pendingPoint < 0;
  for (const id of ['export-game', 'review-game', 'analyze-game', 'confirm-point'])
    $(id).disabled = app.busy;
  const liberties =
    app.selected >= 0 && app.board[app.selected]
      ? group(app.board, app.selected, app.n).liberties
      : [];
  for (let i = 0; i < app.board.length; i++) {
    const button = createPoint(
      i,
      app.n,
      app.mode === 'lesson' && app.hinted && targets().includes(i) ? 'hinted' : ''
    );
    if (app.mode === 'game') {
      if (isStarPoint(i, app.n)) button.append(span('star-point'));
      if (i === app.pendingPoint) button.classList.add('pending-point');
      if (app.deadStones.has(i)) button.classList.add('dead-stone');
      if (scored && !app.board[i] && scored.owners[i])
        button.classList.add(scored.owners[i] === 1 ? 'black-area' : 'white-area');
    }
    button.setAttribute(
      'aria-label',
      `${coordinate(i, app.n)}: ${colorName(app.board[i])}${liberties.includes(i) ? ', khí' : ''}`
    );
    if (app.board[i]) appendStone(button, app.board[i], app.last === i);
    else if (liberties.includes(i)) button.append(span('liberty'));
    button.onclick = () => click(i);
    appendEdgeLabels(button, i, app.n);
    root.append(button);
  }
  $('turn').textContent = turnText({
    mode: app.mode,
    lesson: current(),
    lineStep: app.lineStep,
    solved: app.solved,
    ended: app.ended,
    busy: app.busy,
  });
  $('captured').textContent = capturedText({
    mode: app.mode,
    lesson: current(),
    captures: app.captures,
  });
}

/** Clicking an occupied point selects its group so liberties can be shown. */
/** @param {number} i */
function selectGroup(i) {
  app.selected = app.mode === 'lesson' || $('show-liberties').checked ? i : -1;
  draw();
  if (app.mode === 'lesson' && !app.solved)
    message(`Nhóm này có ${group(app.board, i, app.n).liberties.length} khí.`);
}

/** @param {number} i @param {boolean} [confirmed] */
export function click(i, confirmed = false) {
  if (app.busy) return;
  if (app.mode === 'game' && app.ended) return toggleDeadGroup(i);
  if (app.mode === 'game' && !app.board[i] && $('confirm-move').checked && !confirmed) {
    app.pendingPoint = i;
    message(`Đã chọn ${pointName(i)}. Bấm “Đặt quân ở điểm đã chọn” để xác nhận.`);
    draw();
    return;
  }
  app.pendingPoint = -1;
  if (app.board[i]) return selectGroup(i);
  if (app.mode === 'lesson') return playLessonMove(i);
  playGameMove(i);
}
