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
const train = {
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

const reading = createReadingClient();
function showPuzzle() {
  const heading = $('test-result').hidden ? $('title') : $('test-result');
  heading.tabIndex = -1;
  heading.focus({ preventScroll: true });
  heading.scrollIntoView({ block: 'start' });
}
const stageInfo = () => stages.find((s) => s.id === train.stage);
const coordinate = (point, size) => (point === -1 ? 'bỏ lượt' : boardCoordinate(point, size));
function feedback(text, type = '') {
  $('feedback').textContent = text;
  $('feedback').className = type;
}
function save() {
  if (train.storageWritable && !saveStudy(KEY, train.study)) train.storageAvailable = false;
  $('storage-status').textContent = storageStatusText({
    writable: train.storageWritable,
    available: train.storageAvailable,
  });
}
function renderProgress() {
  renderStages(
    { list: $('stages'), select: $('stage-select'), total: $('total') },
    {
      stages,
      bank: train.bank,
      study: train.study,
      stage: train.stage,
      onPick: (id) => {
        train.stage = id;
        train.topic = 'all';
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
  const stageBank = train.bank.filter((p) => p.stage === train.stage);
  train.topic = renderTopicSelect(
    $('topic'),
    stageBank.map((p) => p.topic),
    train.topic,
    train.mode === 'test' || train.mode === 'today'
  );
  const candidates = stageBank.filter((p) => train.topic === 'all' || p.topic === train.topic);
  train.queue =
    train.mode === 'today'
      ? dailyPlan(
          train.bank,
          train.study,
          Date.now(),
          stages.map((x) => x.id)
        ).items
      : train.mode === 'review'
        ? candidates.filter((p) => needsReview(train.study.records[p.id]))
        : train.mode === 'test'
          ? shuffle(stageBank).slice(0, 10)
          : candidates;
  train.testResults = [];
  train.index = preferred
    ? Math.max(
        0,
        train.queue.findIndex((p) => p.id === preferred)
      )
    : 0;
  renderProblemSelect($('problem-select'), train.queue, train.study, train.mode === 'test');
  for (const m of ['today', 'practice', 'review', 'test'])
    $(`mode-${m}`).setAttribute('aria-pressed', String(train.mode === m));
  renderProgress();
  renderTodayCard();
  load();
}
function renderTodayCard() {
  const card = $('today');
  card.hidden = train.mode !== 'today';
  if (card.hidden) return;
  const plan = dailyPlan(
    train.bank,
    train.study,
    Date.now(),
    stages.map((x) => x.id)
  );
  renderToday(card, { plan, streak: streakDays(train.study), dots: weekDots(train.study) });
}
if (matchMedia('(max-width:700px)').matches) $('topic-panel').open = false;
function renderTopicStats() {
  const stats = topicStats(train.bank, train.study).filter((t) => t.attempted > 0);
  renderTopics($('topic-stats'), stats, (t) => {
    const pool = train.bank
      .filter((p) => p.topic === t.topic)
      .sort(
        (a, b) =>
          Number(needsReview(train.study.records[b.id])) -
            Number(needsReview(train.study.records[a.id])) ||
          stages.findIndex((x) => x.id === a.stage) - stages.findIndex((x) => x.id === b.stage)
      );
    const first =
      pool.find(
        (p) => needsReview(train.study.records[p.id]) || !train.study.records[p.id]?.clean
      ) || pool[0];
    train.mode = 'practice';
    train.stage = first.stage;
    train.topic = t.topic;
    rebuild(first.id);
    showPuzzle();
  });
}
function ask(action, point) {
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
function load() {
  train.epoch++;
  reading.reset();
  train.busy = train.finished = train.assisted = train.attemptStarted = train.autoPlay = false;
  train.wrong = 0;
  train.last = train.selected = -1;
  train.hinted = -2;
  $('inspect').checked = false;
  $('inspect').disabled = train.mode === 'test';
  $('test-result').hidden = true;
  $('explanation-wrap').hidden = true;
  $('answers').replaceChildren();
  $('variation').hidden = true;
  $('concept').hidden = true;
  $('play-surface').hidden = false;
  $('hint').disabled = train.mode === 'test';
  $('solution').disabled = train.mode === 'test';
  $('retry').disabled = train.mode === 'test';
  $('reading-controls').hidden = false;
  $('previous').disabled = train.mode === 'test' || train.index === 0;
  $('mode-help').textContent = modeHelpText(train.mode);
  if (!train.queue.length) {
    renderTerms($('terms'), '');
    train.puzzle = null;
    showEmptyQueue({ mode: train.mode, stageName: stageInfo().name });
    feedback('');
    return;
  }
  const canonical = train.queue[train.index];
  train.hintLevel = 0;
  train.startedAt = Date.now();
  train.puzzle =
    train.mode === 'test'
      ? canonical
      : transformPuzzle(canonical, variantFor(train.study.records[canonical.id]?.attempts || 0));
  $('problem-select').value = String(train.index);
  train.board = empty(train.puzzle.size || 5);
  for (const [p, c] of train.puzzle.setup) train.board[p] = c;
  train.trace = [{ board: [...train.board], point: -1, color: 0 }];
  train.viewStep = -1;
  train.history = [train.board.join('')];
  train.remaining = train.puzzle.depth || 0;
  $('chapter').textContent = chapterLabel({
    stageName: stages.find((x) => x.id === train.puzzle.stage).name,
    mode: train.mode,
    index: train.index,
    total: train.queue.length,
    rotated: train.puzzle.symmetry,
  });
  $('title').textContent = train.puzzle.title;
  $('guide-title').textContent = train.puzzle.topic;
  $('objective').textContent = train.puzzle.kind === 'reading' ? train.puzzle.prompt : '';
  $('board-size').hidden = !train.puzzle.size;
  $('board-size').textContent = `${train.puzzle.size} × ${train.puzzle.size}`;
  $('proof-label').textContent =
    train.puzzle.kind === 'reading' ? 'NGHĨ CẢ NƯỚC ĐỐI THỦ' : 'DÙNG CÁC ĐIỀU KIỆN TRONG ĐỀ';
  $('tip').textContent = tipText(train.puzzle);
  $('explanation').textContent = train.puzzle.explanation;
  renderTerms(
    $('terms'),
    [
      stageInfo().name,
      train.puzzle.title,
      train.puzzle.prompt,
      train.puzzle.choices?.join(' ') || '',
    ].join(' '),
    { disabled: train.mode === 'test' }
  );
  const url = new URL(location.href);
  url.searchParams.set('stage', train.stage);
  url.searchParams.set('problem', train.puzzle.id);
  window.history.replaceState(null, '', url);
  if (train.puzzle.kind === 'quiz') showQuizChoices(train.puzzle, answer);
  $('next').disabled = train.mode === 'test';
  $('next').classList.toggle('primary', false);
  feedback(
    train.mode === 'test' ? 'Lần thử đầu quyết định điểm. Gợi ý đã tắt.' : 'Đọc trước khi đi.'
  );
  draw();
}
function draw() {
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
function startAttempt() {
  if (!train.attemptStarted) {
    beginAttempt(train.study, train.puzzle.id);
    train.attemptStarted = true;
    save();
  }
}
function markAssisted() {
  startAttempt();
  train.assisted = true;
  reveal(train.study, train.puzzle.id);
  save();
}
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
function answer(choice, button) {
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
async function selectPoint(point) {
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
async function play(point) {
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
async function getHint(playIt = false) {
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
function next() {
  if (train.mode === 'test' && !train.finished) return;
  if (train.index + 1 < train.queue.length) {
    train.index++;
    load();
    return;
  }
  if (train.mode === 'test') {
    $('test-result').hidden = false;
    $('test-result').textContent = testResultText(train.testResults, train.queue.length);
    $('next').disabled = true;
    feedback('Phiên kiểm tra đã kết thúc. Chọn một chế độ để bắt đầu phiên khác.');
    return;
  }
  if (train.mode === 'review' || train.mode === 'today') {
    rebuild();
    return;
  }
  const nextStage = stages[stages.findIndex((s) => s.id === train.stage) + 1];
  if (nextStage) {
    train.stage = nextStage.id;
    train.topic = 'all';
    rebuild();
  } else {
    train.index = 0;
    load();
  }
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
$('live-position').onclick = () => {
  train.trace = train.trace.filter((t) => !t.refute);
  train.viewStep = -1;
  draw();
};
function journal() {
  renderJournal($('game-list'), train.study.games);
}
for (const m of ['today', 'practice', 'review', 'test'])
  $(`mode-${m}`).onclick = () => {
    train.mode = m;
    rebuild();
  };
$('stage-select').onchange = () => {
  train.stage = $('stage-select').value;
  train.topic = 'all';
  rebuild();
  showPuzzle();
};
$('previous').onclick = () => {
  if (train.mode !== 'test' && train.index > 0) {
    train.index--;
    load();
    showPuzzle();
  }
};
$('topic').onchange = () => {
  train.topic = $('topic').value;
  rebuild();
};
$('problem-select').onchange = () => {
  train.index = Number($('problem-select').value);
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
  if (!train.puzzle || train.busy || train.finished || train.mode === 'test') return;
  if (train.viewStep >= 0) {
    feedback('Chọn “Trở lại thế hiện tại” trước khi xem lời giải.');
    return;
  }
  markAssisted();
  if (train.puzzle.kind === 'quiz') {
    $('explanation-wrap').hidden = false;
    feedback(`Đáp án: ${train.puzzle.choices[train.puzzle.answer]}. ${train.puzzle.explanation}`);
    draw();
  } else {
    train.autoPlay = true;
    getHint(true);
  }
};
$('puzzle-pass').onclick = () => play(-1);
$('inspect').onchange = () => {
  if ($('inspect').checked) markAssisted();
  else train.selected = -1;
  draw();
};
setupBackup({
  exportButton: $('backup-export'),
  importInput: $('backup-import'),
  status: $('backup-status'),
  getStudy: () => train.study,
  getBankIds: () => train.bank.map((p) => p.id),
  onImport: (result) => {
    train.study = result.study;
    train.storageWritable = train.storageAvailable = true;
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
    train.study.games.push({ date, url, note, stage: train.stage });
    train.study.games = train.study.games.slice(-100);
    save();
    journal();
    return train.storageAvailable;
  },
});
try {
  const response = await fetch('./reading-bank.json');
  if (!response.ok) throw Error('BANK');
  train.bank = buildBank(await response.json());
  const loaded = loadStudy(
    KEY,
    train.bank.map((p) => p.id)
  );
  train.study = loaded.study;
  train.storageAvailable = loaded.available;
  train.storageWritable = loaded.writable;
  const params = new URLSearchParams(location.search);
  if (stages.some((s) => s.id === params.get('stage'))) train.stage = params.get('stage');
  const requested = train.bank.find((p) => p.id === params.get('problem'));
  if (requested) train.stage = requested.stage;
  else if (!params.get('stage')) train.mode = 'today';
  rebuild(requested?.id);
  journal();
  save();
} catch (error) {
  console.error(error);
  $('title').textContent = 'Chưa tải được ngân hàng bài';
  feedback('Kiểm tra kết nối rồi tải lại trang. Tiến độ cũ được giữ nguyên.', 'error');
}
