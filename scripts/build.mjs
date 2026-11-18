// Builds ./public from deploy-files.json, the single list of shipped files.
// The service worker precache list and cache version are generated from it.
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const out = join(root, 'public');
const manifest = JSON.parse(readFileSync(join(root, 'deploy-files.json'), 'utf8'));

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const precache = manifest.files.filter((f) => !manifest.noPrecache.includes(f));
const hash = createHash('sha256');
for (const f of manifest.files) {
  if (f === 'sw.js') continue;
  cpSync(join(root, f), join(out, f));
  hash.update(f).update(readFileSync(join(root, f)));
}
for (const dir of manifest.dirs) {
  cpSync(join(root, dir), join(out, dir), { recursive: true });
  for (const f of readdirSync(join(root, dir))) {
    precache.push(`${dir}/${f}`);
    hash.update(f).update(readFileSync(join(root, dir, f)));
  }
}

const version = `igo-${hash.digest('hex').slice(0, 12)}`;
const sw = readFileSync(join(root, 'sw.js'), 'utf8')
  .replace(/const VERSION = '[^']*';/, `const VERSION = '${version}';`)
  .replace(
    /const CORE = \[[^\]]*\];/,
    `const CORE = ${JSON.stringify(['./', ...precache.map((f) => `./${f}`)])};`
  );
writeFileSync(join(out, 'sw.js'), sw);
writeFileSync(join(out, '.nojekyll'), '');
console.log(`built ${version}: ${precache.length} precached files`);
