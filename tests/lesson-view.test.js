import { test } from 'node:test';
import assert from 'node:assert/strict';
import { successText, introText, nextLabel, turnText, capturedText } from '../lesson-view.js';
import { lessons, levels } from '../lessons.js';

test('successText prefers the lesson text, then falls back by kind', () => {
  assert.equal(successText({ success: 'Tốt!', kind: 'capture' }), 'Tốt!');
  assert.match(successText({ kind: 'territory', answer: 0 }), /1 điểm đất/);
  assert.match(successText({ kind: 'quiz', answer: 2 }), /4 khí/);
  assert.match(successText({ kind: 'place' }), /nước đầu tiên/);
  assert.match(successText({ kind: 'save' }), /3 khí/);
  assert.match(successText({ kind: 'capture' }, 3), /bắt 3 quân/);
});

test('every shipped lesson yields a non-empty success text', () => {
  for (const l of lessons) assert.ok(successText(l, 1).length > 0, l.id);
});

test('introText depends on lesson kind', () => {
  assert.match(introText({ kind: 'sequence' }, false), /chuỗi mẫu/);
  assert.match(introText({ kind: 'quiz' }, true), /đáp án/);
  assert.match(introText({ kind: 'place' }, false), /trực tiếp/);
});

test('nextLabel names the next level or the play mode', () => {
  const [a, b] = [lessons[0], lessons.find((l) => l.level !== lessons[0].level)];
  assert.equal(nextLabel(undefined, a.level, levels), 'Luyện với máy →');
  assert.equal(nextLabel(a, a.level, levels), 'Bài tiếp theo →');
  assert.match(nextLabel(b, a.level, levels), /^Sang .+ →$/);
});

test('turnText and capturedText cover lesson and game modes', () => {
  const seq = { kind: 'sequence', lines: [[1, 2, 3, 4]] };
  assert.equal(
    turnText({
      mode: 'lesson',
      lesson: seq,
      lineStep: 2,
      solved: false,
      ended: false,
      busy: false,
    }),
    '● Đen đi · Nước 2 / 2'
  );
  assert.equal(
    turnText({ mode: 'lesson', lesson: seq, lineStep: 0, solved: true, ended: false, busy: false }),
    '✓ Đã hoàn thành bài'
  );
  const game = { mode: 'game', lesson: seq, lineStep: 0, solved: false };
  assert.equal(turnText({ ...game, ended: true, busy: false }), 'Ván đã kết thúc');
  assert.equal(turnText({ ...game, ended: false, busy: true }), '○ Máy đang đi…');
  assert.equal(turnText({ ...game, ended: false, busy: false }), '● Lượt của bạn');
  assert.equal(
    capturedText({ mode: 'lesson', lesson: seq, captures: [0, 0] }),
    'Trắng đáp theo chuỗi mẫu'
  );
  assert.equal(
    capturedText({ mode: 'game', lesson: seq, captures: [1, 2] }),
    'Đã bắt: đen 1 · trắng 2'
  );
});
