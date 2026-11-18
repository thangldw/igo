import { test } from 'node:test';
import assert from 'node:assert/strict';
import { empty } from '../engine.js';
import { refutationSteps, wrongMoveText, replyText } from '../reading-trace.js';

test('refutationSteps returns the wrong move then the counter, or nothing if illegal', () => {
  const board = empty(5),
    history = [board.join('')];
  const steps = refutationSteps(board, 12, 13, 5, history);
  assert.equal(steps.length, 2);
  assert.equal(steps[0].color, 1);
  assert.equal(steps[0].board[12], 1);
  assert.equal(steps[1].color, 2);
  assert.equal(steps[1].board[13], 2);
  assert.ok(steps.every((s) => s.refute));
  assert.deepEqual(refutationSteps(board, 12, 12, 5, history), [], 'counter on an occupied point');
  assert.deepEqual(board, empty(5), 'input board is not mutated');
});

test('wrongMoveText names the goal and the refuting point', () => {
  assert.match(wrongMoveText({ counter: 6 }, { size: 5 }), /bắt được nhóm.*nước B4/);
  assert.match(wrongMoveText({}, { size: 5, goal: 'eyes' }), /tạo hai mắt/);
  assert.doesNotMatch(wrongMoveText({}, { size: 5 }), /Trắng có thể ngăn/);
});

test('replyText mentions captures only when there were some', () => {
  assert.equal(replyText({ reply: 0 }, 5), 'Trắng A5. Đọc nước đen tiếp theo.');
  assert.match(replyText({ reply: 0, whiteCaptured: 2 }, 5), /, bắt 2 quân đen/);
});
