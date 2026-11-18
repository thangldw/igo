import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validNotes } from '../review-notes.js';

const note = (path, extra = {}) => ({
  move: 3,
  path,
  candidates: 'a',
  refutation: 'b',
  conclusion: 'c',
  ...extra,
});

test('validNotes accepts well-formed notes keyed by their JSON path', () => {
  assert.equal(validNotes({}), true);
  assert.equal(validNotes({ '[0,1]': note([0, 1]) }), true);
});

test('validNotes rejects malformed containers, keys and fields', () => {
  for (const bad of [null, undefined, [], 'x', 3]) assert.equal(validNotes(bad), false);
  assert.equal(validNotes({ 'not json': note([]) }), false);
  assert.equal(validNotes({ '[0,-1]': note([0, -1]) }), false, 'negative index');
  assert.equal(validNotes({ '[0]': note([1]) }), false, 'path must match its key');
  assert.equal(validNotes({ '[0]': note([0], { move: 1.5 }) }), false);
  assert.equal(validNotes({ '[0]': note([0], { candidates: 7 }) }), false);
  assert.equal(validNotes({ '[0]': note([0], { conclusion: 'x'.repeat(2001) }) }), false);
  assert.equal(validNotes({ '[0]': null }), false);
});
