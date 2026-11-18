// Answering and playing puzzles: attempts, hints, feedback and results.

import { group } from './engine.js';
import {
  refutationSteps,
  wrongMoveText,
  replyText,
  hintText,
  PASS_WRONG_TEXT,
} from './reading-trace.js';
import { beginAttempt, recordMiss, recordSolve, reveal, eligibleClean } from './study-state.js';
import { $, ask, coordinate, feedback, save, train } from './train-state.js';
import { renderProgress } from './train-session.js';
import { draw } from './train-board.js';

function startAttempt() {
  if (!train.attemptStarted) {
    beginAttempt(train.study, train.puzzle.id);
    train.attemptStarted = true;
    save();
  }
}

export function markAssisted() {
  startAttempt();
  train.assisted = true;
  reveal(train.study, train.puzzle.id);
  save();
}

/** @param {string} text */
function fail(text) {
  startAttempt();
  train.wrong++;
  if (train.wrong === 1) recordMiss(train.study, train.puzzle.id);
  reveal(train.study, train.puzzle.id);
  save();
  renderProgress();
  feedback(text, 'error');
  if (train.mode === 'test') {
    train.finished = true;
    train.testResults.push({
      id: train.puzzle.id,
      correct: false,
      ms: Date.now() - train.startedAt,
    });
    $('next').disabled = false;
    $('next').classList.add('primary');
    $('explanation-wrap').hidden = false;
    for (const b of $('answers').children) b.disabled = true;
    $('solution').disabled = true;
  }
  draw();
}

function success() {
  train.finished = true;
  const clean = train.wrong === 0 && !train.assisted && eligibleClean(train.study, train.puzzle.id);
  recordSolve(train.study, train.puzzle.id, clean);
  // Revealing the explanation prevents immediate replay from counting as fresh recall.
  reveal(train.study, train.puzzle.id);
  save();
  renderProgress();
  if (train.mode === 'test')
    train.testResults.push({
      id: train.puzzle.id,
      correct: train.wrong === 0 && !train.assisted,
      ms: Date.now() - train.startedAt,
    });
  $('next').disabled = false;
  $('next').classList.add('primary');
  $('explanation-wrap').hidden = false;
  for (const button of $('answers').children) button.disabled = true;
  feedback(
    clean
      ? 'Đúng, tự giải ở lần thử đầu. Bài sẽ được nhắc lại từ ngày mai.'
      : 'Đã giải. Bài này cần được thử lại ở một ngày khác không gợi ý để ghi nhận nhớ bài.',
    'success'
  );
  draw();
}

/** @param {number} choice @param {HTMLButtonElement} button */
export function answer(choice, button) {
  if (train.finished || train.busy) return;
  startAttempt();
  if (choice === train.puzzle.answer) {
    button.className = 'correct';
    success();
  } else {
    button.className = 'incorrect';
    button.disabled = true;
    fail(
      'Chưa đúng. Đọc lại điều kiện trong đề. ' +
        (train.mode === 'test' ? train.puzzle.explanation : '')
    );
  }
}

/** @param {number} point */
export async function selectPoint(point) {
  if (!train.puzzle || train.busy || train.finished) return;
  if (train.viewStep >= 0) {
    feedback('Đang xem lại chuỗi. Chọn “Trở lại thế hiện tại” để tiếp tục.');
    return;
  }
  if (train.board[point]) {
    if (train.puzzle.kind === 'reading' && $('inspect').checked) {
      train.selected = point;
      markAssisted();
      draw();
      feedback(
        `Nhóm tại ${coordinate(point, train.puzzle.size)} có ${group(train.board, point, train.puzzle.size).liberties.length} khí.`
      );
    }
    return;
  }
  if (train.puzzle.kind === 'quiz') return;
  await play(point);
}

/** @param {number} point */
export async function play(point) {
  if (
    !train.puzzle ||
    train.puzzle.kind !== 'reading' ||
    train.busy ||
    train.finished ||
    train.viewStep >= 0
  )
    return;
  startAttempt();
  train.busy = true;
  const currentEpoch = train.epoch;
  draw();
  const result = await ask('check', point);
  if (currentEpoch !== train.epoch) return;
  train.busy = false;
  train.hinted = -2;
  train.selected = -1;
  if (result.status === 'unknown') {
    feedback(
      'Bộ đọc vượt giới hạn tính toán hoặc chưa tải được. Nước này chưa được chấm; thử nước khác hoặc tải lại trang.'
    );
    train.autoPlay = false;
    draw();
    return;
  }
  if (result.status === 'invalid') {
    train.autoPlay = false;
    fail(result.message);
    return;
  }
  if (result.status === 'wrong') {
    train.autoPlay = false;
    if (point === -1) {
      fail(PASS_WRONG_TEXT);
      return;
    }
    if (result.counter !== undefined) {
      const steps = refutationSteps(
        train.board,
        point,
        result.counter,
        train.puzzle.size,
        train.history
      );
      if (steps.length) {
        train.trace.push(...steps);
        train.viewStep = train.trace.length - 1;
      }
    }
    fail(wrongMoveText(result, train.puzzle));
    return;
  }
  if (result.status === 'cancelled') return;
  train.trace.push({ board: [...result.playerBoard], point, color: 1 });
  if (result.status === 'continue')
    train.trace.push({ board: [...result.board], point: result.reply, color: 2 });
  train.board = result.board;
  train.history = result.history;
  train.remaining = result.remaining;
  train.last = result.status === 'continue' ? result.reply : point;
  if (result.status === 'solved') {
    train.autoPlay = false;
    success();
    return;
  }
  feedback(replyText(result, train.puzzle.size));
  draw();
  if (train.autoPlay) await getHint(true);
}

export async function getHint(playIt = false) {
  if (
    !train.puzzle ||
    train.puzzle.kind !== 'reading' ||
    train.busy ||
    train.finished ||
    train.mode === 'test' ||
    train.viewStep >= 0
  )
    return;
  markAssisted();
  if (!playIt && train.hintLevel === 0) {
    train.hintLevel = 1;
    train.selected = train.puzzle.target;
    const libs = group(train.board, train.puzzle.target, train.puzzle.size).liberties.length;
    feedback(hintText(1, { size: train.puzzle.size, liberties: libs }));
    draw();
    return;
  }
  train.busy = true;
  const currentEpoch = train.epoch;
  draw();
  const result = await ask('hint');
  if (currentEpoch !== train.epoch) return;
  train.busy = false;
  if (result.status !== 'hint') {
    train.autoPlay = false;
    feedback('Chưa tính được gợi ý trong giới hạn. Bạn có thể thử lại bài.');
    draw();
    return;
  }
  if (!playIt && train.hintLevel === 1) {
    train.hintLevel = 2;
    feedback(hintText(2, { size: train.puzzle.size, point: result.point }));
    draw();
    return;
  }
  train.hintLevel = 3;
  train.hinted = result.point;
  feedback(hintText(3, { size: train.puzzle.size, point: result.point }));
  draw();
  if (playIt) await play(result.point);
}
