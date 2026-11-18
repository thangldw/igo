import { empty, group } from './engine.js';
import { trueEyes } from './reading.js';
import { stages, buildBank } from './curriculum.js';
import { renderTerms } from './terms.js';
import {
  shuffle,
  storageStatusText,
  testResultText,
  renderStages,
  renderTopicSelect,
  renderProblemSelect,
  modeHelpText,
  showEmptyQueue,
  showQuizChoices,
  chapterLabel,
  tipText,
  turnStatusText,
  depthStatusText,
  attemptStatusText,
} from './train-view.js';
import { createReadingClient } from './reading-client.js';
import { loadStudy, saveStudy } from './study-storage.js';
import { setupBackup, setupJournalForm } from './train-forms.js';
import {
  refutationSteps,
  wrongMoveText,
  replyText,
  hintText,
  PASS_WRONG_TEXT,
} from './reading-trace.js';
import { renderToday, renderTopics, renderJournal } from './train-panels.js';
import {
  coordinate as boardCoordinate,
  colorName,
  span,
  createPoint,
  appendStone,
  appendEdgeLabels,
} from './board-view.js';
import {
  beginAttempt,
  recordMiss,
  recordSolve,
  needsReview,
  reveal,
  eligibleClean,
  topicStats,
  dailyPlan,
  streakDays,
  weekDots,
} from './study-state.js';
import { transformPuzzle, variantFor } from './symmetry.js';

/** @type {(id: string) => any} DOM lookups are by known ids in the page markup. */
const $ = (id) => document.getElementById(id),
  KEY = 'igo-study-v1';
let bank = [],
  study,
  stage = 'foundation',
  topic = 'all',
  mode = 'practice',
  queue = [],
  index = 0,
  puzzle;
let board = [],
  history = [],
  remaining = 0,
  last = -1,
  selected = -1,
  hinted = -2,
  busy = false,
  finished = false,
  wrong = 0,
  assisted = false,
  attemptStarted = false;
let epoch = 0,
  testResults = [],
  autoPlay = false,
  storageAvailable = true,
  storageWritable = true;
let trace = [],
  viewStep = -1,
  hintLevel = 0,
  startedAt = 0;
