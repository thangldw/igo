import {empty,group,move} from './engine.js';
import {trueEyes} from './reading.js';
import {stages,buildBank} from './curriculum.js';
import {renderTerms} from './terms.js';
import {restoreStudy,beginAttempt,recordMiss,recordSolve,needsReview,studyStats,reveal,eligibleClean,problemStatus,topicStats,dailyPlan,streakDays,weekDots} from './study-state.js';
import {transformPuzzle,variantFor} from './symmetry.js';
import {exportBackup,parseBackup} from './backup.js';

const $=id=>document.getElementById(id), letters='ABCDEFGHJKLMNOPQRST', KEY='igo-study-v1';
let bank=[],study,stage='foundation',topic='all',mode='practice',queue=[],index=0,puzzle;
let board=[],history=[],remaining=0,last=-1,selected=-1,hinted=-2,busy=false,finished=false,wrong=0,assisted=false,attemptStarted=false;
let epoch=0,worker=null,requestId=0,pending=new Map(),testResults=[],autoPlay=false,storageAvailable=true,storageWritable=true;
let trace=[],viewStep=-1,hintLevel=0,startedAt=0;
const statusMark={new:'',solved:' · ✓',retained:' · ★',due:' · ↻'};
const stageLabels={foundation:'Nền tảng',tactics:'Nối, cắt và bắt quân',reading:'Sống/chết và đọc trước',strategy:'Kế hoạch và cuối ván',dan:'Đọc sâu',dan2:'Tính điểm và tranh ko',dan3:'Quyết định trên cả bàn'};
function showPuzzle(){const heading=$('test-result').hidden?$('title'):$('test-result');heading.tabIndex=-1;heading.focus({preventScroll:true});heading.scrollIntoView({block:'start'});}
const stageInfo=()=>stages.find(s=>s.id===stage);
const coordinate=(point,size)=>point===-1?'bỏ lượt':`${letters[point%size]}${size-Math.floor(point/size)}`;
function feedback(text,type=''){$('feedback').textContent=text;$('feedback').className=type;}
function save(){if(storageWritable){try{localStorage.setItem(KEY,JSON.stringify(study));}catch{storageAvailable=false;}}$('storage-status').textContent=!storageWritable?'Tiến độ cũ không tương thích; chưa ghi đè. Phiên này chỉ lưu trong bộ nhớ.':storageAvailable?'Tiến độ lưu trên trình duyệt này.':'Không lưu được tiến độ tại máy. Giữ tab mở để tiếp tục phiên này.';}
function shuffle(items){const out=[...items];for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}
function renderProgress(){
  $('stages').replaceChildren();$('stage-select').replaceChildren();
  for(const s of stages){
    const stats=studyStats(bank.filter(p=>p.stage===s.id),study),button=document.createElement('button');
    button.className=s.id===stage?'active':'';button.setAttribute('aria-current',s.id===stage?'step':'false');
    const rank=document.createElement('span');rank.textContent=s.name;
    const option=document.createElement('option');option.value=s.id;option.textContent=`${stages.indexOf(s)+1}. ${stageLabels[s.id]} · ${s.name}`;$('stage-select').append(option);
    const name=document.createElement('strong');name.textContent=`${stages.indexOf(s)+1}. ${stageLabels[s.id]}`;
    const count=document.createElement('span');count.textContent=`${stats.clean}/${stats.total} tự giải · ${stats.due} cần ôn`;
    button.append(name,rank,count);button.onclick=()=>{stage=s.id;topic='all';rebuild();showPuzzle();};$('stages').append(button);
  }
  $('stage-select').value=stage;
  const active=$('stages').querySelector('.active');if(active)$('stages').scrollLeft=Math.max(0,active.offsetLeft-$('stages').offsetLeft);
  const total=studyStats(bank,study);
  $('total').replaceChildren();
  for(const text of [`${total.solved}/${total.total} đã giải`,`${total.clean} tự giải`,`${total.retained} nhớ qua nhiều ngày`]){const s=document.createElement('span');s.textContent=text;$('total').append(s);}
  renderTopics();
  $('stage-practice').textContent=stageInfo().practice;
  $('stage-focus').textContent=stageInfo().focus;
}
function rebuild(preferred){
  const stageBank=bank.filter(p=>p.stage===stage);
  $('topic').replaceChildren();
  for(const name of ['all',...new Set(stageBank.map(p=>p.topic))]){const o=document.createElement('option');o.value=name;o.textContent=name==='all'?'Tất cả chủ đề':name;$('topic').append(o);}
  if(![...$('topic').options].some(o=>o.value===topic))topic='all';
  $('topic').value=topic;$('topic').disabled=mode==='test'||mode==='today';
  const candidates=stageBank.filter(p=>topic==='all'||p.topic===topic);
  queue=mode==='today'?dailyPlan(bank,study,Date.now(),stages.map(x=>x.id)).items:mode==='review'?candidates.filter(p=>needsReview(study.records[p.id])):mode==='test'?shuffle(stageBank).slice(0,10):candidates;
  testResults=[];
  index=preferred?Math.max(0,queue.findIndex(p=>p.id===preferred)):0;
  $('problem-select').replaceChildren();
  queue.forEach((p,i)=>{const o=document.createElement('option');o.value=String(i);o.textContent=`${i+1}. ${p.title}${statusMark[problemStatus(study.records[p.id])]}`;$('problem-select').append(o);});
  $('problem-select').disabled=mode==='test'||!queue.length;
  for(const m of ['today','practice','review','test'])$(`mode-${m}`).setAttribute('aria-pressed',String(mode===m));
  renderProgress();renderToday();load();
}
function renderToday(){
  const card=$('today');card.hidden=mode!=='today';if(card.hidden)return;
  const plan=dailyPlan(bank,study,Date.now(),stages.map(x=>x.id)),streak=streakDays(study),fresh=plan.items.length-plan.due;
  const title=document.createElement('h2'),line=document.createElement('p'),dots=document.createElement('div');
  title.textContent=`Hôm nay · ${Math.min(plan.done,plan.goal)}/${plan.goal} bài`;
  line.textContent=plan.items.length?`${plan.due} bài cần ôn, ${fresh} bài mới. Chuỗi ${streak} ngày liên tiếp.`:'Đã hết bài trong kế hoạch. Chọn “Làm bài mới” hoặc “Ôn bài cần nhớ” để luyện thêm.';
  dots.className='week-dots';dots.setAttribute('aria-label','7 ngày gần nhất');
  for(const d of weekDots(study)){const i=document.createElement('i');i.className=`${d.on?'on':''} ${d.today?'today':''}`;i.title=d.day;dots.append(i);}
  card.replaceChildren(title,line,dots);
}
if(matchMedia('(max-width:700px)').matches)$('topic-panel').open=false;
function renderTopics(){
  const box=$('topic-stats');box.replaceChildren();
  const stats=topicStats(bank,study).filter(t=>t.attempted>0);
  if(!stats.length){const p=document.createElement('p');p.textContent='Chưa có dữ liệu. Làm vài bài để xem chủ đề nào cần luyện.';box.append(p);return;}
  for(const t of stats){
    const row=document.createElement('button');row.type='button';row.className=`topic-row${t.weak?' weak':''}`;
    const head=document.createElement('span'),name=document.createElement('b'),num=document.createElement('small');
    name.textContent=t.topic;num.textContent=`${t.clean}/${t.total}${t.due?` · ${t.due} cần ôn`:''}`;head.append(name,num);
    const bar=document.createElement('span'),fill=document.createElement('i');bar.className='topic-bar';fill.style.width=`${Math.round(100*t.clean/t.total)}%`;bar.append(fill);
    row.append(head,bar);
    row.onclick=()=>{
      const pool=bank.filter(p=>p.topic===t.topic).sort((a,b)=>Number(needsReview(study.records[b.id]))-Number(needsReview(study.records[a.id]))||stages.findIndex(x=>x.id===a.stage)-stages.findIndex(x=>x.id===b.stage));
      const first=pool.find(p=>needsReview(study.records[p.id])||!study.records[p.id]?.clean)||pool[0];
      mode='practice';stage=first.stage;topic=t.topic;rebuild(first.id);showPuzzle();
    };
    box.append(row);
  }
}
function resetWorker(){
  worker?.terminate();worker=null;
  for(const resolve of pending.values())resolve({status:'cancelled'});pending.clear();
}
function ask(action,point){
  if(!worker){
    worker=new Worker(new URL('./reading-worker.js',import.meta.url),{type:'module'});
    worker.onmessage=({data})=>{const resolve=pending.get(data.id);if(resolve){pending.delete(data.id);resolve(data);}};
    worker.onerror=()=>{for(const resolve of pending.values())resolve({status:'unknown'});pending.clear();worker?.terminate();worker=null;};
  }
  return new Promise(resolve=>{const id=++requestId;pending.set(id,resolve);worker.postMessage({id,action,point,board,size:puzzle.size,target:puzzle.target,remaining,history,goal:puzzle.goal||'capture'});});
}
function load(){
  epoch++;resetWorker();busy=finished=assisted=attemptStarted=autoPlay=false;wrong=0;last=selected=-1;hinted=-2;
  $('inspect').checked=false;$('inspect').disabled=mode==='test';
  $('test-result').hidden=true;$('explanation-wrap').hidden=true;
  $('answers').replaceChildren();$('variation').hidden=true;$('concept').hidden=true;$('play-surface').hidden=false;
  $('hint').disabled=mode==='test';$('solution').disabled=mode==='test';$('retry').disabled=mode==='test';
  $('reading-controls').hidden=false;
  $('previous').disabled=mode==='test'||index===0;
  $('mode-help').textContent=mode==='today'?'Kế hoạch hôm nay: bài đến hạn ôn trước, rồi bài mới theo thứ tự lộ trình. Không cần chọn chặng.':mode==='practice'?'Chọn chặng luyện, rồi chọn chủ đề và bài. Bài sai sẽ được đưa vào “Ôn bài cần nhớ”.':mode==='review'?'Chỉ hiện bài sai hoặc bài đã tới lịch ôn của chặng đang chọn. Chưa có bài thì đổi chặng hoặc chọn “Làm bài mới”.':'10 bài ngẫu nhiên trong chặng đang chọn. Chấm lần thử đầu; không có gợi ý, xem khí hay giải thích thuật ngữ.';
  if(!queue.length){
    renderTerms($('terms'),'');puzzle=null;$('title').textContent=mode==='review'?'Chưa có bài cần ôn ở mốc này':mode==='today'?'Hôm nay đã xong kế hoạch':'Chưa có bài theo bộ lọc';
    $('chapter').textContent=stageInfo().name;$('objective').textContent='';$('play-surface').hidden=true;
    $('board-size').hidden=true;$('concept').hidden=false;$('concept').textContent='Chọn “Làm bài mới” để tiếp tục, hoặc đổi chặng luyện. Bài sai sẽ vào hàng ôn ngay; bài tự giải được nhắc lại từ ngày mai.';
    $('guide-title').textContent='Ôn theo tiến độ';$('tip').textContent='Không cần làm lại mọi bài mỗi ngày. Ưu tiên bài sai và bài đến hạn.';
    $('turn').textContent='';$('depth').textContent='';$('reading-controls').hidden=true;
    for(const id of ['hint','solution','retry','next'])$(id).disabled=true;
    feedback('');$('attempt-status').textContent='';return;
  }
  const canonical=queue[index];hintLevel=0;startedAt=Date.now();
  puzzle=mode==='test'?canonical:transformPuzzle(canonical,variantFor(study.records[canonical.id]?.attempts||0));
  $('problem-select').value=String(index);
  board=empty(puzzle.size||5);for(const [p,c] of puzzle.setup)board[p]=c;
  trace=[{board:[...board],point:-1,color:0}];viewStep=-1;
  history=[board.join('')];remaining=puzzle.depth||0;
  $('chapter').textContent=`${stages.find(x=>x.id===puzzle.stage).name.toUpperCase()} · ${mode==='test'?'KIỂM TRA':mode==='review'?'ÔN TẬP':mode==='today'?'HÔM NAY':'BÀI TẬP'} ${index+1}/${queue.length}${puzzle.symmetry?' · GÓC NHÌN KHÁC':''}`;
  $('title').textContent=puzzle.title;$('guide-title').textContent=puzzle.topic;
  $('objective').textContent=puzzle.kind==='reading'?puzzle.prompt:'';
  $('board-size').hidden=!puzzle.size;$('board-size').textContent=`${puzzle.size} × ${puzzle.size}`;
  $('proof-label').textContent=puzzle.kind==='reading'?'NGHĨ CẢ NƯỚC ĐỐI THỦ':'DÙNG CÁC ĐIỀU KIỆN TRONG ĐỀ';
  $('tip').textContent=puzzle.kind==='reading'?puzzle.goal==='eyes'?'Tìm cách chia khoảng trống thành hai mắt thật cho nhóm có dấu tam giác. Các quân bảo vệ hai mắt phải thuộc cùng nhóm. App kiểm tra các cách Trắng đáp.':'Bắt nhóm có dấu tam giác trước khi hết lượt. App kiểm tra các cách Trắng đáp; bạn có thể dùng bất kỳ nước nào vẫn bảo đảm đạt mục tiêu.':'Chỉ dùng các điều kiện trong đề để chọn đáp án. Nếu có hình bàn 19×19, đó là hình minh họa cho tình huống, không phải lời giải đã được AI kiểm tra.';
  $('explanation').textContent=puzzle.explanation;
  renderTerms($('terms'),[stageInfo().name,puzzle.title,puzzle.prompt,puzzle.choices?.join(' ')||''].join(' '),{disabled:mode==='test'});
  const url=new URL(location.href);url.searchParams.set('stage',stage);url.searchParams.set('problem',puzzle.id);window.history.replaceState(null,'',url);
  if(puzzle.kind==='quiz'){
    $('reading-controls').hidden=true;$('hint').disabled=true;
    if(!puzzle.size){$('play-surface').hidden=true;$('concept').hidden=false;$('concept').textContent=puzzle.prompt;}
    else $('objective').textContent=puzzle.prompt;
    shuffle(puzzle.choices.map((text,i)=>({text,i}))).forEach(({text,i})=>{
      const button=document.createElement('button');button.textContent=text;button.onclick=()=>answer(i,button);$('answers').append(button);
    });
  }
  $('next').disabled=mode==='test';$('next').classList.toggle('primary',false);
  feedback(mode==='test'?'Lần thử đầu quyết định điểm. Gợi ý đã tắt.':'Đọc trước khi đi. Gợi ý hoặc xem khí sẽ được ghi là có hỗ trợ.');
  draw();
}
function draw(){
  if(!puzzle)return;
  const size=puzzle.size||5,root=$('board');root.replaceChildren();root.style.gridTemplateColumns=`repeat(${size},1fr)`;
  const shown=viewStep>=0?trace[viewStep].board:board,shownLast=viewStep>=0?trace[viewStep].point:last;
  const eyes=puzzle.goal==='eyes'&&finished?trueEyes(shown,size,puzzle.target):[];
  const liberties=viewStep<0&&selected>=0&&board[selected]?group(board,selected,size).liberties:[];
  for(let i=0;i<board.length;i++){
    const button=document.createElement('button');
    button.className=[i%size===0?'left':'',i%size===size-1?'right':'',i<size?'top':'',i>=size*(size-1)?'bottom':'',viewStep<0&&i===hinted?'hinted':''].join(' ');
    button.setAttribute('aria-label',`${coordinate(i,size)}: ${shown[i]===1?'đen':shown[i]===2?'trắng':'trống'}${puzzle.kind==='reading'&&i===puzzle.target?', mục tiêu':''}${liberties.includes(i)?', khí':''}${eyes.includes(i)?', mắt thật':''}`);
    if(shown[i]){
      const stone=document.createElement('span');stone.className=`stone ${shown[i]===1?'black':'white'} ${shownLast===i?'last':''}`;
      if(puzzle.kind==='reading'&&i===puzzle.target&&shown[i]===(puzzle.goal==='eyes'?1:2)){const mark=document.createElement('span');mark.className='target-marker';stone.append(mark);}
      button.append(stone);
    }else if(eyes.includes(i)){const dot=document.createElement('span');dot.className='eye-marker';button.append(dot);}
    else if(liberties.includes(i)){const dot=document.createElement('span');dot.className='liberty';button.append(dot);}
    if(i%size===0||i>=size*(size-1)){
      if(i%size===0){const label=document.createElement('span');label.className='grid-label row-label';label.textContent=size-Math.floor(i/size);label.setAttribute('aria-hidden','true');button.append(label);}
      if(i>=size*(size-1)){const label=document.createElement('span');label.className='grid-label column-label';label.textContent=letters[i%size];label.setAttribute('aria-hidden','true');button.append(label);}
    }
    button.onclick=()=>selectPoint(i);root.append(button);
  }
  renderTrace();
  $('turn').textContent=viewStep>=0?`Xem lại lượt ${viewStep} · không đặt quân ở thế này`:finished?(mode==='test'&&wrong?'× Bài chưa đúng':'✓ Bài đã kết thúc'):busy?'Đang kiểm tra các cách đáp…':puzzle.kind==='reading'?'● Đen đi':'Chọn câu trả lời bên dưới';
  $('depth').textContent=puzzle.kind==='reading'?`Còn ${Math.max(viewStep>=0?puzzle.depth-viewStep:remaining,0)} lượt cả hai bên`:puzzle.size?'Sơ đồ minh họa':'';
  $('puzzle-pass').disabled=busy||finished;
  $('hint').textContent=puzzle.kind==='reading'&&hintLevel?`Gợi ý ${Math.min(hintLevel+1,3)}/3`:'Gợi ý';
  $('attempt-status').textContent=`${wrong?`${wrong} lần sai · `:''}${assisted?'Đã dùng hỗ trợ':mode==='test'?'Kiểm tra không gợi ý':'Chưa dùng hỗ trợ'}`;
}
function startAttempt(){if(!attemptStarted){beginAttempt(study,puzzle.id);attemptStarted=true;save();}}
function markAssisted(){startAttempt();assisted=true;reveal(study,puzzle.id);save();}
function fail(text){
  startAttempt();wrong++;
  if(wrong===1)recordMiss(study,puzzle.id);
  reveal(study,puzzle.id);save();renderProgress();feedback(text,'error');
  if(mode==='test'){
    finished=true;testResults.push({id:puzzle.id,correct:false,ms:Date.now()-startedAt});$('next').disabled=false;$('next').classList.add('primary');
    $('explanation-wrap').hidden=false;for(const b of $('answers').children)b.disabled=true;
    $('solution').disabled=true;
  }
  draw();
}
function success(){
  finished=true;
  const clean=wrong===0&&!assisted&&eligibleClean(study,puzzle.id);
  recordSolve(study,puzzle.id,clean);
  // Revealing the explanation prevents immediate replay from counting as fresh recall.
  reveal(study,puzzle.id);save();renderProgress();
  if(mode==='test')testResults.push({id:puzzle.id,correct:wrong===0&&!assisted,ms:Date.now()-startedAt});
  $('next').disabled=false;$('next').classList.add('primary');$('explanation-wrap').hidden=false;
  for(const button of $('answers').children)button.disabled=true;
  feedback(clean?'Đúng, tự giải ở lần thử đầu. Bài sẽ được nhắc lại từ ngày mai.':'Đã giải. Bài này cần được thử lại ở một ngày khác không gợi ý để ghi nhận nhớ bài.','success');
  draw();
}
function answer(choice,button){
  if(finished||busy)return;startAttempt();
  if(choice===puzzle.answer){button.className='correct';success();}
  else{button.className='incorrect';button.disabled=true;fail('Chưa đúng. Đọc lại điều kiện trong đề. '+(mode==='test'?puzzle.explanation:''));}
}
async function selectPoint(point){
  if(!puzzle||busy||finished)return;
  if(viewStep>=0){feedback('Đang xem lại chuỗi. Chọn “Trở lại thế hiện tại” để tiếp tục.');return;}
  if(board[point]){
    if(puzzle.kind==='reading'&&$('inspect').checked){selected=point;markAssisted();draw();feedback(`Nhóm tại ${coordinate(point,puzzle.size)} có ${group(board,point,puzzle.size).liberties.length} khí.`);}
    return;
  }
  if(puzzle.kind==='quiz')return;
  await play(point);
}
async function play(point){
  if(!puzzle||puzzle.kind!=='reading'||busy||finished||viewStep>=0)return;
  startAttempt();busy=true;const currentEpoch=epoch;draw();
  const result=await ask('check',point);
  if(currentEpoch!==epoch)return;busy=false;hinted=-2;selected=-1;
  if(result.status==='unknown'){
    feedback('Bộ đọc vượt giới hạn tính toán hoặc chưa tải được. Nước này chưa được chấm; thử nước khác hoặc tải lại trang.');autoPlay=false;draw();return;
  }
  if(result.status==='invalid'){autoPlay=false;fail(result.message);return;}
  if(result.status==='wrong'){
    autoPlay=false;
    if(point===-1){fail('Bỏ lượt chưa đạt mục tiêu: trắng có thể bỏ lượt để kết thúc bàn mà nhóm mục tiêu chưa được xử lý. Hãy tìm một nước đặt quân.');return;}
    const response=result.counter===undefined?'':` Trắng có thể ngăn bạn đạt mục tiêu bằng nước ${coordinate(result.counter,puzzle.size)}; xem trên bàn, rồi chọn “Trở lại thế hiện tại”.`;
    if(result.counter!==undefined){
      const a=move(board,point,1,puzzle.size,history);
      if(!a.error){const b=move(a.board,result.counter,2,puzzle.size,[...history,a.board.join('')]);
        if(!b.error){trace.push({board:[...a.board],point,color:1,refute:true},{board:[...b.board],point:result.counter,color:2,refute:true});viewStep=trace.length-1;}}
    }
    fail(`Nước này không buộc ${puzzle.goal==='eyes'?'tạo hai mắt':'bắt được nhóm'} trong số lượt còn lại.${response} Hãy thử hướng khác.`);return;
  }
  if(result.status==='cancelled')return;
  trace.push({board:[...result.playerBoard],point,color:1});
  if(result.status==='continue')trace.push({board:[...result.board],point:result.reply,color:2});
  board=result.board;history=result.history;remaining=result.remaining;last=result.status==='continue'?result.reply:point;
  if(result.status==='solved'){autoPlay=false;success();return;}
  feedback(`Trắng ${coordinate(result.reply,puzzle.size)}${result.whiteCaptured?`, bắt ${result.whiteCaptured} quân đen`:''}. Đọc nước đen tiếp theo.`);
  draw();if(autoPlay)await getHint(true);
}
async function getHint(playIt=false){
  if(!puzzle||puzzle.kind!=='reading'||busy||finished||mode==='test'||viewStep>=0)return;
  markAssisted();
  if(!playIt&&hintLevel===0){
    hintLevel=1;selected=puzzle.target;const libs=group(board,puzzle.target,puzzle.size).liberties.length;
    feedback(`Gợi ý 1/3: nhóm có dấu tam giác còn ${libs} khí (chấm trên bàn). Thử tìm nước liên quan tới các khí này.`);draw();return;
  }
  busy=true;const currentEpoch=epoch;draw();
  const result=await ask('hint');
  if(currentEpoch!==epoch)return;busy=false;
  if(result.status!=='hint'){autoPlay=false;feedback('Chưa tính được gợi ý trong giới hạn. Bạn có thể thử lại bài.');draw();return;}
  if(!playIt&&hintLevel===1){hintLevel=2;feedback(`Gợi ý 2/3: nước đúng nằm ở hàng ${puzzle.size-Math.floor(result.point/puzzle.size)}.`);draw();return;}
  hintLevel=3;hinted=result.point;feedback(`Gợi ý 3/3: một nước giữ khả năng đạt mục tiêu là ${coordinate(result.point,puzzle.size)}.`);draw();
  if(playIt)await play(result.point);
}
function next(){
  if(mode==='test'&&!finished)return;
  if(index+1<queue.length){index++;load();return;}
  if(mode==='test'){
    const correct=testResults.filter(r=>r.correct).length;
    $('test-result').hidden=false;$('test-result').textContent=`Kết quả: ${correct}/${queue.length} bài đúng ở lần thử đầu. ${correct>=8?'Bạn có thể chuyển chặng luyện hoặc kiểm tra lại bằng bộ ngẫu nhiên.':'Ưu tiên ôn các bài sai trước khi kiểm tra lại.'} Thời gian trung bình ${Math.round(testResults.reduce((t,r)=>t+r.ms,0)/Math.max(testResults.length,1)/1000)} giây/bài. Đây là điểm bài tập, không xác nhận đẳng.`;
    $('next').disabled=true;feedback('Phiên kiểm tra đã kết thúc. Chọn một chế độ để bắt đầu phiên khác.');return;
  }
  if(mode==='review'||mode==='today'){rebuild();return;}
  const nextStage=stages[stages.findIndex(s=>s.id===stage)+1];
  if(nextStage){stage=nextStage.id;topic='all';rebuild();}else{index=0;load();}
}
function renderTrace(){
  $('variation').hidden=puzzle.kind!=='reading'||trace.length<2;
  $('move-list').replaceChildren();
  if($('variation').hidden)return;
  trace.forEach((item,i)=>{const button=document.createElement('button');button.textContent=i===0?'Thế đầu':item.refute?`${item.color===1?'✗ Đen':'Trắng (phản bác)'} ${coordinate(item.point,puzzle.size)}`:`${i}. ${item.color===1?'Đen':'Trắng'} ${coordinate(item.point,puzzle.size)}`;button.setAttribute('aria-pressed',String(viewStep===i));button.onclick=()=>{viewStep=i;autoPlay=false;draw();};$('move-list').append(button);});
}
$('live-position').onclick=()=>{trace=trace.filter(t=>!t.refute);viewStep=-1;draw();};
function journal(){
  $('game-list').replaceChildren();
  for(const game of [...study.games].reverse().slice(0,10)){
    const item=document.createElement('div');item.className='game-item';
    const date=document.createElement('small');date.textContent=game.date;
    const note=document.createElement('p');note.textContent=game.note;item.append(date,note);
    try{const url=new URL(game.url);if(['http:','https:'].includes(url.protocol)){const link=document.createElement('a');link.href=url.href;link.textContent='Xem ván ↗';link.target='_blank';link.rel='noopener';item.append(link);}}catch{}
    $('game-list').append(item);
  }
}
for(const m of ['today','practice','review','test'])$(`mode-${m}`).onclick=()=>{mode=m;rebuild();};
$('stage-select').onchange=()=>{stage=$('stage-select').value;topic='all';rebuild();showPuzzle();};
$('previous').onclick=()=>{if(mode!=='test'&&index>0){index--;load();showPuzzle();}};
$('topic').onchange=()=>{topic=$('topic').value;rebuild();};
$('problem-select').onchange=()=>{index=Number($('problem-select').value);load();showPuzzle();};
$('next').onclick=()=>{next();showPuzzle();};$('retry').onclick=load;$('hint').onclick=()=>getHint();
$('solution').onclick=()=>{
  if(!puzzle||busy||finished||mode==='test')return;
  if(viewStep>=0){feedback('Chọn “Trở lại thế hiện tại” trước khi xem lời giải.');return;}
  markAssisted();
  if(puzzle.kind==='quiz'){$('explanation-wrap').hidden=false;feedback(`Đáp án: ${puzzle.choices[puzzle.answer]}. ${puzzle.explanation}`);draw();}
  else{autoPlay=true;getHint(true);}
};
$('puzzle-pass').onclick=()=>play(-1);
$('inspect').onchange=()=>{if($('inspect').checked)markAssisted();else selected=-1;draw();};
const EXTRA_KEYS=['igo-progress','igo-current-lesson-v1'];
$('backup-export').onclick=()=>{
  const extras={};for(const k of EXTRA_KEYS){try{const v=localStorage.getItem(k);if(v)extras[k]=v;}catch{}}
  const url=URL.createObjectURL(new Blob([exportBackup(study,extras)],{type:'application/json'})),a=document.createElement('a');
  a.href=url;a.download=`igo-backup-${new Date().toLocaleDateString('sv-SE')}.json`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  $('backup-status').textContent='Đã xuất file sao lưu.';
};
$('backup-import').onchange=async()=>{
  const file=$('backup-import').files[0];$('backup-import').value='';if(!file)return;
  if(file.size>2e6){$('backup-status').textContent='File quá lớn để là bản sao lưu Igo.';return;}
  const result=parseBackup(await file.text(),bank.map(p=>p.id));
  if(!result.ok){$('backup-status').textContent=result.error;return;}
  try{localStorage.setItem('igo-study-v1-before-import',JSON.stringify(study));for(const [k,v] of Object.entries(result.extras))localStorage.setItem(k,v);}catch{}
  study=result.study;storageWritable=true;storageAvailable=true;save();rebuild();
  $('backup-status').textContent=`Đã nhập ${result.restored} bài${result.skipped?`, bỏ qua ${result.skipped} bài không còn trong ngân hàng`:''}. Tiến độ cũ được giữ ở khóa igo-study-v1-before-import.`;
};
$('game-form').onsubmit=event=>{
  event.preventDefault();const note=$('game-note').value.trim();if(!note)return;
  const url=$('game-url').value.trim();if(url){try{if(!['http:','https:'].includes(new URL(url).protocol))throw Error();}catch{$('journal-status').textContent='Dùng link http hoặc https.';return;}}
  study.games.push({date:new Date().toLocaleDateString('sv-SE'),url,note,stage});study.games=study.games.slice(-100);save();journal();$('game-form').reset();$('journal-status').textContent=storageAvailable?'Đã lưu lỗi của ván tại máy.':'Đã giữ trong phiên này, chưa lưu được tại máy.';
};
try{
  const response=await fetch('./reading-bank.json');if(!response.ok)throw Error('BANK');
  bank=buildBank(await response.json());let stored=null;try{stored=localStorage.getItem(KEY);}catch{storageAvailable=false;}
  if(stored){try{const parsed=JSON.parse(stored);if(parsed?.version!==1||!parsed.records||typeof parsed.records!=='object'||Array.isArray(parsed.records))storageWritable=storageAvailable=false;}catch{storageWritable=storageAvailable=false;}}
  study=restoreStudy(stored,bank.map(p=>p.id));
  const params=new URLSearchParams(location.search);if(stages.some(s=>s.id===params.get('stage')))stage=params.get('stage');
  const requested=bank.find(p=>p.id===params.get('problem'));if(requested)stage=requested.stage;else if(!params.get('stage'))mode='today';
  rebuild(requested?.id);journal();save();
}catch(error){$('title').textContent='Chưa tải được ngân hàng bài';feedback('Kiểm tra kết nối rồi tải lại trang. Tiến độ cũ được giữ nguyên.','error');}
