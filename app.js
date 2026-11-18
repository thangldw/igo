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
} from './board-view.js';

/** @type {(id: string) => any} DOM lookups are by known ids in the page markup. */
const $ = (id) => document.getElementById(id);
const search = createSearchClient();
let done = loadProgress(lessons);
let lesson = 0,
  level = 'beginner',
  n = 5,
  board = [],
  history = [],
  snapshots = [];
let last = -1,
  mode = 'lesson',
  passes = 0,
  ended = false,
  captures = [0, 0];
let selected = -1,
  hinted = false,
  busy = false,
  epoch = 0,
  solved = false,
  lineStep = 0,
  candidates = [];
let gameMoves = [],
  deadStones = new Set(),
  pendingPoint = -1,
  handicap = 0,
  komi = 6.5;
const pointName = (i) => coordinate(i, n);
function scoreDetails() {
  const s = areaScore(board, n, [...deadStones], komi);
  $('score-detail').textContent = scoreSummary(s, komi);
  return s;
}
function record() {
  return {
    version: 1,
    size: n,
    difficulty: $('bot-level').value,
    ...(handicap ? { handicap } : {}),
    komi,
    moves: gameMoves,
  };
}
function persist() {
  if (mode !== 'game') return;
  $('game-save-status').textContent = writeItem(GAME_KEY, JSON.stringify(record()))
    ? `Đã lưu tại máy · ${gameMoves.length} nước`
    : 'Không lưu được. Hãy tải SGF để giữ ván.';
}
function syncNav() {
  document.body.dataset.mode = mode;
  const title = document.querySelector('.page-title');
  if (title) title.textContent = mode === 'game' ? 'Chơi với máy' : 'Học cách chơi';
  for (const link of /** @type {NodeListOf<HTMLElement>} */ (
    document.querySelectorAll('.site-nav a[data-nav]')
  )) {
    const on = link.dataset.nav === (mode === 'game' ? 'play' : 'learn');
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
    handicap = saved.handicap || 0;
    komi = recordKomi(saved);
    gameMoves = saved.moves;
    board = state.board;
    history = state.history;
    last = state.last;
    captures = state.captures;
    passes = state.passes;
    snapshots = state.snapshots;
    ended = state.ended;
    $('bot-level').value = ['easy', 'basic', 'search'].includes(saved.difficulty)
      ? saved.difficulty
      : 'easy';
    draw();
    persist();
    message('Đã tiếp tục ván đã lưu.');
    if (ended) finish();
    else if (state.next === 2) reply();
  } catch {
    if (mode === 'lesson') load(0);
    message('Không đọc được ván lưu. Dữ liệu cũ được giữ nguyên; hãy bắt đầu ván mới.', 'error');
  }
}
const current = () => lessons[lesson];
const currentLevel = () => levels.find((l) => l.id === level);
const levelLessons = () => lessons.filter((l) => l.level === level);
function showLesson() {
  const heading = $('title');
  heading.tabIndex = -1;
  heading.focus({ preventScroll: true });
  heading.scrollIntoView({ block: 'start' });
}
const targets = () =>
  current().lines ? [...new Set(candidates.map((line) => line[lineStep]))] : [current().target];

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
      level,
      inLesson: mode === 'lesson',
      currentId: current().id,
      done,
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
  const large = mode === 'game' && (n > 9 || zoom > 1);
  const column = document.querySelector('.stage-board').clientWidth - 48,
    width = Math.max(n * 28, Math.min(column, Math.max(window.innerHeight - 250, n * 28))) * zoom;
  root.style.minWidth = large ? `${width}px` : '';
  $('play-surface').style.minWidth = large ? `${width + 48}px` : '';
  root.replaceChildren();
  root.style.gridTemplateColumns = `repeat(${n},1fr)`;
  $('scoring-panel').hidden = $('analysis-panel').hidden = mode !== 'game' || !ended;
  const scored = mode === 'game' && ended ? scoreDetails() : null;
  $('confirm-point').hidden = $('cancel-point').hidden = pendingPoint < 0;
  for (const id of ['export-game', 'review-game', 'analyze-game', 'confirm-point'])
    $(id).disabled = busy;
  const liberties = selected >= 0 && board[selected] ? group(board, selected, n).liberties : [];
  for (let i = 0; i < board.length; i++) {
    const button = createPoint(
      i,
      n,
      mode === 'lesson' && hinted && targets().includes(i) ? 'hinted' : ''
    );
    if (mode === 'game') {
      if (isStarPoint(i, n)) button.append(span('star-point'));
      if (i === pendingPoint) button.classList.add('pending-point');
      if (deadStones.has(i)) button.classList.add('dead-stone');
      if (scored && !board[i] && scored.owners[i])
        button.classList.add(scored.owners[i] === 1 ? 'black-area' : 'white-area');
    }
    button.setAttribute(
      'aria-label',
      `${coordinate(i, n)}: ${colorName(board[i])}${liberties.includes(i) ? ', khí' : ''}`
    );
    if (board[i]) appendStone(button, board[i], last === i);
    else if (liberties.includes(i)) button.append(span('liberty'));
    button.onclick = () => click(i);
    appendEdgeLabels(button, i, n);
    root.append(button);
  }
  $('turn').textContent = turnText({ mode, lesson: current(), lineStep, solved, ended, busy });
  $('captured').textContent = capturedText({ mode, lesson: current(), captures });
}
function complete(text) {
  solved = true;
  if (!done.includes(current().id)) {
    done.push(current().id);
    saveProgress(done);
  }
  message(text, 'success');
  $('next').hidden = false;
  $('next').textContent = nextLabel(lessons[lesson + 1], level, levels);
  navigation();
}
function load(i) {
  search.cancel();
  pendingPoint = -1;
  epoch++;
  busy = false;
  mode = 'lesson';
  syncNav();
  lesson = i;
  level = current().level;
  n = 5;
  board = empty(n);
  for (const [p, c] of current().setup || []) board[p] = c;
  history = [board.join('')];
  last = selected = -1;
  hinted = solved = false;
  lineStep = 0;
  candidates = current().lines || [];
  const number = levelLessons().indexOf(current()) + 1;
  const conceptual = showLessonChrome({
    lesson: current(),
    chapter: `${currentLevel().name.toUpperCase()} · BÀI ${number} / ${levelLessons().length}`,
    isFirst: i === 0,
  });
  saveLessonId(current().id);
  renderAnswers($('answers'), current(), (correct) => {
    if (solved) return;
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
  if (!board[i]) return;
  const remove = deadStones.has(i);
  for (const p of group(board, i, n).stones) remove ? deadStones.delete(p) : deadStones.add(p);
  draw();
}
/** Clicking an occupied point selects its group so liberties can be shown. */
function selectGroup(i) {
  selected = mode === 'lesson' || $('show-liberties').checked ? i : -1;
  draw();
  if (mode === 'lesson' && !solved)
    message(`Nhóm này có ${group(board, i, n).liberties.length} khí.`);
}
/** Plays the scripted white answer in a sequence lesson after the learner's move. */
function answerSequence() {
  busy = true;
  draw();
  message('Trắng đang đáp theo biến minh họa…');
  const currentEpoch = epoch;
  setTimeout(() => {
    if (currentEpoch !== epoch) return;
    const replyPoint = candidates[0][lineStep];
    const reply = move(board, replyPoint, 2, n, history);
    busy = false;
    if (reply.error) {
      message('Biến bài học không hợp lệ. Hãy làm lại bài.', 'error');
      return;
    }
    candidates = candidates.filter((line) => line[lineStep] === replyPoint);
    board = reply.board;
    history.push(board.join(''));
    last = replyPoint;
    lineStep++;
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
  if (solved) return;
  if (l.answer !== undefined) {
    message('Hãy chọn câu trả lời bên dưới.');
    return;
  }
  const result = move(board, i, 1, n, history);
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
  board = result.board;
  history.push(board.join(''));
  last = i;
  selected = -1;
  hinted = false;
  if (l.kind === 'sequence') {
    candidates = candidates.filter((line) => line[lineStep] === i);
    lineStep++;
    if (lineStep === candidates[0].length) {
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
  const result = move(board, i, 1, n, history);
  if (result.error) {
    message(result.error, 'error');
    return;
  }
  saveTurn();
  apply(result, i, 1);
  passes = 0;
  message(
    result.captured
      ? `Bạn bắt được ${result.captured} quân trắng.`
      : 'Quan sát khí của các nhóm trước khi đi tiếp.'
  );
  reply();
}
function click(i, confirmed = false) {
  if (busy) return;
  if (mode === 'game' && ended) return toggleDeadGroup(i);
  if (mode === 'game' && !board[i] && $('confirm-move').checked && !confirmed) {
    pendingPoint = i;
    message(`Đã chọn ${pointName(i)}. Bấm “Đặt quân ở điểm đã chọn” để xác nhận.`);
    draw();
    return;
  }
  pendingPoint = -1;
  if (board[i]) return selectGroup(i);
  if (mode === 'lesson') return playLessonMove(i);
  playGameMove(i);
}
function saveTurn() {
  snapshots.push({
    board: [...board],
    history: [...history],
    last,
    captures: [...captures],
    passes,
    moveCount: gameMoves.length,
  });
}
function apply(result, i, c) {
  gameMoves.push({ color: c, point: i });
  board = result.board;
  history.push(board.join(''));
  last = i;
  selected = -1;
  captures[c - 1] += result.captured;
  draw();
}
function reply() {
  persist();
  busy = true;
  draw();
  const currentEpoch = epoch;
  const applyReply = (i) => {
    if (currentEpoch !== epoch) return;
    if (i === -1 || i === null) {
      gameMoves.push({ color: 2, point: -1 });
      passes++;
      message('Máy bỏ lượt vì không tìm thấy nước có ích theo cách đánh giá của máy.');
      if (passes >= 2) finish();
    } else {
      const result = move(board, i, 2, n, history);
      if (result.error) {
        busy = false;
        message(result.error, 'error');
        return;
      }
      apply(result, i, 2);
      passes = 0;
    }
    busy = false;
    persist();
    draw();
  };
  if ($('bot-level').value === 'search') {
    search
      .run({ type: 'move', board, size: n, history })
      .then((data) => {
        if (data.cancelled || currentEpoch !== epoch) return;
        if (data.error) {
          applyReply(bot(board, n, history));
          message('Engine tìm kiếm lỗi; máy đã dùng mức Cơ bản cho lượt này.');
          return;
        }
        applyReply(data.result.best.point);
      })
      .catch(() => {
        if (currentEpoch !== epoch) return;
        applyReply(bot(board, n, history));
        message('Không tải được engine tìm kiếm; máy đã dùng mức Cơ bản cho lượt này.');
      });
  } else
    setTimeout(() => {
      if (currentEpoch === epoch)
        applyReply(bot(board, n, history, { difficulty: $('bot-level').value }));
    }, 350);
}
function start(save = true) {
  search.cancel();
  epoch++;
  busy = false;
  mode = 'game';
  syncNav();
  n = Number($('game-size').value);
  handicap = Number($('game-handicap').value) || 0;
  komi = Number($('game-komi').value);
  if (!Number.isFinite(komi)) komi = 6.5;
  board = empty(n);
  for (const p of handicapPoints(n, handicap)) board[p] = 1;
  clock.reset();
  gameMoves = [];
  $('analysis-output').textContent = '';
  deadStones.clear();
  pendingPoint = -1;
  history = [board.join('')];
  snapshots = [];
  last = selected = -1;
  passes = 0;
  ended = false;
  captures = [0, 0];
  hinted = solved = false;
  showGameChrome({ n, handicap });
  message(
    handicap
      ? 'Đen đã có sẵn quân chấp; máy (Trắng) đi trước.'
      : 'Chạm một giao điểm để đi nước đầu.'
  );
  navigation();
  draw();
  if (save) persist();
  if (handicap && save) reply();
}
function finish() {
  ended = true;
  pendingPoint = -1;
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
  isRunning: () => !busy,
  onExpire: () =>
    message('Hết giờ do bạn đặt. Ván tập vẫn tiếp tục; đây chỉ là nhắc nhịp suy nghĩ.'),
});
setInterval(() => clock.tick(mode === 'game', ended), 1000);
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
    if (mode !== 'game') enterPlay();
  });
document
  .querySelector('.site-nav a[data-nav="learn"]')
  ?.addEventListener('click', (/** @type {MouseEvent} */ event) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button || mode !== 'game') return;
    event.preventDefault();
    load(savedLessonIndex());
  });
function enterPlay() {
  if (readItem(GAME_KEY)) resume();
  else start();
}
$('new-game').onclick = () => start();
$('retry').onclick = () => load(lesson);
$('next').onclick = () => {
  lesson === lessons.length - 1 ? start() : load(lesson + 1);
  showLesson();
};
$('hint').onclick = () => {
  hinted = true;
  const l = current();
  if (l.kind === 'count') {
    selected = 12;
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
  if (busy || ended) return;
  saveTurn();
  gameMoves.push({ color: 1, point: -1 });
  passes++;
  if (passes >= 2) {
    finish();
    persist();
    draw();
  } else {
    message('Bạn bỏ lượt. Máy sẽ đi nếu còn nước hợp lệ.');
    reply();
  }
};
$('undo').onclick = () => {
  if (busy || !snapshots.length) return;
  epoch++;
  const s = snapshots.pop();
  board = s.board;
  history = s.history;
  last = s.last;
  captures = s.captures;
  passes = s.passes;
  gameMoves = gameMoves.slice(0, s.moveCount);
  persist();
  ended = false;
  selected = -1;
  message('Đã lùi cả lượt của bạn và máy.');
  draw();
};
$('show-liberties').onchange = () => {
  if (!$('show-liberties').checked) selected = -1;
  draw();
};
$('lesson-select').onchange = () => {
  load(lessons.findIndex((l) => l.id === $('lesson-select').value));
  showLesson();
};
$('previous').onclick = () => {
  if (lesson > 0) {
    load(lesson - 1);
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
  if (busy) return;
  const url = URL.createObjectURL(
    new Blob([recordSgf(record())], { type: 'application/x-go-sgf;charset=utf-8' })
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = `igo-${n}x${n}.sgf`;
  a.click();
  URL.revokeObjectURL(url);
};
$('review-game').onclick = () => {
  if (busy) {
    message('Đợi máy đi xong rồi mở ván.');
    return;
  }
  if (writeItem(REVIEW_GAME_KEY, recordSgf(record()))) location.href = './review.html?game=latest';
  else message('Không chuyển được ván. Hãy tải SGF và mở ở Xem lại ván.', 'error');
};

$('board-zoom').oninput = draw;
$('confirm-point').onclick = () => {
  if (pendingPoint >= 0) click(pendingPoint, true);
};
$('cancel-point').onclick = () => {
  pendingPoint = -1;
  draw();
};
$('confirm-move').onchange = () => {
  pendingPoint = -1;
  draw();
};
$('suggest-dead').onclick = () => {
  if (busy) return;
  const activeEpoch = epoch;
  $('suggest-dead').disabled = true;
  $('dead-status').textContent = 'Đang mô phỏng các ván tiếp theo…';
  const done = (text) => {
    $('suggest-dead').disabled = false;
    $('dead-status').textContent = text;
  };
  search
    .run({ type: 'dead', board, size: n })
    .then((data) => {
      if (data.cancelled || activeEpoch !== epoch) return;
      if (data.error) {
        done(`Không gợi ý được: ${data.error}`);
        return;
      }
      deadStones = new Set(data.dead);
      draw();
      done(
        data.dead.length
          ? `Đã đánh dấu ${data.dead.length} quân nghi là chết. Nhấn nhóm để sửa nếu sai.`
          : 'Không thấy nhóm nào chắc chắn chết. Vẫn nên tự kiểm tra.'
      );
    })
    .catch(() => {
      if (activeEpoch === epoch) done('Không tải được bộ gợi ý.');
    });
};
$('resume-scoring').onclick = () => {
  while (gameMoves.at(-1)?.point === -1) gameMoves.pop();
  persist();
  resume();
};

$('analyze-game').onclick = () => {
  if (busy) return;
  $('analysis-output').textContent = 'Đang tìm các quyết định cần xem lại…';
  const activeEpoch = epoch;
  search
    .run(
      { type: 'review', record: record() },
      {
        onProgress: (data) => {
          if (activeEpoch === epoch)
            $('analysis-output').textContent = `Đang xem nước ${data.progress}/${data.total}…`;
        },
      }
    )
    .then((data) => {
      if (data.cancelled || activeEpoch !== epoch) return;
      if (data.error) {
        $('analysis-output').textContent = data.error;
        return;
      }
      $('analysis-output').textContent = analysisSummary(data.findings, pointName);
    })
    .catch((e) => {
      if (activeEpoch === epoch)
        $('analysis-output').textContent =
          `Không tải được engine phân tích: ${e.message || 'không có chi tiết lỗi'}`;
    });
};
