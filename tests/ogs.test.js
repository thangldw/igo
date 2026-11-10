import test from 'node:test';
import assert from 'node:assert/strict';
import {parseOgsGameId,fetchOgsSgf,ogsSgfUrl} from '../ogs.js';
test('parses game ids from common OGS links and rejects other hosts',()=>{
  for(const s of ['12345','https://online-go.com/game/12345','https://online-go.com/game/view/12345','https://www.online-go.com/api/v1/games/12345/sgf',' https://online-go.com/game/12345/ '])assert.equal(parseOgsGameId(s),'12345',s);
  for(const s of ['','abc','https://evil.example/game/12345','https://online-go.com.evil.example/game/1','https://online-go.com/user/view/9','https://online-go.com/game/12a'])assert.equal(parseOgsGameId(s),null,s);
  assert.equal(ogsSgfUrl('7'),'https://online-go.com/api/v1/games/7/sgf');
});
test('fetchOgsSgf maps HTTP failures and size limits to messages',async()=>{
  const mk=(status,body='')=>async()=>({status,ok:status>=200&&status<300,text:async()=>body});
  assert.equal(await fetchOgsSgf('1',mk(200,'(;FF[4])')),'(;FF[4])');
  await assert.rejects(fetchOgsSgf('1',mk(404)),/Không tìm thấy/);
  await assert.rejects(fetchOgsSgf('1',mk(500)),/500/);
  await assert.rejects(fetchOgsSgf('1',mk(200,'x'.repeat(20)),10),/1 MB/);
});
