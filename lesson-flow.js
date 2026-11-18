// Lesson mode: loading lessons, answering them and moving between them.

import { empty, move } from './engine.js';
import { lessons, levels } from './lessons.js';
import { showLessonChrome } from './page-chrome.js';
import {
  renderNavigation,
  renderAnswers,
  successText,
  introText,
  nextLabel,
} from './lesson-view.js';
import { saveProgress, loadLessonId, saveLessonId } from './lesson-storage.js';
import {
  $,
  app,
  current,
  currentLevel,
  levelLessons,
  message,
  search,
  targets,
} from './play-state.js';
import { syncNav } from './game-flow.js';
import { draw } from './board-draw.js';

export function showLesson() {
  const heading = $('title');
  heading.tabIndex = -1;
  heading.focus({ preventScroll: true });
  heading.scrollIntoView({ block: 'start' });
}

export function navigation() {
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

/** @param {string} text */
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

/** @param {number} i index into the lessons list */
export function load(i) {
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
/** @param {number} i */
export function playLessonMove(i) {
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

export function savedLessonIndex() {
  const i = lessons.findIndex((l) => l.id === loadLessonId());
  return i < 0 ? 0 : i;
}
