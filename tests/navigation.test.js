import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const nav=f=>readFileSync(new URL(`../${f}`,import.meta.url),'utf8').match(/<nav class="site-nav"[^>]*>(.*?)<\/nav>/)[1];
const links=html=>[...html.matchAll(/<a data-nav="(\w+)" href="([^"]+)"( aria-current="page")?><span class="step-num" aria-hidden="true">(\d)<\/span>([^<]+)<\/a>/g)].map(m=>({key:m[1],href:m[2],current:!!m[3],n:m[4],label:m[5]}));

test('all pages share one four-item navigation, numbered 1-4 in the same order',()=>{
  const expected=[['learn','./index.html','Học cách chơi'],['train','./train.html','Luyện bài tập'],['play','./index.html?play=1','Chơi với máy'],['review','./review.html','Xem lại ván']];
  for(const f of ['index.html','train.html','review.html']){
    const l=links(nav(f));
    assert.deepEqual(l.map(x=>[x.key,x.href,x.label]),expected,f);
    assert.deepEqual(l.map(x=>x.n),['1','2','3','4'],f);
  }
});
test('each page marks exactly its own item as current',()=>{
  const current=f=>links(nav(f)).filter(x=>x.current).map(x=>x.key);
  assert.deepEqual(current('index.html'),['learn']);
  assert.deepEqual(current('train.html'),['train']);
  assert.deepEqual(current('review.html'),['review']);
});

test('support button slot sits in the header between the brand and navigation on every page',()=>{
  for(const f of ['index.html','train.html','review.html']){
    const html=readFileSync(new URL(`../${f}`,import.meta.url),'utf8');
    assert.match(html,/<\/div><div id="supportSlot" class="support-slot"><\/div><nav class="site-nav"/,f);
    assert.equal((html.match(/id="supportSlot"/g)||[]).length,1,f);
  }
});
