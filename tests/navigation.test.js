import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';

const PAGES = ['index.html', 'train.html', 'review.html'];
const doc = (f) => parseHTML(readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')).document;
const links = (f) =>
  [...doc(f).querySelectorAll('.site-nav a')].map((a) => ({
    key: a.dataset.nav,
    href: a.getAttribute('href'),
    current: a.getAttribute('aria-current') === 'page',
    n: a.querySelector('.step-num')?.textContent.trim(),
    label: a.textContent.replace(a.querySelector('.step-num')?.textContent ?? '', '').trim(),
  }));

test('all pages share one four-item navigation, numbered 1-4 in the same order', () => {
  const expected = [
    ['learn', './index.html', 'Học cách chơi'],
    ['train', './train.html', 'Luyện bài tập'],
    ['play', './index.html?play=1', 'Chơi với máy'],
    ['review', './review.html', 'Xem lại ván'],
  ];
  for (const f of PAGES) {
    const l = links(f);
    assert.deepEqual(
      l.map((x) => [x.key, x.href, x.label]),
      expected,
      f
    );
    assert.deepEqual(
      l.map((x) => x.n),
      ['1', '2', '3', '4'],
      f
    );
  }
});

test('each page marks exactly its own item as current', () => {
  const current = (f) =>
    links(f)
      .filter((x) => x.current)
      .map((x) => x.key);
  assert.deepEqual(current('index.html'), ['learn']);
  assert.deepEqual(current('train.html'), ['train']);
  assert.deepEqual(current('review.html'), ['review']);
});

test('support button slot sits in the header between the brand and navigation on every page', () => {
  for (const f of PAGES) {
    const d = doc(f);
    assert.equal(d.querySelectorAll('#supportSlot').length, 1, f);
    const slot = d.getElementById('supportSlot');
    assert.equal(slot.parentElement.tagName, 'HEADER', f);
    assert.equal(slot.nextElementSibling?.className, 'site-nav', f);
    assert.ok(slot.previousElementSibling, `${f}: brand group precedes the slot`);
  }
});
