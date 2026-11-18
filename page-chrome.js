// Static page furniture that changes between lesson mode and play mode: headings, helper text,
// which buttons and panels are visible, and the page URL. No game state lives here.
import { renderTerms } from './terms.js';

const $ = (/** @type {string} */ id) => /** @type {any} */ (document.getElementById(id));

/** Rewrites the URL without reloading: drops lesson/play/size params, then applies `set`. */
function updateUrl(set = {}) {
  const url = new URL(location.href);
  for (const key of ['play', 'lesson', 'size']) url.searchParams.delete(key);
  for (const [key, value] of Object.entries(set)) url.searchParams.set(key, value);
  window.history.replaceState(null, '', url);
}

/**
 * Shows lesson mode for `lesson`. Returns true when the lesson is a conceptual quiz with no board.
 * @param {{ lesson: any, chapter: string, isFirst: boolean }} data
 */
export function showLessonChrome({ lesson, chapter, isFirst }) {
  $('chapter').textContent = chapter;
  $('title').textContent = lesson.title;
  $('board-size').textContent = '5 × 5';
  $('guide-title').textContent = lesson.heading;
  $('description').textContent = lesson.description;
  $('tip').textContent = lesson.tip;
  renderTerms($('terms'), [lesson.title, lesson.description, lesson.tip].join(' '));
  updateUrl();
  $('previous').disabled = isFirst;
  $('previous').hidden = false;
  $('game-controls').hidden = true;
  $('size-help').hidden = true;
  document.querySelector('.workflow-help p').textContent =
    '1. Chọn bài bên trái. 2. Đọc yêu cầu. 3. Nhấn bàn cờ hoặc chọn đáp án. Làm xong thì bấm “Bài tiếp theo”.';
  $('next').hidden = true;
  $('hint').hidden = false;
  $('retry').hidden = false;
  const conceptual = lesson.kind === 'quiz' && !lesson.setup.length;
  $('description').hidden = conceptual;
  $('play-surface').hidden = conceptual;
  $('concept').hidden = !conceptual;
  $('concept').textContent = conceptual ? lesson.description : '';
  $('board-footer').hidden = conceptual;
  $('board-size').hidden = conceptual;
  return conceptual;
}

/**
 * Shows play-against-the-bot mode for an `n`×`n` board.
 * @param {{ n: number, handicap: number }} data
 */
export function showGameChrome({ n, handicap }) {
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
  updateUrl({ play: '1', size: String(n) });
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
}
