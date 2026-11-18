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
import { renderTerms } from './terms.js';
import { createSearchClient } from './search-client.js';
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
  komi = 6.5,
  clockLeft = 0,
  clockWarned = false;
const pointName = (i) => coordinate(i, n);
function scoreDetails() {
  const s = areaScore(board, n, [...deadStones], komi),
    komiText = String(komi).replace('.', ',');
  $('score-detail').textContent =
    `Đen: ${s.blackStones} quân sống + ${s.blackLand} đất = ${s.black}. Trắng: ${s.whiteStones} quân sống + ${s.whiteLand} đất + ${komiText} komi = ${s.white}. Trung lập: ${s.neutral}. Theo dấu quân chết bạn chọn, ${s.black > s.white ? 'Đen' : 'Trắng'} hơn ${Math.abs(s.black - s.white)} điểm.`;
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
  $('levels').replaceChildren();
  for (const l of levels) {
    const button = document.createElement('button');
    button.textContent = l.name;
    button.setAttribute('aria-pressed', String(l.id === level));
    button.onclick = () => {
      load(lessons.findIndex((item) => item.level === l.id));
      showLesson();
    };
    $('levels').append(button);
  }
  $('level-summary').textContent = currentLevel().summary;
  $('lessons').replaceChildren();
  $('lesson-select').replaceChildren();
  levelLessons().forEach((l, index) => {
    const button = document.createElement('button');
    button.setAttribute(
      'aria-current',
      mode === 'lesson' && l.id === current().id ? 'step' : 'false'
    );
    const option = document.createElement('option');
    option.value = l.id;
    option.textContent = `${index + 1}. ${l.title}`;
    $('lesson-select').append(option);
    button.className = mode === 'lesson' && l.id === current().id ? 'active' : '';
    const number = document.createElement('span');
    number.className = 'number';
    number.textContent = done.includes(l.id) ? '✓' : String(index + 1).padStart(2, '0');
    button.replaceChildren(number, document.createTextNode(l.title));
    button.onclick = () => {
      load(lessons.indexOf(l));
      showLesson();
    };
    $('lessons').append(button);
  });
  $('lesson-select').value = current().id;
  const active = $('lessons').querySelector('.active');
  if (active) $('lessons').scrollLeft = Math.max(0, active.offsetLeft - $('lessons').offsetLeft);
  const completed = levelLessons().filter((l) => done.includes(l.id)).length;
  $('progress-text').textContent = `${completed} / ${levelLessons().length}`;
  $('progress-bar').style.width = `${(completed / levelLessons().length) * 100}%`;
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
  $('turn').textContent =
    mode === 'lesson'
      ? current().kind === 'sequence'
        ? `● Đen đi · Nước ${Math.floor(lineStep / 2) + 1} / ${Math.ceil(current().lines[0].length / 2)}`
        : '● Bạn đặt quân đen'
      : ended
        ? 'Ván đã kết thúc'
        : busy
          ? '○ Máy đang đi…'
          : '● Lượt của bạn';
  if (solved && mode === 'lesson') $('turn').textContent = '✓ Đã hoàn thành bài';
  $('captured').textContent =
    mode === 'lesson'
      ? current().kind === 'sequence'
        ? 'Trắng đáp theo chuỗi mẫu'
        : ''
      : `Đã bắt: đen ${captures[0]} · trắng ${captures[1]}`;
}
function complete(text) {
  solved = true;
  if (!done.includes(current().id)) {
    done.push(current().id);
    saveProgress(done);
  }
  message(text, 'success');
  $('next').hidden = false;
  const next = lessons[lesson + 1];
  $('next').textContent = !next
    ? 'Luyện với máy →'
    : next.level !== level
      ? `Sang ${levels.find((l) => l.id === next.level).name.toLowerCase()} →`
      : 'Bài tiếp theo →';
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
  $('chapter').textContent =
    `${currentLevel().name.toUpperCase()} · BÀI ${number} / ${levelLessons().length}`;
  $('title').textContent = current().title;
  $('board-size').textContent = '5 × 5';
  $('guide-title').textContent = current().heading;
  $('description').textContent = current().description;
  $('tip').textContent = current().tip;
  renderTerms($('terms'), [current().title, current().description, current().tip].join(' '));
  const url = new URL(location.href);
  url.searchParams.delete('play');
  url.searchParams.delete('lesson');
  url.searchParams.delete('size');
  saveLessonId(current().id);
  window.history.replaceState(null, '', url);
  $('previous').disabled = i === 0;
  $('previous').hidden = false;
  $('game-controls').hidden = true;
  $('size-help').hidden = true;
  document.querySelector('.workflow-help p').textContent =
    '1. Chọn bài bên trái. 2. Đọc yêu cầu. 3. Nhấn bàn cờ hoặc chọn đáp án. Làm xong thì bấm “Bài tiếp theo”.';
  $('next').hidden = true;
  $('hint').hidden = false;
  $('retry').hidden = false;
  $('answers').replaceChildren();
  const conceptual = current().kind === 'quiz' && !current().setup.length;
  $('description').hidden = conceptual;
  $('play-surface').hidden = conceptual;
  $('concept').hidden = !conceptual;
  $('concept').textContent = conceptual ? current().description : '';
  $('board-footer').hidden = conceptual;
  $('board-size').hidden = conceptual;
  if (current().answer !== undefined) {
    const choices =
      current().choices ||
      [1, 2, 3, 4].map((v) => `${v} ${current().kind === 'territory' ? 'điểm' : 'khí'}`);
    choices.forEach((label, index) => {
      const button = document.createElement('button');
      button.textContent = label;
      button.onclick = () => {
        if (solved) return;
        const correct = current().choices
          ? index === current().answer
          : index + 1 === current().answer;
        if (correct)
          complete(
            current().success ||
              (current().kind === 'territory'
                ? 'Đúng! Vùng giữa có 1 điểm đất. Quân trên bàn cũng được tính khi đếm diện tích.'
                : 'Đúng! Quân giữa bàn có 4 khí.')
          );
        else message('Chưa đúng. Kiểm tra lại khí hoặc điều kiện trong đề.', 'error');
        draw();
      };
      $('answers').append(button);
    });
  }
  message(
    current().kind === 'sequence'
      ? 'Nghĩ trước cách Trắng đáp rồi đặt quân Đen. Trong bài này, Trắng đi theo chuỗi mẫu.'
      : conceptual
        ? 'Chọn đáp án theo tình huống trong đề.'
        : 'Thử trực tiếp trên bàn cờ.'
  );
  navigation();
  draw();
}
function click(i, confirmed = false) {
  if (busy) return;
  if (mode === 'game' && ended) {
    if (board[i]) {
      const g = group(board, i, n);
      const remove = deadStones.has(i);
      g.stones.forEach((p) => (remove ? deadStones.delete(p) : deadStones.add(p)));
      draw();
    }
    return;
  }
  if (mode === 'game' && !board[i] && $('confirm-move').checked && !confirmed) {
    pendingPoint = i;
    message(`Đã chọn ${pointName(i)}. Bấm “Đặt quân ở điểm đã chọn” để xác nhận.`);
    draw();
    return;
  }
  pendingPoint = -1;
  if (board[i]) {
    selected = mode === 'lesson' || $('show-liberties').checked ? i : -1;
    draw();
    if (mode === 'lesson' && !solved)
      message(`Nhóm này có ${group(board, i, n).liberties.length} khí.`);
    return;
  }
  if (mode === 'lesson') {
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
      return;
    }
    complete(
      l.success ||
        (l.kind === 'place'
          ? 'Bạn vừa đi nước đầu tiên. Tiếp theo, học cách giữ quân sống.'
          : l.kind === 'save'
            ? 'Đúng! Nhóm đen đã nối ra ngoài và có 3 khí.'
            : `Đúng! Bạn đã bắt ${result.captured} quân trắng.`)
    );
    draw();
    return;
  }
  if (ended) return;
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
  clockLeft = Number($('clock-limit').value) || 0;
  clockWarned = false;
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
  $('chapter').textContent = `VÁN LUYỆN TẬP${handicap ? ` · CHẤP ${handicap}` : ''}`;
  $('title').textContent = `Luyện chơi ${n}×${n}`;
  $('board-size').textContent = `${n} × ${n}`;
  $('board-size').hidden = false;
  $('play-surface').hidden = false;
  $('concept').hidden = true;
  $('board-footer').hidden = false;
  $('guide-title').textContent = 'Kết thúc ván';
  $('description').textContent =
    'Dễ: tập luật. Cơ bản: máy ưu tiên bắt và cứu quân. Tìm kiếm: máy xét cả cách đối thủ đáp. Máy có thể bỏ lượt; các mức chưa có hạng thi đấu.';
  const url = new URL(location.href);
  url.searchParams.delete('lesson');
  url.searchParams.set('play', '1');
  url.searchParams.set('size', String(n));
  window.history.replaceState(null, '', url);
  $('previous').hidden = true;
  $('description').hidden = false;
  $('tip').textContent =
    'Hai lượt bỏ liên tiếp kết thúc ván. Trước đó hãy chơi tiếp để bắt hết quân chết.';
  renderTerms($('terms'), $('description').textContent + ' ' + $('tip').textContent);
  $('answers').replaceChildren();
  $('game-controls').hidden = false;
  $('size-help').hidden = false;
  $('size-help').textContent =
    n === 9
      ? '9×9: tập luật và bắt quân.'
      : `${n}×${n}: ${n === 13 ? 'tập quản lý nhiều nhóm' : 'tập chiến lược toàn bàn'}. Trên màn hình nhỏ, vuốt ngang bàn để xem các cột còn lại. Đổi kích thước chỉ áp dụng khi bấm “Ván mới”. Máy vẫn ở mức luyện cơ bản.`;
  document.querySelector('.workflow-help p').textContent =
    'Chọn mức máy, rồi nhấn giao điểm để đặt quân đen. Máy đáp bằng quân trắng. Khi hết nước có ích, bấm “Bỏ lượt”; hai lượt bỏ liên tiếp kết thúc ván.';
  $('next').hidden = true;
  $('hint').hidden = true;
  $('retry').hidden = true;
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
// Informal clock for the player's own thinking time; it never ends the game.
function clockText() {
  const m = Math.floor(clockLeft / 60),
    s = clockLeft % 60;
  return `Đồng hồ ${m}:${String(s).padStart(2, '0')}`;
}
setInterval(() => {
  const el = $('game-clock');
  if (mode !== 'game' || !Number($('clock-limit').value)) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  if (!ended && !busy && document.visibilityState === 'visible' && clockLeft > 0) clockLeft--;
  el.textContent = clockLeft > 0 ? clockText() : 'Hết giờ (tự đặt)';
  el.classList.toggle('clock-low', clockLeft <= 30);
  if (clockLeft === 0 && !clockWarned && !ended) {
    clockWarned = true;
    message('Hết giờ do bạn đặt. Ván tập vẫn tiếp tục; đây chỉ là nhắc nhịp suy nghĩ.');
  }
}, 1000);
$('clock-limit').onchange = () => {
  clockLeft = Number($('clock-limit').value) || 0;
  clockWarned = false;
};
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
  const label = (p) => (p === -1 ? 'bỏ lượt' : pointName(p));
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
      $('analysis-output').textContent = data.findings.length
        ? data.findings
            .map(
              (f) =>
                `Nước ${f.move}: bạn đi ${label(f.played)}. Cân nhắc ${label(f.point)}; đối thủ có thể đáp ${label(f.reply)}. Chênh lệch đánh giá: ${f.gap.toFixed(1)} đơn vị nội bộ.`
            )
            .join('\n')
        : 'Engine chưa tìm được nước thay thế tốt hơn trong các nhánh đã xét.';
    })
    .catch((e) => {
      if (activeEpoch === epoch)
        $('analysis-output').textContent =
          `Không tải được engine phân tích: ${e.message || 'không có chi tiết lỗi'}`;
    });
};
