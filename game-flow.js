// Play-against-the-bot mode: starting, saving, resuming and the bot's replies.

import { empty, group, move, bot } from './engine.js';
import { GAME_KEY, replayRecord, handicapPoints, recordKomi } from './game-record.js';
import { showGameChrome } from './page-chrome.js';
import { readItem, writeItem } from './lesson-storage.js';
import { $, app, clock, message, search } from './play-state.js';
import { load, navigation } from './lesson-flow.js';
import { draw } from './board-draw.js';

export function record() {
  return {
    version: 1,
    size: app.n,
    difficulty: $('bot-level').value,
    ...(app.handicap ? { handicap: app.handicap } : {}),
    komi: app.komi,
    moves: app.gameMoves,
  };
}

export function persist() {
  if (app.mode !== 'game') return;
  $('game-save-status').textContent = writeItem(GAME_KEY, JSON.stringify(record()))
    ? `Đã lưu tại máy · ${app.gameMoves.length} nước`
    : 'Không lưu được. Hãy tải SGF để giữ ván.';
}

export function syncNav() {
  document.body.dataset.mode = app.mode;
  const title = document.querySelector('.page-title');
  if (title) title.textContent = app.mode === 'game' ? 'Chơi với máy' : 'Học cách chơi';
  for (const link of /** @type {NodeListOf<HTMLElement>} */ (
    document.querySelectorAll('.app-steps a[data-nav]')
  )) {
    const on = link.dataset.nav === (app.mode === 'game' ? 'play' : 'learn');
    if (link.dataset.nav === 'learn' || link.dataset.nav === 'play')
      on ? link.setAttribute('aria-current', 'page') : link.removeAttribute('aria-current');
  }
}

export function resume() {
  try {
    const saved = JSON.parse(readItem(GAME_KEY));
    const state = replayRecord(saved);
    $('game-size').value = String(saved.size);
    $('game-handicap').value = String(saved.handicap || 0);
    start(false);
    app.handicap = saved.handicap || 0;
    app.komi = recordKomi(saved);
    app.gameMoves = saved.moves;
    app.board = state.board;
    app.history = state.history;
    app.last = state.last;
    app.captures = state.captures;
    app.passes = state.passes;
    app.snapshots = state.snapshots;
    app.ended = state.ended;
    $('bot-level').value = ['easy', 'basic', 'search'].includes(saved.difficulty)
      ? saved.difficulty
      : 'easy';
    draw();
    persist();
    message('Đã tiếp tục ván đã lưu.');
    if (app.ended) finish();
    else if (state.next === 2) reply();
  } catch {
    if (app.mode === 'lesson') load(0);
    message('Không đọc được ván lưu. Dữ liệu cũ được giữ nguyên; hãy bắt đầu ván mới.', 'error');
  }
}

/** While scoring, clicking a stone toggles its whole group between alive and dead. */
/** @param {number} i */
export function toggleDeadGroup(i) {
  if (!app.board[i]) return;
  const remove = app.deadStones.has(i);
  for (const p of group(app.board, i, app.n).stones)
    remove ? app.deadStones.delete(p) : app.deadStones.add(p);
  draw();
}

/** The player moves in a game against the bot; the bot then replies. */
/** @param {number} i */
export function playGameMove(i) {
  const result = move(app.board, i, 1, app.n, app.history);
  if (result.error) {
    message(result.error, 'error');
    return;
  }
  saveTurn();
  apply(result, i, 1);
  app.passes = 0;
  message(
    result.captured
      ? `Bạn bắt được ${result.captured} quân trắng.`
      : 'Quan sát khí của các nhóm trước khi đi tiếp.'
  );
  reply();
}

export function saveTurn() {
  app.snapshots.push({
    board: [...app.board],
    history: [...app.history],
    last: app.last,
    captures: [...app.captures],
    passes: app.passes,
    moveCount: app.gameMoves.length,
  });
}

/** @param {any} result a legal move result from engine.move @param {number} i @param {number} c */
function apply(result, i, c) {
  app.gameMoves.push({ color: c, point: i });
  app.board = result.board;
  app.history.push(app.board.join(''));
  app.last = i;
  app.selected = -1;
  app.captures[c - 1] += result.captured;
  draw();
}

export function reply() {
  persist();
  app.busy = true;
  draw();
  const currentEpoch = app.epoch;
  const applyReply = (/** @type {number | null} */ i) => {
    if (currentEpoch !== app.epoch) return;
    if (i === -1 || i === null) {
      app.gameMoves.push({ color: 2, point: -1 });
      app.passes++;
      message('Máy bỏ lượt vì không tìm thấy nước có ích theo cách đánh giá của máy.');
      if (app.passes >= 2) finish();
    } else {
      const result = move(app.board, i, 2, app.n, app.history);
      if (result.error) {
        app.busy = false;
        message(result.error, 'error');
        return;
      }
      apply(result, i, 2);
      app.passes = 0;
    }
    app.busy = false;
    persist();
    draw();
  };
  if ($('bot-level').value === 'search') {
    search
      .run({ type: 'move', board: app.board, size: app.n, history: app.history })
      .then((data) => {
        if (data.cancelled || currentEpoch !== app.epoch) return;
        if (data.error) {
          applyReply(bot(app.board, app.n, app.history));
          message('Engine tìm kiếm lỗi; máy đã dùng mức Cơ bản cho lượt này.');
          return;
        }
        applyReply(data.result.best.point);
      })
      .catch(() => {
        if (currentEpoch !== app.epoch) return;
        applyReply(bot(app.board, app.n, app.history));
        message('Không tải được engine tìm kiếm; máy đã dùng mức Cơ bản cho lượt này.');
      });
  } else
    setTimeout(() => {
      if (currentEpoch === app.epoch)
        applyReply(bot(app.board, app.n, app.history, { difficulty: $('bot-level').value }));
    }, 350);
}

export function start(save = true) {
  search.cancel();
  app.epoch++;
  app.busy = false;
  app.mode = 'game';
  syncNav();
  app.n = Number($('game-size').value);
  app.handicap = Number($('game-handicap').value) || 0;
  app.komi = Number($('game-komi').value);
  if (!Number.isFinite(app.komi)) app.komi = 6.5;
  app.board = empty(app.n);
  for (const p of handicapPoints(app.n, app.handicap)) app.board[p] = 1;
  clock.reset();
  app.gameMoves = [];
  $('analysis-output').textContent = '';
  app.deadStones.clear();
  app.pendingPoint = -1;
  app.history = [app.board.join('')];
  app.snapshots = [];
  app.last = app.selected = -1;
  app.passes = 0;
  app.ended = false;
  app.captures = [0, 0];
  app.hinted = app.solved = false;
  showGameChrome({ n: app.n, handicap: app.handicap });
  message(
    app.handicap
      ? 'Đen đã có sẵn quân chấp; máy (Trắng) đi trước.'
      : 'Chạm một giao điểm để đi nước đầu.'
  );
  navigation();
  draw();
  if (save) persist();
  if (app.handicap && save) reply();
}

export function finish() {
  app.ended = true;
  app.pendingPoint = -1;
  message(
    'Hai bên đã bỏ lượt liên tiếp. Kiểm tra điểm ở phần bên trái: nhấn nhóm trên bàn để đánh dấu quân chết, hoặc chọn chơi tiếp nếu còn tranh chấp.'
  );
}

export function enterPlay() {
  if (readItem(GAME_KEY)) resume();
  else start();
}

/** @param {string} size */
export function savedSizeMatches(size) {
  try {
    return String(JSON.parse(readItem(GAME_KEY)).size) === size;
  } catch {
    return true;
  }
}
