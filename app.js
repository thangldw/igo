import { lessons } from './lessons.js';
import { GAME_KEY, REVIEW_GAME_KEY, recordSgf } from './game-record.js';
import { analysisSummary } from './game-text.js';
import { loadLessonId, readItem, writeItem } from './lesson-storage.js';
import { $, app, clock, current, message, pointName, search } from './play-state.js';
import {
  enterPlay,
  finish,
  persist,
  record,
  reply,
  resume,
  saveTurn,
  savedSizeMatches,
  start,
} from './game-flow.js';
import { load, savedLessonIndex, showLesson } from './lesson-flow.js';
import { click, draw } from './board-draw.js';

$('game-handicap').onchange = () => {
  $('game-komi').value = Number($('game-handicap').value) ? '0.5' : '6.5';
};

setInterval(() => clock.tick(app.mode === 'game', app.ended), 1000);

$('clock-limit').onchange = () => clock.reset();

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
  const done = (/** @type {string} */ text) => {
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
