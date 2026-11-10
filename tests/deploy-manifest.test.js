import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';

const read=f=>readFileSync(new URL(`../${f}`,import.meta.url),'utf8');
const workflow=read('.github/workflows/pages.yml'),shipped=new Set(workflow.match(/cp (index\.html[^\n]*?) public\//)[1].split(/\s+/));
const sw=read('sw.js');
const pages=['index.html','train.html','review.html'];

function localRefs(file){
  const text=read(file),refs=new Set();
  for(const m of text.matchAll(/(?:href|src)="\.\/([\w.-]+)(?:\?[^"]*)?"/g))refs.add(m[1]);
  for(const m of text.matchAll(/(?:from|import)\s*\(?\s*['"]\.\/([\w.-]+)['"]/g))refs.add(m[1]);
  for(const m of text.matchAll(/new (?:Worker|URL)\(\s*(?:new URL\()?['"]\.\/([\w.-]+)['"]/g))refs.add(m[1]);
  for(const m of text.matchAll(/fetch\(['"]\.\/([\w.-]+)['"]/g))refs.add(m[1]);
  return refs;
}
test('every local file used by the pages is deployed and exists',()=>{
  const queue=[...pages],seen=new Set();
  while(queue.length){
    const f=queue.pop();if(seen.has(f))continue;seen.add(f);
    assert.ok(existsSync(new URL(`../${f}`,import.meta.url)),`${f} referenced but missing`);
    assert.ok(shipped.has(f),`${f} is not in the pages.yml cp list`);
    if(/\.(js|html)$/.test(f))for(const r of localRefs(f))queue.push(r);
  }
});
test('service worker precaches every shipped code/page file',()=>{
  for(const f of shipped){if(/^(sw\.js|register-sw\.js|icon-\d+\.png)$/.test(f))continue;assert.ok(sw.includes(`./${f}`),`${f} missing from sw.js CORE`);}
});
