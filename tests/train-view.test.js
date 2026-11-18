import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  shuffle,
  storageStatusText,
  testResultText,
  STAGE_LABELS,
  modeHelpText,
  emptyQueueTitle,
  chapterLabel,
  tipText,
  turnStatusText,
  depthStatusText,
  attemptStatusText,
} from '../train-view.js';
import { hintText } from '../reading-trace.js';
import { stages } from '../curriculum.js';

test('shuffle returns a permutation without mutating the input', () => {
  const input = [1, 2, 3, 4, 5, 6];
  const out = shuffle(input, () => 0.3);
  assert.deepEqual(input, [1, 2, 3, 4, 5, 6]);
  assert.deepEqual([...out].sort(), input);
  assert.deepEqual(
    shuffle(input, () => 0.3),
    out,
    'deterministic for a fixed random source'
  );
});

test('storageStatusText covers writable, unavailable and incompatible storage', () => {
  assert.match(storageStatusText({ writable: true, available: true }), /^Lưu trên/);
  assert.match(storageStatusText({ writable: true, available: false }), /Không lưu được/);
  assert.match(storageStatusText({ writable: false, available: false }), /không tương thích/);
});

test('testResultText summarises score, advice and average time', () => {
  const pass = Array.from({ length: 10 }, (_, i) => ({ correct: i < 9, ms: 4000 }));
  const text = testResultText(pass, 10);
  assert.match(text, /9\/10 bài đúng/);
  assert.match(text, /chuyển chặng/);
  assert.match(text, /4 giây\/bài/);
  assert.match(testResultText([{ correct: false, ms: 0 }], 10), /Ưu tiên ôn/);
  assert.match(testResultText([], 10), /0 giây\/bài/);
});

test('every curriculum stage has a display label', () => {
  for (const s of stages) assert.ok(STAGE_LABELS[s.id], s.id);
});

test('mode help and empty-queue titles differ per mode', () => {
  const modes = ['today', 'practice', 'review', 'test'];
  assert.equal(new Set(modes.map(modeHelpText)).size, 4);
  assert.equal(new Set(['review', 'today', 'practice'].map(emptyQueueTitle)).size, 3);
});

test('chapterLabel tags mode, position and rotated views', () => {
  assert.equal(
    chapterLabel({ stageName: 'Nhập môn', mode: 'practice', index: 2, total: 20 }),
    'NHẬP MÔN · BÀI TẬP 3/20'
  );
  assert.equal(
    chapterLabel({ stageName: 'x', mode: 'test', index: 0, total: 10, rotated: true }),
    'X · KIỂM TRA 1/10 · GÓC NHÌN KHÁC'
  );
});

test('tipText distinguishes quiz, capture and eye reading puzzles', () => {
  const tips = [
    tipText({ kind: 'quiz' }),
    tipText({ kind: 'reading' }),
    tipText({ kind: 'reading', goal: 'eyes' }),
  ];
  assert.equal(new Set(tips).size, 3);
});

test('turnStatusText prioritises replay, then result, then busy, then whose move', () => {
  const base = {
    viewStep: -1,
    finished: false,
    mode: 'practice',
    wrong: 0,
    busy: false,
    reading: true,
  };
  assert.equal(
    turnStatusText({ ...base, viewStep: 2, finished: true }),
    'Xem lại lượt 2 · không đặt quân ở thế này'
  );
  assert.equal(turnStatusText({ ...base, finished: true }), '✓ Bài đã kết thúc');
  assert.equal(
    turnStatusText({ ...base, finished: true, mode: 'test', wrong: 1 }),
    '× Bài chưa đúng'
  );
  assert.match(turnStatusText({ ...base, busy: true }), /Đang kiểm tra/);
  assert.equal(turnStatusText(base), '● Đen đi');
  assert.match(turnStatusText({ ...base, reading: false }), /Chọn câu trả lời/);
});

test('depthStatusText and attemptStatusText', () => {
  assert.equal(
    depthStatusText({ reading: true, hasBoard: true, depth: 5, viewStep: -1, remaining: 3 }),
    'Còn 3 lượt cả hai bên'
  );
  assert.equal(
    depthStatusText({ reading: true, hasBoard: true, depth: 5, viewStep: 2, remaining: 0 }),
    'Còn 3 lượt cả hai bên'
  );
  assert.equal(
    depthStatusText({ reading: false, hasBoard: true, depth: 0, viewStep: -1, remaining: 0 }),
    'Sơ đồ minh họa'
  );
  assert.equal(
    depthStatusText({ reading: false, hasBoard: false, depth: 0, viewStep: -1, remaining: 0 }),
    ''
  );
  assert.equal(
    attemptStatusText({ wrong: 0, assisted: false, mode: 'practice' }),
    'Chưa dùng gợi ý'
  );
  assert.equal(
    attemptStatusText({ wrong: 2, assisted: true, mode: 'practice' }),
    '2 lần sai · Đã dùng gợi ý'
  );
  assert.equal(
    attemptStatusText({ wrong: 0, assisted: false, mode: 'test' }),
    'Kiểm tra không gợi ý'
  );
});

test('hintText escalates from liberties to row to exact move', () => {
  assert.match(hintText(1, { size: 5, liberties: 3 }), /còn 3 khí/);
  assert.match(hintText(2, { size: 5, point: 7 }), /hàng 4/);
  assert.match(hintText(3, { size: 5, point: 7 }), /C4/);
});