const reading = createReadingClient();
function showPuzzle() {
  const heading = $('test-result').hidden ? $('title') : $('test-result');
  heading.tabIndex = -1;
  heading.focus({ preventScroll: true });
  heading.scrollIntoView({ block: 'start' });
}
const stageInfo = () => stages.find((s) => s.id === stage);
const coordinate = (point, size) => (point === -1 ? 'bỏ lượt' : boardCoordinate(point, size));
function feedback(text, type = '') {
  $('feedback').textContent = text;
  $('feedback').className = type;
}
function save() {
  if (storageWritable && !saveStudy(KEY, study)) storageAvailable = false;
  $('storage-status').textContent = storageStatusText({
    writable: storageWritable,
    available: storageAvailable,
  });
}
function renderProgress() {
  renderStages(
    { list: $('stages'), select: $('stage-select'), total: $('total') },
    {
      stages,
      bank,
      study,
      stage,
      onPick: (id) => {
        stage = id;
        topic = 'all';
        rebuild();
        showPuzzle();
      },
    }
  );
  renderTopicStats();
  $('stage-practice').textContent = stageInfo().practice;
  $('stage-focus').textContent = stageInfo().focus;
}
function rebuild(preferred) {
  const stageBank = bank.filter((p) => p.stage === stage);
  topic = renderTopicSelect(
    $('topic'),
    stageBank.map((p) => p.topic),
    topic,
    mode === 'test' || mode === 'today'
  );
  const candidates = stageBank.filter((p) => topic === 'all' || p.topic === topic);
  queue =
    mode === 'today'
      ? dailyPlan(
          bank,
          study,
          Date.now(),
          stages.map((x) => x.id)
        ).items
      : mode === 'review'
        ? candidates.filter((p) => needsReview(study.records[p.id]))
        : mode === 'test'
          ? shuffle(stageBank).slice(0, 10)
          : candidates;
  testResults = [];
  index = preferred
    ? Math.max(
        0,
        queue.findIndex((p) => p.id === preferred)
      )
    : 0;
  renderProblemSelect($('problem-select'), queue, study, mode === 'test');
  for (const m of ['today', 'practice', 'review', 'test'])
    $(`mode-${m}`).setAttribute('aria-pressed', String(mode === m));
  renderProgress();
  renderTodayCard();
  load();
}
function renderTodayCard() {
  const card = $('today');
  card.hidden = mode !== 'today';
  if (card.hidden) return;
  const plan = dailyPlan(
    bank,
    study,
    Date.now(),
    stages.map((x) => x.id)
  );
  renderToday(card, { plan, streak: streakDays(study), dots: weekDots(study) });
}
if (matchMedia('(max-width:700px)').matches) $('topic-panel').open = false;
function renderTopicStats() {
  const stats = topicStats(bank, study).filter((t) => t.attempted > 0);
  renderTopics($('topic-stats'), stats, (t) => {
    const pool = bank
      .filter((p) => p.topic === t.topic)
      .sort(
        (a, b) =>
          Number(needsReview(study.records[b.id])) - Number(needsReview(study.records[a.id])) ||
          stages.findIndex((x) => x.id === a.stage) - stages.findIndex((x) => x.id === b.stage)
      );
    const first =
      pool.find((p) => needsReview(study.records[p.id]) || !study.records[p.id]?.clean) || pool[0];
    mode = 'practice';
    stage = first.stage;
    topic = t.topic;
    rebuild(first.id);
    showPuzzle();
  });
}
function ask(action, point) {
  return reading.ask({
    action,
    point,
    board,
    size: puzzle.size,
    target: puzzle.target,
    remaining,
    history,
    goal: puzzle.goal || 'capture',
  });
}
function load() {
  epoch++;
  reading.reset();
  busy = finished = assisted = attemptStarted = autoPlay = false;
  wrong = 0;
  last = selected = -1;
  hinted = -2;
  $('inspect').checked = false;
  $('inspect').disabled = mode === 'test';
  $('test-result').hidden = true;
  $('explanation-wrap').hidden = true;
  $('answers').replaceChildren();
  $('variation').hidden = true;
  $('concept').hidden = true;
  $('play-surface').hidden = false;
  $('hint').disabled = mode === 'test';
  $('solution').disabled = mode === 'test';
  $('retry').disabled = mode === 'test';
  $('reading-controls').hidden = false;
  $('previous').disabled = mode === 'test' || index === 0;
  $('mode-help').textContent = modeHelpText(mode);
  if (!queue.length) {
    renderTerms($('terms'), '');
    puzzle = null;
    showEmptyQueue({ mode, stageName: stageInfo().name });
    feedback('');
    return;
  }
  const canonical = queue[index];
  hintLevel = 0;
  startedAt = Date.now();
  puzzle =
    mode === 'test'
      ? canonical
      : transformPuzzle(canonical, variantFor(study.records[canonical.id]?.attempts || 0));
  $('problem-select').value = String(index);
  board = empty(puzzle.size || 5);
  for (const [p, c] of puzzle.setup) board[p] = c;
  trace = [{ board: [...board], point: -1, color: 0 }];
  viewStep = -1;
  history = [board.join('')];
  remaining = puzzle.depth || 0;
  $('chapter').textContent = chapterLabel({
    stageName: stages.find((x) => x.id === puzzle.stage).name,
    mode,
    index,
    total: queue.length,
    rotated: puzzle.symmetry,
  });
  $('title').textContent = puzzle.title;
  $('guide-title').textContent = puzzle.topic;
  $('objective').textContent = puzzle.kind === 'reading' ? puzzle.prompt : '';
  $('board-size').hidden = !puzzle.size;
  $('board-size').textContent = `${puzzle.size} × ${puzzle.size}`;
  $('proof-label').textContent =
    puzzle.kind === 'reading' ? 'NGHĨ CẢ NƯỚC ĐỐI THỦ' : 'DÙNG CÁC ĐIỀU KIỆN TRONG ĐỀ';
  $('tip').textContent = tipText(puzzle);
  $('explanation').textContent = puzzle.explanation;
  renderTerms(
    $('terms'),
    [stageInfo().name, puzzle.title, puzzle.prompt, puzzle.choices?.join(' ') || ''].join(' '),
    { disabled: mode === 'test' }
  );
  const url = new URL(location.href);
  url.searchParams.set('stage', stage);
  url.searchParams.set('problem', puzzle.id);
  window.history.replaceState(null, '', url);
  if (puzzle.kind === 'quiz') showQuizChoices(puzzle, answer);
  $('next').disabled = mode === 'test';
  $('next').classList.toggle('primary', false);
  feedback(mode === 'test' ? 'Lần thử đầu quyết định điểm. Gợi ý đã tắt.' : 'Đọc trước khi đi.');
  draw();
}
function draw() {
  if (!puzzle) return;
  const size = puzzle.size || 5,
    root = $('board');
  root.replaceChildren();
  root.style.gridTemplateColumns = `repeat(${size},1fr)`;
  const shown = viewStep >= 0 ? trace[viewStep].board : board,
    shownLast = viewStep >= 0 ? trace[viewStep].point : last;
  const eyes = puzzle.goal === 'eyes' && finished ? trueEyes(shown, size, puzzle.target) : [];
  const liberties =
    viewStep < 0 && selected >= 0 && board[selected] ? group(board, selected, size).liberties : [];
  for (let i = 0; i < board.length; i++) {
    const button = createPoint(i, size, viewStep < 0 && i === hinted ? 'hinted' : '');
    button.setAttribute(
      'aria-label',
      `${coordinate(i, size)}: ${colorName(shown[i])}${puzzle.kind === 'reading' && i === puzzle.target ? ', mục tiêu' : ''}${liberties.includes(i) ? ', khí' : ''}${eyes.includes(i) ? ', mắt thật' : ''}`
    );
    if (shown[i]) {
      const stone = appendStone(button, shown[i], shownLast === i);
      if (
        puzzle.kind === 'reading' &&
        i === puzzle.target &&
        shown[i] === (puzzle.goal === 'eyes' ? 1 : 2)
      )
        stone.append(span('target-marker'));
    } else if (eyes.includes(i)) button.append(span('eye-marker'));
    else if (liberties.includes(i)) button.append(span('liberty'));
    appendEdgeLabels(button, i, size);
    button.onclick = () => selectPoint(i);
    root.append(button);
  }
  renderTrace();
  const reading = puzzle.kind === 'reading';
  $('turn').textContent = turnStatusText({ viewStep, finished, mode, wrong, busy, reading });
  $('depth').textContent = depthStatusText({
    reading,
    hasBoard: Boolean(puzzle.size),
    depth: puzzle.depth,
    viewStep,
    remaining,
  });
  $('puzzle-pass').disabled = busy || finished;
  $('hint').textContent =
    puzzle.kind === 'reading' && hintLevel ? `Gợi ý ${Math.min(hintLevel + 1, 3)}/3` : 'Gợi ý';
  $('attempt-status').textContent = attemptStatusText({ wrong, assisted, mode });
}
function startAttempt() {
  if (!attemptStarted) {
    beginAttempt(study, puzzle.id);
    attemptStarted = true;
    save();
  }
}
function markAssisted() {
  startAttempt();
  assisted = true;
  reveal(study, puzzle.id);
  save();
}
function fail(text) {
  startAttempt();
  wrong++;
  if (wrong === 1) recordMiss(study, puzzle.id);
  reveal(study, puzzle.id);
  save();
  renderProgress();
  feedback(text, 'error');
  if (mode === 'test') {
    finished = true;
    testResults.push({ id: puzzle.id, correct: false, ms: Date.now() - startedAt });
    $('next').disabled = false;
    $('next').classList.add('primary');
    $('explanation-wrap').hidden = false;
    for (const b of $('answers').children) b.disabled = true;
    $('solution').disabled = true;
  }
  draw();
}
function success() {
  finished = true;
  const clean = wrong === 0 && !assisted && eligibleClean(study, puzzle.id);
  recordSolve(study, puzzle.id, clean);
  // Revealing the explanation prevents immediate replay from counting as fresh recall.
  reveal(study, puzzle.id);
  save();
  renderProgress();
  if (mode === 'test')
    testResults.push({
      id: puzzle.id,
      correct: wrong === 0 && !assisted,
      ms: Date.now() - startedAt,
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
function answer(choice, button) {
  if (finished || busy) return;
  startAttempt();
  if (choice === puzzle.answer) {
    button.className = 'correct';
    success();
  } else {
    button.className = 'incorrect';
    button.disabled = true;
    fail('Chưa đúng. Đọc lại điều kiện trong đề. ' + (mode === 'test' ? puzzle.explanation : ''));
  }
}
async function selectPoint(point) {
  if (!puzzle || busy || finished) return;
  if (viewStep >= 0) {
    feedback('Đang xem lại chuỗi. Chọn “Trở lại thế hiện tại” để tiếp tục.');
    return;
  }
  if (board[point]) {
    if (puzzle.kind === 'reading' && $('inspect').checked) {
      selected = point;
      markAssisted();
      draw();
      feedback(
        `Nhóm tại ${coordinate(point, puzzle.size)} có ${group(board, point, puzzle.size).liberties.length} khí.`
      );
    }
    return;
  }
  if (puzzle.kind === 'quiz') return;
  await play(point);
}
async function play(point) {
  if (!puzzle || puzzle.kind !== 'reading' || busy || finished || viewStep >= 0) return;
  startAttempt();
  busy = true;
  const currentEpoch = epoch;
  draw();
  const result = await ask('check', point);
  if (currentEpoch !== epoch) return;
  busy = false;
  hinted = -2;
  selected = -1;
  if (result.status === 'unknown') {
    feedback(
      'Bộ đọc vượt giới hạn tính toán hoặc chưa tải được. Nước này chưa được chấm; thử nước khác hoặc tải lại trang.'
    );
    autoPlay = false;
    draw();
    return;
  }
  if (result.status === 'invalid') {
    autoPlay = false;
    fail(result.message);
    return;
  }
  if (result.status === 'wrong') {
    autoPlay = false;
    if (point === -1) {
      fail(PASS_WRONG_TEXT);
      return;
    }
    if (result.counter !== undefined) {
      const steps = refutationSteps(board, point, result.counter, puzzle.size, history);
      if (steps.length) {
        trace.push(...steps);
        viewStep = trace.length - 1;
      }
    }
    fail(wrongMoveText(result, puzzle));
    return;
  }
  if (result.status === 'cancelled') return;
  trace.push({ board: [...result.playerBoard], point, color: 1 });
  if (result.status === 'continue')
    trace.push({ board: [...result.board], point: result.reply, color: 2 });
  board = result.board;
  history = result.history;
  remaining = result.remaining;
  last = result.status === 'continue' ? result.reply : point;
  if (result.status === 'solved') {
    autoPlay = false;
    success();
    return;
  }
  feedback(replyText(result, puzzle.size));
  draw();
  if (autoPlay) await getHint(true);
}
async function getHint(playIt = false) {
  if (!puzzle || puzzle.kind !== 'reading' || busy || finished || mode === 'test' || viewStep >= 0)
    return;
  markAssisted();
  if (!playIt && hintLevel === 0) {
    hintLevel = 1;
    selected = puzzle.target;
    const libs = group(board, puzzle.target, puzzle.size).liberties.length;
    feedback(hintText(1, { size: puzzle.size, liberties: libs }));
    draw();
    return;
  }
  busy = true;
  const currentEpoch = epoch;
  draw();
  const result = await ask('hint');
  if (currentEpoch !== epoch) return;
  busy = false;
  if (result.status !== 'hint') {
    autoPlay = false;
    feedback('Chưa tính được gợi ý trong giới hạn. Bạn có thể thử lại bài.');
    draw();
    return;
  }
  if (!playIt && hintLevel === 1) {
    hintLevel = 2;
    feedback(hintText(2, { size: puzzle.size, point: result.point }));
    draw();
    return;
  }
  hintLevel = 3;
  hinted = result.point;
  feedback(hintText(3, { size: puzzle.size, point: result.point }));
  draw();
  if (playIt) await play(result.point);
}
function next() {
  if (mode === 'test' && !finished) return;
  if (index + 1 < queue.length) {
    index++;
    load();
    return;
  }
  if (mode === 'test') {
    $('test-result').hidden = false;
    $('test-result').textContent = testResultText(testResults, queue.length);
    $('next').disabled = true;
    feedback('Phiên kiểm tra đã kết thúc. Chọn một chế độ để bắt đầu phiên khác.');
    return;
  }
  if (mode === 'review' || mode === 'today') {
    rebuild();
    return;
  }
  const nextStage = stages[stages.findIndex((s) => s.id === stage) + 1];
  if (nextStage) {
    stage = nextStage.id;
    topic = 'all';
    rebuild();
  } else {
    index = 0;
    load();
  }
}
function renderTrace() {
  $('variation').hidden = puzzle.kind !== 'reading' || trace.length < 2;
  $('move-list').replaceChildren();
  if ($('variation').hidden) return;
  trace.forEach((item, i) => {
    const button = document.createElement('button');
    button.textContent =
      i === 0
        ? 'Thế đầu'
        : item.refute
          ? `${item.color === 1 ? '✗ Đen' : 'Trắng (phản bác)'} ${coordinate(item.point, puzzle.size)}`
          : `${i}. ${item.color === 1 ? 'Đen' : 'Trắng'} ${coordinate(item.point, puzzle.size)}`;
    button.setAttribute('aria-pressed', String(viewStep === i));
    button.onclick = () => {
      viewStep = i;
      autoPlay = false;
      draw();
    };
    $('move-list').append(button);
  });
}
$('live-position').onclick = () => {
  trace = trace.filter((t) => !t.refute);
  viewStep = -1;
  draw();
};
function journal() {
  renderJournal($('game-list'), study.games);
}
for (const m of ['today', 'practice', 'review', 'test'])
  $(`mode-${m}`).onclick = () => {
    mode = m;
    rebuild();
  };
$('stage-select').onchange = () => {
  stage = $('stage-select').value;
  topic = 'all';
  rebuild();
  showPuzzle();
};
$('previous').onclick = () => {
  if (mode !== 'test' && index > 0) {
    index--;
    load();
    showPuzzle();
  }
};
$('topic').onchange = () => {
  topic = $('topic').value;
  rebuild();
};
$('problem-select').onchange = () => {
  index = Number($('problem-select').value);
  load();
  showPuzzle();
};
$('next').onclick = () => {
  next();
  showPuzzle();
};
$('retry').onclick = load;
$('hint').onclick = () => getHint();
$('solution').onclick = () => {
  if (!puzzle || busy || finished || mode === 'test') return;
  if (viewStep >= 0) {
    feedback('Chọn “Trở lại thế hiện tại” trước khi xem lời giải.');
    return;
  }
  markAssisted();
  if (puzzle.kind === 'quiz') {
    $('explanation-wrap').hidden = false;
    feedback(`Đáp án: ${puzzle.choices[puzzle.answer]}. ${puzzle.explanation}`);
    draw();
  } else {
    autoPlay = true;
    getHint(true);
  }
};
$('puzzle-pass').onclick = () => play(-1);
$('inspect').onchange = () => {
  if ($('inspect').checked) markAssisted();
  else selected = -1;
  draw();
};
setupBackup({
  exportButton: $('backup-export'),
  importInput: $('backup-import'),
  status: $('backup-status'),
  getStudy: () => study,
  getBankIds: () => bank.map((p) => p.id),
  onImport: (result) => {
    study = result.study;
    storageWritable = storageAvailable = true;
    save();
    rebuild();
    journal();
  },
});
setupJournalForm({
  form: $('game-form'),
  noteInput: $('game-note'),
  urlInput: $('game-url'),
  status: $('journal-status'),
  onAdd: ({ date, url, note }) => {
    study.games.push({ date, url, note, stage });
    study.games = study.games.slice(-100);
    save();
    journal();
    return storageAvailable;
  },
});
try {
  const response = await fetch('./reading-bank.json');
  if (!response.ok) throw Error('BANK');
  bank = buildBank(await response.json());
  const loaded = loadStudy(
    KEY,
    bank.map((p) => p.id)
  );
  study = loaded.study;
  storageAvailable = loaded.available;
  storageWritable = loaded.writable;
  const params = new URLSearchParams(location.search);
  if (stages.some((s) => s.id === params.get('stage'))) stage = params.get('stage');
  const requested = bank.find((p) => p.id === params.get('problem'));
  if (requested) stage = requested.stage;
  else if (!params.get('stage')) mode = 'today';
  rebuild(requested?.id);
  journal();
  save();
} catch (error) {
  console.error(error);
  $('title').textContent = 'Chưa tải được ngân hàng bài';
  feedback('Kiểm tra kết nối rồi tải lại trang. Tiến độ cũ được giữ nguyên.', 'error');
}
