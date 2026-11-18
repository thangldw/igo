// Training page session: building the queue, loading puzzles and moving between them.

import { empty } from './engine.js';
import { stages } from './curriculum.js';
import { renderTerms } from './terms.js';
import {
  shuffle,
  testResultText,
  renderStages,
  renderTopicSelect,
  renderProblemSelect,
  modeHelpText,
  showEmptyQueue,
  showQuizChoices,
  chapterLabel,
  tipText,
} from './train-view.js';
import { renderToday, renderTopics, renderJournal } from './train-panels.js';
import { needsReview, topicStats, dailyPlan, streakDays, weekDots } from './study-state.js';
import { transformPuzzle, variantFor } from './symmetry.js';
import { $, feedback, reading, showPuzzle, stageInfo, train } from './train-state.js';
import { draw } from './train-board.js';
import { answer } from './train-play.js';

export function renderProgress() {
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

/** @param {string} [preferred] id of the puzzle to open first */
export function rebuild(preferred) {
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

export function load() {
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

export function next() {
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

export function journal() {
  renderJournal($('game-list'), train.study.games);
}
