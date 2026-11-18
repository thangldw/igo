import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadStudy, saveStudy } from '../study-storage.js';
import { collectExtras, isAcceptableGameUrl } from '../train-forms.js';

const memory = (initial = {}) => {
  const data = { ...initial };
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => void (data[k] = String(v)),
    data,
  };
};
const blocked = {
  getItem() {
    throw new Error('blocked');
  },
  setItem() {
    throw new Error('blocked');
  },
};

test('loadStudy starts fresh and writable when nothing is stored', () => {
  const r = loadStudy('k', ['a'], memory());
  assert.deepEqual([r.available, r.writable], [true, true]);
  assert.ok(r.study.records);
});

test('loadStudy round-trips what saveStudy wrote', () => {
  const storage = memory();
  const first = loadStudy('k', ['a'], storage).study;
  first.records.a = { attempts: 1 };
  assert.equal(saveStudy('k', first, storage), true);
  assert.equal(loadStudy('k', ['a'], storage).study.records.a.attempts, 1);
});

test('loadStudy refuses to overwrite incompatible or corrupt data', () => {
  for (const raw of [
    '{not json',
    JSON.stringify({ version: 2, records: {} }),
    JSON.stringify({ version: 1, records: [] }),
  ]) {
    const r = loadStudy('k', ['a'], memory({ k: raw }));
    assert.deepEqual([r.available, r.writable], [false, false], raw);
  }
});

test('blocked storage means unavailable but still usable in memory', () => {
  const r = loadStudy('k', ['a'], blocked);
  assert.equal(r.available, false);
  assert.equal(r.writable, true);
  assert.equal(saveStudy('k', {}, blocked), false);
});

test('collectExtras gathers only present keys and survives blocked storage', () => {
  assert.deepEqual(collectExtras(memory({ 'igo-progress': '[0]', other: 'x' })), {
    'igo-progress': '[0]',
  });
  assert.deepEqual(collectExtras(blocked), {});
});

test('isAcceptableGameUrl allows empty and http(s) only', () => {
  assert.ok(isAcceptableGameUrl(''));
  assert.ok(isAcceptableGameUrl('https://online-go.com/game/1'));
  assert.ok(isAcceptableGameUrl('http://example.com'));
  assert.ok(!isAcceptableGameUrl('javascript:alert(1)'));
  assert.ok(!isAcceptableGameUrl('ftp://x'));
  assert.ok(!isAcceptableGameUrl('not a url'));
});
