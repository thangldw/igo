import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const manifest = JSON.parse(read('deploy-files.json'));
const shipped = new Set(manifest.files);
const sw = read('sw.js');
const pages = ['index.html', 'train.html', 'review.html'];

function localRefs(file) {
  // Ignore comments so JSDoc such as import('./types.js') is not mistaken for a runtime import.
  const text = read(file)
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, ''),
    refs = new Set();
  for (const m of text.matchAll(/(?:href|src)="\.\/([\w.-]+)(?:\?[^"]*)?"/g)) refs.add(m[1]);
  for (const m of text.matchAll(/(?:from|import)\s*\(?\s*['"]\.\/([\w.-]+)['"]/g)) refs.add(m[1]);
  for (const m of text.matchAll(/new (?:Worker|URL)\(\s*(?:new URL\()?['"]\.\/([\w.-]+)['"]/g))
    refs.add(m[1]);
  for (const m of text.matchAll(/fetch\(['"]\.\/([\w.-]+)['"]/g)) refs.add(m[1]);
  return refs;
}
test('every local file used by the pages is deployed and exists', () => {
  const queue = [...pages],
    seen = new Set();
  while (queue.length) {
    const f = queue.pop();
    if (seen.has(f)) continue;
    seen.add(f);
    assert.ok(existsSync(new URL(`../${f}`, import.meta.url)), `${f} referenced but missing`);
    assert.ok(shipped.has(f), `${f} is not in the pages.yml cp list`);
    if (/\.(js|html)$/.test(f)) for (const r of localRefs(f)) queue.push(r);
  }
});
test('every manifest file and directory exists', () => {
  for (const f of [...manifest.files, ...manifest.dirs])
    assert.ok(existsSync(new URL(`../${f}`, import.meta.url)), `${f} listed but missing`);
});
test('the build generates a service worker that precaches every shipped file', () => {
  execFileSync('node', ['scripts/build.mjs'], { cwd: new URL('..', import.meta.url) });
  const built = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
  assert.match(built, /const VERSION = 'igo-[0-9a-f]{12}';/);
  const core = JSON.parse(built.match(/const CORE = (\[.*?\]);/)[1]);
  for (const f of shipped) {
    if (manifest.noPrecache.includes(f)) continue;
    assert.ok(core.includes(`./${f}`), `${f} missing from generated CORE`);
    assert.ok(existsSync(new URL(`../public/${f}`, import.meta.url)), `${f} not built`);
  }
  assert.ok(core.includes('./fonts/BeVietnamPro-Regular.ttf'));
  const version = built.match(/igo-([0-9a-f]{12})/)[1];
  for (const page of pages) {
    const html = readFileSync(new URL(`../public/${page}`, import.meta.url), 'utf8');
    assert.match(
      html,
      new RegExp(`href="\\./?style\\.css\\?v=${version}"|href="style\\.css\\?v=${version}"`),
      `${page} local css is versioned`
    );
    assert.ok(html.includes('?v=20261103igo'), `${page} keeps shared root assets untouched`);
    assert.ok(
      !/(?:href|src)="(?!\/|https?:)[^"?]*\.(?:css|js)"/.test(html),
      `${page} has an unversioned local asset`
    );
  }
  assert.ok(
    !/\?v=/.test(read('index.html').replace(/(?:href|src)="\/[^"]*"/g, '')),
    'source HTML has no manual local ?v='
  );
  assert.match(sw, /const CORE = \[\];/, 'source sw.js must keep the placeholder');
});
