// Board and replay-trace rendering for the training page.

import { group } from './engine.js';
import { trueEyes } from './reading.js';
import { turnStatusText, depthStatusText, attemptStatusText } from './train-view.js';
import { colorName, span, createPoint, appendStone, appendEdgeLabels } from './board-view.js';
import { $, coordinate, train } from './train-state.js';
import { selectPoint } from './train-play.js';

export function draw() {
  if (!train.puzzle) return;
  const size = train.puzzle.size || 5,
    root = $('board');
  root.replaceChildren();
  root.style.gridTemplateColumns = `repeat(${size},1fr)`;
  const shown = train.viewStep >= 0 ? train.trace[train.viewStep].board : train.board,
    shownLast = train.viewStep >= 0 ? train.trace[train.viewStep].point : train.last;
  const eyes =
    train.puzzle.goal === 'eyes' && train.finished
      ? trueEyes(shown, size, train.puzzle.target)
      : [];
  const liberties =
    train.viewStep < 0 && train.selected >= 0 && train.board[train.selected]
      ? group(train.board, train.selected, size).liberties
      : [];
  for (let i = 0; i < train.board.length; i++) {
    const button = createPoint(i, size, train.viewStep < 0 && i === train.hinted ? 'hinted' : '');
    button.setAttribute(
      'aria-label',
      `${coordinate(i, size)}: ${colorName(shown[i])}${train.puzzle.kind === 'reading' && i === train.puzzle.target ? ', mục tiêu' : ''}${liberties.includes(i) ? ', khí' : ''}${eyes.includes(i) ? ', mắt thật' : ''}`
    );
    if (shown[i]) {
      const stone = appendStone(button, shown[i], shownLast === i);
      if (
        train.puzzle.kind === 'reading' &&
        i === train.puzzle.target &&
        shown[i] === (train.puzzle.goal === 'eyes' ? 1 : 2)
      )
        stone.append(span('target-marker'));
    } else if (eyes.includes(i)) button.append(span('eye-marker'));
    else if (liberties.includes(i)) button.append(span('liberty'));
    appendEdgeLabels(button, i, size);
    button.onclick = () => selectPoint(i);
    root.append(button);
  }
  renderTrace();
  const reading = train.puzzle.kind === 'reading';
  $('turn').textContent = turnStatusText({
    viewStep: train.viewStep,
    finished: train.finished,
    mode: train.mode,
    wrong: train.wrong,
    busy: train.busy,
    reading,
  });
  $('depth').textContent = depthStatusText({
    reading,
    hasBoard: Boolean(train.puzzle.size),
    depth: train.puzzle.depth,
    viewStep: train.viewStep,
    remaining: train.remaining,
  });
  $('puzzle-pass').disabled = train.busy || train.finished;
  $('hint').textContent =
    train.puzzle.kind === 'reading' && train.hintLevel
      ? `Gợi ý ${Math.min(train.hintLevel + 1, 3)}/3`
      : 'Gợi ý';
  $('attempt-status').textContent = attemptStatusText({
    wrong: train.wrong,
    assisted: train.assisted,
    mode: train.mode,
  });
}

function renderTrace() {
  $('variation').hidden = train.puzzle.kind !== 'reading' || train.trace.length < 2;
  $('move-list').replaceChildren();
  if ($('variation').hidden) return;
  train.trace.forEach((item, i) => {
    const button = document.createElement('button');
    button.textContent =
      i === 0
        ? 'Thế đầu'
        : item.refute
          ? `${item.color === 1 ? '✗ Đen' : 'Trắng (phản bác)'} ${coordinate(item.point, train.puzzle.size)}`
          : `${i}. ${item.color === 1 ? 'Đen' : 'Trắng'} ${coordinate(item.point, train.puzzle.size)}`;
    button.setAttribute('aria-pressed', String(train.viewStep === i));
    button.onclick = () => {
      train.viewStep = i;
      train.autoPlay = false;
      draw();
    };
    $('move-list').append(button);
  });
}
