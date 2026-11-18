import { empty, group, move, bot } from './engine.js';
import { lessons, levels } from './lessons.js';
import { areaScore } from './area-score.js';
import {
  GAME_KEY,
  REVIEW_GAME_KEY,
  replayRecord,
  recordSgf,
  handicapPoints,
  recordKomi,
} from './game-record.js';
import { createSearchClient } from './search-client.js';
import { createGameClock } from './game-clock.js';
import { scoreSummary, analysisSummary } from './game-text.js';
import { showLessonChrome, showGameChrome } from './page-chrome.js';
import {
  renderNavigation,
  renderAnswers,
  successText,
  introText,
  nextLabel,
  turnText,
  capturedText,
} from './lesson-view.js';
import {
  loadProgress,
  saveProgress,
  loadLessonId,
  saveLessonId,
  readItem,
  writeItem,
} from './lesson-storage.js';
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

/** @type {(id: string) => any} DOM lookups are by known ids in the page markup. */
const $ = (id) => document.getElementById(id);
const search = createSearchClient();
const app = {
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

const pointName = (i) => coordinate(i, app.n);
function scoreDetails() {
  const s = areaScore(app.board, app.n, [...app.deadStones], app.komi);
  $('score-detail').textContent = scoreSummary(s, app.komi);
  return s;
}
function record() {
  return {
    version: 1,
    size: app.n,
    difficulty: $('bot-level').value,
    ...(app.handicap ? { handicap: app.handicap } : {}),
    komi: app.komi,
    moves: app.gameMoves,
  };
}
function persist() {
  if (app.mode !== 'game') return;
  $('game-save-status').textContent = writeItem(GAME_KEY, JSON.stringify(record()))
    ? `Đã lưu tại máy · ${app.gameMoves.length} nước`
    : 'Không lưu được. Hãy tải SGF để giữ ván.';
}
function syncNav() {
  document.body.dataset.mode = app.mode;
  const title = document.querySelector('.page-title');
  if (title) title.textContent = app.mode === 'game' ? 'Chơi với máy' : 'Học cách chơi';
  for (const link of /** @type {NodeListOf<HTMLElement>} */ (
    document.querySelectorAll('.site-nav a[data-nav]')
  )) {
    const on = link.dataset.nav === (app.mode === 'game' ? 'play' : 'learn');
    if (link.dataset.nav === 'learn' || link.dataset.nav === 'play')
      on ? link.setAttribute('aria-current', 'page') : link.removeAttribute('aria-current');
  }
}
function resume() {
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
const current = () => lessons[app.lesson];
const currentLevel = () => levels.find((l) => l.id === app.level);
const levelLessons = () => lessons.filter((l) => l.level === app.level);
function showLesson() {
  const heading = $('title');
  heading.tabIndex = -1;
  heading.focus({ preventScroll: true });
  heading.scrollIntoView({ block: 'start' });
}
const targets = () =>
  current().lines
    ? [...new Set(app.candidates.map((line) => line[app.lineStep]))]
    : [current().target];

function message(text, type = '') {
  $('feedback').textContent = text;
  $('feedback').className = type;
}
function navigation() {
  renderNavigation(
    {
      levelsBox: $('levels'),
      summary: $('level-summary'),
      list: $('lessons'),
      select: $('lesson-select'),
      progressText: $('progress-text'),
      progressBar: $('progress-bar'),
    },
    {
      levels,
      lessons,
      level: app.level,
      inLesson: app.mode === 'lesson',
      currentId: current().id,
      done: app.done,
      onLevel: (id) => {
        load(lessons.findIndex((item) => item.level === id));
        showLesson();
      },
      onLesson: (l) => {
        load(lessons.indexOf(l));
        showLesson();
      },
    }
  );
}
function draw() {
  const root = $('board');
  const zoom = Number($('board-zoom').value) / 100;
  const large = app.mode === 'game' && (app.n > 9 || zoom > 1);
  const width = boardPixelWidth({
    n: app.n,
    zoom,
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
function complete(text) {
  app.solved = true;
  if (!app.done.includes(current().id)) {
    app.done.push(current().id);
    saveProgress(app.done);
  }
  message(text, 'success');
  $('next').hidden = false;
  $('next').textContent = nextLabel(lessons[app.lesson + 1], app.level, levels);
  navigation();
}
function load(i) {
  search.cancel();
  app.pendingPoint = -1;
  app.epoch++;
  app.busy = false;
  app.mode = 'lesson';
  syncNav();
  app.lesson = i;
  app.level = current().level;
  app.n = 5;
  app.board = empty(app.n);
  for (const [p, c] of current().setup || []) app.board[p] = c;
  app.history = [app.board.join('')];
  app.last = app.selected = -1;
  app.hinted = app.solved = false;
  app.lineStep = 0;
  app.candidates = current().lines || [];
  const number = levelLessons().indexOf(current()) + 1;
  const conceptual = showLessonChrome({
    lesson: current(),
    chapter: `${currentLevel().name.toUpperCase()} · BÀI ${number} / ${levelLessons().length}`,
    isFirst: i === 0,
  });
  saveLessonId(current().id);
  renderAnswers($('answers'), current(), (correct) => {
    if (app.solved) return;
    if (correct) complete(successText(current()));
    else message('Chưa đúng. Kiểm tra lại khí hoặc điều kiện trong đề.', 'error');
    draw();
  });
  message(introText(current(), conceptual));
  navigation();
  draw();
}
/** While scoring, clicking a stone toggles its whole group between alive and dead. */
function toggleDeadGroup(i) {
  if (!app.board[i]) return;
  const remove = app.deadStones.has(i);
  for (const p of group(app.board, i, app.n).stones)
    remove ? app.deadStones.delete(p) : app.deadStones.add(p);
  draw();
}
/** Clicking an occupied point selects its group so liberties can be shown. */
function selectGroup(i) {
  app.selected = app.mode === 'lesson' || $('show-liberties').checked ? i : -1;
  draw();
  if (app.mode === 'lesson' && !app.solved)
    message(`Nhóm này có ${group(app.board, i, app.n).liberties.length} khí.`);
}
/** Plays the scripted white answer in a sequence lesson after the learner's move. */
function answerSequence() {
  app.busy = true;
  draw();
  message('Trắng đang đáp theo biến minh họa…');
  const currentEpoch = app.epoch;
  setTimeout(() => {
    if (currentEpoch !== app.epoch) return;
    const replyPoint = app.candidates[0][app.lineStep];
    const reply = move(app.board, replyPoint, 2, app.n, app.history);
    app.busy = false;
    if (reply.error) {
      message('Biến bài học không hợp lệ. Hãy làm lại bài.', 'error');
      return;
    }
    app.candidates = app.candidates.filter((line) => line[app.lineStep] === replyPoint);
    app.board = reply.board;
    app.history.push(app.board.join(''));
    app.last = replyPoint;
    app.lineStep++;
    message(
      reply.captured
        ? `Trắng vừa bắt ${reply.captured} quân. Tìm nước đen tiếp theo.`
        : 'Trắng đã đáp. Tìm nước đen tiếp theo.'
    );
    draw();
  }, 400);
}
/** The learner tries a move on an empty point in lesson mode. */
function playLessonMove(i) {
  const l = current();
  if (app.solved) return;
  if (l.answer !== undefined) {
    message('Hãy chọn câu trả lời bên dưới.');
    return;
  }
  const result = move(app.board, i, 1, app.n, app.history);
  if (result.error) {
    message(result.error, 'error');
    return;
  }
  if (l.kind !== 'place' && !targets().includes(i)) {
    message(
      'Nước hợp lệ nhưng chưa thuộc lời giải của bài này. Thử đọc lại mục tiêu hoặc xem gợi ý.',
      'error'
    );
    return;
  }
  app.board = result.board;
  app.history.push(app.board.join(''));
  app.last = i;
  app.selected = -1;
  app.hinted = false;
  if (l.kind === 'sequence') {
    app.candidates = app.candidates.filter((line) => line[app.lineStep] === i);
    app.lineStep++;
    if (app.lineStep === app.candidates[0].length) {
      complete(l.success);
      draw();
      return;
    }
    answerSequence();
    return;
  }
  complete(successText(l, result.captured));
  draw();
}
/** The player moves in a game against the bot; the bot then replies. */
function playGameMove(i) {
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
function click(i, confirmed = false) {
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
function saveTurn() {
  app.snapshots.push({
    board: [...app.board],
    history: [...app.history],
    last: app.last,
    captures: [...app.captures],
    passes: app.passes,
    moveCount: app.gameMoves.length,
  });
}
function apply(result, i, c) {
  app.gameMoves.push({ color: c, point: i });
  app.board = result.board;
  app.history.push(app.board.join(''));
  app.last = i;
  app.selected = -1;
  app.captures[c - 1] += result.captured;
  draw();
}
function reply() {
  persist();
  app.busy = true;
  draw();
  const currentEpoch = app.epoch;
  const applyReply = (i) => {
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
function start(save = true) {
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
function finish() {
  app.ended = true;
  app.pendingPoint = -1;
  message(
    'Hai bên đã bỏ lượt liên tiếp. Kiểm tra điểm ở phần bên trái: nhấn nhóm trên bàn để đánh dấu quân chết, hoặc chọn chơi tiếp nếu còn tranh chấp.'
  );
}
$('game-handicap').onchange = () => {
  $('game-komi').value = Number($('game-handicap').value) ? '0.5' : '6.5';
};
const clock = createGameClock({
  element: $('game-clock'),
  getLimit: () => Number($('clock-limit').value),
  isRunning: () => !app.busy,
  onExpire: () =>
    message('Hết giờ do bạn đặt. Ván tập vẫn tiếp tục; đây chỉ là nhắc nhịp suy nghĩ.'),
});
setInterval(() => clock.tick(app.mode === 'game', app.ended), 1000);
$('clock-limit').onchange = () => clock.reset();
function savedLessonIndex() {
  const i = lessons.findIndex((l) => l.id === loadLessonId());
  return i < 0 ? 0 : i;
}
document
  .querySelector('.site-nav a[data-nav="play"]')
  ?.addEventListener('click', (/** @type {MouseEvent} */ event) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button) return;
    event.preventDefault();
    if (app.mode !== 'game') enterPlay();
  });
document
  .querySelector('.site-nav a[data-nav="learn"]')
  ?.addEventListener('click', (/** @type {MouseEvent} */ event) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button || app.mode !== 'game')
      return;
    event.preventDefault();
    load(savedLessonIndex());
  });
function enterPlay() {
  if (readItem(GAME_KEY)) resume();
  else start();
}
$('new-game').onclick = () => start();
$('retry').onclick = () => load(app.lesson);
$('next').onclick = () => {
  app.lesson === lessons.length - 1 ? start() : load(app.lesson + 1);
  showLesson();
};
$('hint').onclick = () => {
  app.hinted = true;
  const l = current();
  if (l.kind === 'count') {
    app.selected = 12;
    message('Bốn điểm trống: trên, dưới, trái, phải.');
  } else if (l.kind === 'territory') message('Vùng trống giữa vòng đen chỉ có một giao điểm.');
  else
    message(
      l.hint ||
        (l.target !== undefined
          ? 'Điểm được tô sáng là khí cần tìm.'
          : 'Chạm một giao điểm trống bất kỳ.')
    );
  draw();
};
$('pass').onclick = () => {
  if (app.busy || app.ended) return;
  saveTurn();
  app.gameMoves.push({ color: 1, point: -1 });
  app.passes++;
  if (app.passes >= 2) {
    finish();
    persist();
    draw();
  } else {
    message('Bạn bỏ lượt. Máy sẽ đi nếu còn nước hợp lệ.');
    reply();
  }
};
$('undo').onclick = () => {
  if (app.busy || !app.snapshots.length) return;
  app.epoch++;
  const s = app.snapshots.pop();
  app.board = s.board;
  app.history = s.history;
  app.last = s.last;
  app.captures = s.captures;
  app.passes = s.passes;
  app.gameMoves = app.gameMoves.slice(0, s.moveCount);
  persist();
  app.ended = false;
  app.selected = -1;
  message('Đã lùi cả lượt của bạn và máy.');
  draw();
};
$('show-liberties').onchange = () => {
  if (!$('show-liberties').checked) app.selected = -1;
  draw();
};
$('lesson-select').onchange = () => {
  load(lessons.findIndex((l) => l.id === $('lesson-select').value));
  showLesson();
};
$('previous').onclick = () => {
  if (app.lesson > 0) {
    load(app.lesson - 1);
    showLesson();
  }
};
$('confirm-move').checked = window.matchMedia('(max-width:700px)').matches;
function savedSizeMatches(size) {
  try {
    return String(JSON.parse(readItem(GAME_KEY)).size) === size;
  } catch {
    return true;
  }
}
const parameters = new URLSearchParams(location.search);
const savedLesson = loadLessonId();
const requestedLesson = lessons.findIndex(
  (l) => l.id === (parameters.get('lesson') || savedLesson)
);
$('game-size').value = ['9', '13', '19'].includes(parameters.get('size'))
  ? parameters.get('size')
  : '9';
if (parameters.get('play') === '1') {
  if (readItem(GAME_KEY) && (!parameters.has('size') || savedSizeMatches(parameters.get('size'))))
    resume();
  else start();
} else load(requestedLesson < 0 ? 0 : requestedLesson);

$('bot-level').onchange = () => message('Đã đổi mức máy. Mức mới áp dụng từ lượt máy tiếp theo.');

$('game-size').onchange = () => {
  $('size-help').textContent =
    `Đã chọn ${$('game-size').value}×${$('game-size').value}. Bấm “Ván mới” để áp dụng; ván hiện tại giữ nguyên.`;
};

$('export-game').onclick = () => {
  if (app.busy) return;
  const url = URL.createObjectURL(
    new Blob([recordSgf(record())], { type: 'application/x-go-sgf;charset=utf-8' })
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = `igo-${app.n}x${app.n}.sgf`;
  a.click();
  URL.revokeObjectURL(url);
};
$('review-game').onclick = () => {
  if (app.busy) {
    message('Đợi máy đi xong rồi mở ván.');
    return;
  }
  if (writeItem(REVIEW_GAME_KEY, recordSgf(record()))) location.href = './review.html?game=latest';
  else message('Không chuyển được ván. Hãy tải SGF và mở ở Xem lại ván.', 'error');
};

$('board-zoom').oninput = draw;
$('confirm-point').onclick = () => {
  if (app.pendingPoint >= 0) click(app.pendingPoint, true);
};
$('cancel-point').onclick = () => {
  app.pendingPoint = -1;
  draw();
};
$('confirm-move').onchange = () => {
  app.pendingPoint = -1;
  draw();
};
$('suggest-dead').onclick = () => {
  if (app.busy) return;
  const activeEpoch = app.epoch;
  $('suggest-dead').disabled = true;
  $('dead-status').textContent = 'Đang mô phỏng các ván tiếp theo…';
  const done = (text) => {
    $('suggest-dead').disabled = false;
    $('dead-status').textContent = text;
  };
  search
    .run({ type: 'dead', board: app.board, size: app.n })
    .then((data) => {
      if (data.cancelled || activeEpoch !== app.epoch) return;
      if (data.error) {
        done(`Không gợi ý được: ${data.error}`);
        return;
      }
      app.deadStones = new Set(data.dead);
      draw();
      done(
        data.dead.length
          ? `Đã đánh dấu ${data.dead.length} quân nghi là chết. Nhấn nhóm để sửa nếu sai.`
          : 'Không thấy nhóm nào chắc chắn chết. Vẫn nên tự kiểm tra.'
      );
    })
    .catch(() => {
      if (activeEpoch === app.epoch) done('Không tải được bộ gợi ý.');
    });
};
$('resume-scoring').onclick = () => {
  while (app.gameMoves.at(-1)?.point === -1) app.gameMoves.pop();
  persist();
  resume();
};

$('analyze-game').onclick = () => {
  if (app.busy) return;
  $('analysis-output').textContent = 'Đang tìm các quyết định cần xem lại…';
  const activeEpoch = app.epoch;
  search
    .run(
      { type: 'review', record: record() },
      {
        onProgress: (data) => {
          if (activeEpoch === app.epoch)
            $('analysis-output').textContent = `Đang xem nước ${data.progress}/${data.total}…`;
        },
      }
    )
    .then((data) => {
      if (data.cancelled || activeEpoch !== app.epoch) return;
      if (data.error) {
        $('analysis-output').textContent = data.error;
        return;
      }
      $('analysis-output').textContent = analysisSummary(data.findings, pointName);
    })
    .catch((e) => {
      if (activeEpoch === app.epoch)
        $('analysis-output').textContent =
          `Không tải được engine phân tích: ${e.message || 'không có chi tiết lỗi'}`;
    });
};
