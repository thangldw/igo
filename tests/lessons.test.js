import {test} from 'node:test';
import assert from 'node:assert/strict';
import {empty, group, move} from '../engine.js';
import {lessons} from '../lessons.js';

const find = id => lessons.find(l => l.id === id);
function position(l) {
  const board = empty(5);
  for (const [p, c] of l.setup || []) board[p] = c;
  return board;
}
function playLine(l, line) {
  let board = position(l);
  const history = [board.join('')], captures = [];
  line.forEach((p, index) => {
    const result = move(board, p, index % 2 + 1, 5, history);
    assert.equal(result.error, undefined, `${l.id}, ply ${index + 1}`);
    captures.push(result.captured);
    board = result.board;
    history.push(board.join(''));
  });
  return {board, captures};
}
test('every lesson setup contains only groups with liberties', () => {
  for (const l of lessons) {
    const board = position(l);
    board.forEach((c, p) => { if (c) assert.ok(group(board, p, 5).liberties.length, `${l.id}: ${p}`); });
  }
});
test('connecting and cutting change the intended connectivity', () => {
  let l = find('intermediate-0');
  let r = move(position(l), l.target, 1, 5);
  assert.ok(group(r.board, 11, 5).stones.includes(13));
  l = find('intermediate-1');
  r = move(position(l), l.target, 1, 5);
  assert.ok(!group(r.board, 11, 5).stones.includes(13));
  assert.ok(group(r.board, 12, 5).liberties.length);
});
test('double atari puts two distinct white groups on one liberty each', () => {
  const l = find('intermediate-2'), r = move(position(l), l.target, 1, 5);
  assert.deepEqual(group(r.board, 11, 5).liberties, [16]);
  assert.deepEqual(group(r.board, 13, 5).liberties, [18]);
});
test('two true eyes cannot be filled by white', () => {
  const l = find('intermediate-3'), r = move(position(l), l.target, 1, 5);
  for (const p of [0, 2]) assert.match(move(r.board, p, 2, 5).error, /Tự sát/);
});
test('group liberty answer matches the board', () => {
  assert.equal(group(position(find('intermediate-4')), 6, 5).liberties.length, 5);
});
test('ko example really repeats the pre-capture position', () => {
  const after = position(find('intermediate-5')), before = [...after];
  before[12] = 0;
  before[7] = 2;
  const capture = move(before, 12, 1, 5, [before.join('')]);
  assert.deepEqual(capture.board, after);
  assert.equal(capture.captured, 1);
  assert.match(move(after, 7, 2, 5, [before.join(''), after.join('')]).error, /Ko/);
});
test('snapback loses one stone then captures two without repetition', () => {
  const l = find('advanced-0'), result = playLine(l, l.lines[0]);
  assert.deepEqual(result.captures, [0, 1, 2]);
  assert.equal(result.board[9], 0);
  assert.equal(result.board[14], 0);
});
test('double atari continuation captures the unsaved white stone', () => {
  const l = find('advanced-1'), result = playLine(l, l.lines[0]);
  assert.deepEqual(result.captures, [0, 0, 1]);
  assert.equal(result.board[13], 0);
  assert.equal(result.board[11], 2);
});
test('both edge-reading variations are legal and capture the target', () => {
  const l = find('advanced-2');
  for (const line of l.lines) assert.equal(playLine(l, line).board[1], 0);
});
