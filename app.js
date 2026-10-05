import {empty, group, move, score, bot} from './engine.js';
import {lessons, levels} from './lessons.js';
import {areaScore} from './area-score.js';
import {GAME_KEY,REVIEW_GAME_KEY,replayRecord,recordSgf} from './game-record.js';
import {renderTerms} from './terms.js';

const $ = id => document.getElementById(id);
let done = [];
try {
  const stored = JSON.parse(localStorage.getItem('igo-progress') || '[]');
  if (Array.isArray(stored)) done = [...new Set(stored.map(x => Number.isInteger(x) ? `beginner-${x}` : x).filter(x => lessons.some(l => l.id === x)))];
} catch {}
let lesson = 0, level = 'beginner', n = 5, board = [], history = [], snapshots = [];
let last = -1, mode = 'lesson', passes = 0, ended = false, captures = [0, 0];
let selected = -1, hinted = false, busy = false, epoch = 0, solved = false, lineStep = 0, candidates = [];
let gameMoves=[],deadStones=new Set(),pendingPoint=-1,searchWorker=null;
const pointName=i=>`${'ABCDEFGHJKLMNOPQRST'[i%n]}${n-Math.floor(i/n)}`;
function scoreDetails(){const s=areaScore(board,n,[...deadStones]);$('score-detail').textContent=`Đen: ${s.blackStones} quân sống + ${s.blackLand} đất = ${s.black}. Trắng: ${s.whiteStones} quân sống + ${s.whiteLand} đất + 6,5 komi = ${s.white}. Trung lập: ${s.neutral}. Theo dấu quân chết bạn chọn, ${s.black>s.white?'Đen':'Trắng'} hơn ${Math.abs(s.black-s.white)} điểm.`;return s;}
function record(){return {version:1,size:n,difficulty:$('bot-level').value,moves:gameMoves};}
function persist(){if(mode!=='game')return;try{localStorage.setItem(GAME_KEY,JSON.stringify(record()));$('game-save-status').textContent=`Đã lưu tại máy · ${gameMoves.length} nước`; $('resume-game').hidden=false;}catch{$('game-save-status').textContent='Không lưu được. Hãy tải SGF để giữ ván.';}}
function resume(){try{const saved=JSON.parse(localStorage.getItem(GAME_KEY));const state=replayRecord(saved);$('game-size').value=String(saved.size);start(false);gameMoves=saved.moves;board=state.board;history=state.history;last=state.last;captures=state.captures;passes=state.passes;snapshots=state.snapshots;ended=state.ended;$('bot-level').value=['easy','basic','search'].includes(saved.difficulty)?saved.difficulty:'easy';draw();persist();message('Đã tiếp tục ván đã lưu.');if(ended)finish();else if(state.next===2)reply();}catch{if(mode==='lesson')load(0);message('Không đọc được ván lưu. Dữ liệu cũ được giữ nguyên; hãy bắt đầu ván mới.','error');}}
const current = () => lessons[lesson];
const currentLevel = () => levels.find(l => l.id === level);
const levelLessons = () => lessons.filter(l => l.level === level);
function showLesson(){const heading=$('title');heading.tabIndex=-1;heading.focus({preventScroll:true});heading.scrollIntoView({block:'start'});}
const targets = () => current().lines ? [...new Set(candidates.map(line => line[lineStep]))] : [current().target];

function message(text, type = '') {
  $('feedback').textContent = text;
  $('feedback').className = type;
}
function navigation() {
  $('levels').replaceChildren();
  for (const l of levels) {
    const button = document.createElement('button');
    button.textContent = l.name;
    button.setAttribute('aria-pressed', String(l.id === level));
    button.onclick = () => {load(lessons.findIndex(item => item.level === l.id));showLesson();};
    $('levels').append(button);
  }
  $('level-summary').textContent = currentLevel().summary;
  $('lessons').replaceChildren();$('lesson-select').replaceChildren();
  levelLessons().forEach((l, index) => {
    const button = document.createElement('button');
    button.setAttribute('aria-current',mode==='lesson'&&l.id===current().id?'step':'false');
    const option=document.createElement('option');option.value=l.id;option.textContent=`${index+1}. ${l.title}`;$('lesson-select').append(option);
    button.className = mode === 'lesson' && l.id === current().id ? 'active' : '';
    button.innerHTML = `<span class="number">${done.includes(l.id) ? '✓' : String(index + 1).padStart(2, '0')}</span>${l.title}`;
    button.onclick = () => {load(lessons.indexOf(l));showLesson();};
    $('lessons').append(button);
  });
  $('lesson-select').value=current().id;
  const active=$('lessons').querySelector('.active');if(active)$('lessons').scrollLeft=Math.max(0,active.offsetLeft-$('lessons').offsetLeft);
  const completed = levelLessons().filter(l => done.includes(l.id)).length;
  $('progress-text').textContent = `${completed} / ${levelLessons().length}`;
  $('progress-bar').style.width = `${completed / levelLessons().length * 100}%`;
}
function draw() {
  const root = $('board');
  const zoom=Number($('board-zoom').value)/100;
  const large=mode==='game'&&(n>9||zoom>1);const width=Math.max(n*28,document.querySelector('.workspace').clientWidth-48)*zoom;
  root.style.minWidth=large?`${width}px`:'';
  $('play-surface').style.minWidth=large?`${width+48}px`:'';
  root.replaceChildren();
  root.style.gridTemplateColumns = `repeat(${n},1fr)`;
  $('scoring-panel').hidden=$('analysis-panel').hidden=mode!=='game'||!ended;
  const scored=mode==='game'&&ended?scoreDetails():null;
  $('confirm-point').hidden=$('cancel-point').hidden=pendingPoint<0;
  for(const id of ['export-game','review-game','analyze-game','confirm-point'])$(id).disabled=busy;
  const liberties = selected >= 0 && board[selected] ? group(board, selected, n).liberties : [];
  for (let i = 0; i < board.length; i++) {
    const button = document.createElement('button');
    button.className = [i % n === 0 ? 'left' : '', i % n === n - 1 ? 'right' : '', i < n ? 'top' : '', i >= n * (n - 1) ? 'bottom' : '', mode === 'lesson' && hinted && targets().includes(i) ? 'hinted' : ''].join(' ');
    if(mode==='game'){const mid=(n-1)/2,edge=n===9?2:3;const r=Math.floor(i/n),c=i%n;const star=n===19?[edge,mid,n-1-edge].includes(r)&&[edge,mid,n-1-edge].includes(c):((r===edge||r===n-1-edge)&&(c===edge||c===n-1-edge))||(r===mid&&c===mid);if(star){const dot=document.createElement('span');dot.className='star-point';button.append(dot);}if(i===pendingPoint)button.classList.add('pending-point');if(deadStones.has(i))button.classList.add('dead-stone');if(scored&&!board[i]&&scored.owners[i])button.classList.add(scored.owners[i]===1?'black-area':'white-area');}
    button.setAttribute('aria-label', `${'ABCDEFGHJKLMNOPQRST'[i % n]}${n - Math.floor(i / n)}: ${board[i] === 1 ? 'đen' : board[i] === 2 ? 'trắng' : 'trống'}${liberties.includes(i) ? ', khí' : ''}`);
    if (board[i]) {
      const stone = document.createElement('span');
      stone.className = `stone ${board[i] === 1 ? 'black' : 'white'} ${last === i ? 'last' : ''}`;
      button.append(stone);
    } else if (liberties.includes(i)) {
      const dot = document.createElement('span');
      dot.className = 'liberty';
      button.append(dot);
    }
    button.onclick = () => click(i);
    if (i % n === 0) {
      const label = document.createElement('span');
      label.className = 'grid-label row-label';
      label.textContent = n - Math.floor(i / n);
      label.setAttribute('aria-hidden', 'true');
      button.append(label);
    }
    if (i >= n * (n - 1)) {
      const label = document.createElement('span');
      label.className = 'grid-label column-label';
      label.textContent = 'ABCDEFGHJKLMNOPQRST'[i % n];
      label.setAttribute('aria-hidden', 'true');
      button.append(label);
    }
    root.append(button);
  }
  $('turn').textContent = mode === 'lesson' ? current().kind === 'sequence' ? `● Đen đi · Nước ${Math.floor(lineStep / 2) + 1} / ${Math.ceil(current().lines[0].length / 2)}` : '● Bạn đặt quân đen' : ended ? 'Ván đã kết thúc' : busy ? '○ Máy đang đi…' : '● Lượt của bạn';
  if (solved && mode === 'lesson') $('turn').textContent = '✓ Đã hoàn thành bài';
  $('captured').textContent = mode === 'lesson' ? current().kind === 'sequence' ? 'Trắng đáp theo chuỗi mẫu' : 'Bàn học 5 × 5' : `Đã bắt: đen ${captures[0]} · trắng ${captures[1]}`;
}
function complete(text) {
  solved = true;
  if (!done.includes(current().id)) {
    done.push(current().id);
    try { localStorage.setItem('igo-progress', JSON.stringify(done)); } catch {}
  }
  message(text, 'success');
  $('next').hidden = false;
  const next = lessons[lesson + 1];
  $('next').textContent = !next ? 'Luyện với máy →' : next.level !== level ? `Sang ${levels.find(l => l.id === next.level).name.toLowerCase()} →` : 'Bài tiếp theo →';
  navigation();
}
function load(i) {
  searchWorker?.terminate();searchWorker=null;pendingPoint=-1;
  epoch++;
  busy = false;
  mode = 'lesson';
  lesson = i;
  level = current().level;
  n = 5;
  board = empty(n);
  for (const [p, c] of current().setup || []) board[p] = c;
  history = [board.join('')];
  last = selected = -1;
  hinted = solved = false;
  lineStep = 0;
  candidates = current().lines || [];
  const number = levelLessons().indexOf(current()) + 1;
  $('chapter').textContent = `${currentLevel().name.toUpperCase()} · BÀI ${number} / ${levelLessons().length}`;
  $('title').textContent = current().title;
  $('board-size').textContent = '5 × 5';
  $('guide-title').textContent = current().heading;
  $('description').textContent = current().description;
  $('tip').textContent = current().tip;
  renderTerms($('terms'),[current().title,current().description,current().tip].join(' '));
  const url=new URL(location.href);url.searchParams.delete('play');url.searchParams.set('lesson',current().id);window.history.replaceState(null,'',url);
  $('previous').disabled=i===0;$('previous').hidden=false;
  $('game-controls').hidden = true;
  $('size-help').hidden = true;
  document.querySelector('.workflow-help p').textContent='1. Chọn bài bên trái. 2. Đọc yêu cầu. 3. Nhấn bàn cờ hoặc chọn đáp án. Làm xong thì bấm “Bài tiếp theo”.';
  $('next').hidden = true;
  $('hint').hidden = false;
  $('retry').hidden = false;
  $('answers').replaceChildren();
  const conceptual = current().kind === 'quiz' && !current().setup.length;
  $('description').hidden = conceptual;
  $('play-surface').hidden = conceptual;
  $('concept').hidden = !conceptual;
  $('concept').textContent = conceptual ? current().description : '';
  $('board-footer').hidden = conceptual;
  $('board-size').hidden = conceptual;
  if (current().answer !== undefined) {
    const choices = current().choices || [1, 2, 3, 4].map(v => `${v} ${current().kind === 'territory' ? 'điểm' : 'khí'}`);
    choices.forEach((label, index) => {
      const button = document.createElement('button');
      button.textContent = label;
      button.onclick = () => {
        if (solved) return;
        const correct = current().choices ? index === current().answer : index + 1 === current().answer;
        if (correct) complete(current().success || (current().kind === 'territory' ? 'Đúng! Vùng giữa có 1 điểm đất. Quân trên bàn cũng được tính khi đếm diện tích.' : 'Đúng! Quân giữa bàn có 4 khí.'));
        else message('Chưa đúng. Kiểm tra lại khí hoặc điều kiện trong đề.', 'error');
        draw();
      };
      $('answers').append(button);
    });
  }
  message(current().kind === 'sequence' ? 'Nghĩ trước cách Trắng đáp rồi đặt quân Đen. Trong bài này, Trắng đi theo chuỗi mẫu.' : conceptual ? 'Chọn đáp án theo tình huống trong đề.' : 'Thử trực tiếp trên bàn cờ.');
  navigation();
  draw();
}
function click(i,confirmed=false) {
  if (busy) return;
  if(mode==='game'&&ended){if(board[i]){const g=group(board,i,n);const remove=deadStones.has(i);g.stones.forEach(p=>remove?deadStones.delete(p):deadStones.add(p));draw();}return;}
  if(mode==='game'&&!board[i]&&$('confirm-move').checked&&!confirmed){pendingPoint=i;message(`Đã chọn ${pointName(i)}. Bấm “Đặt quân ở điểm đã chọn” để xác nhận.`);draw();return;}
  pendingPoint=-1;
  if (board[i]) {
    selected = mode === 'lesson' || $('show-liberties').checked ? i : -1;
    draw();
    if (mode === 'lesson' && !solved) message(`Nhóm này có ${group(board, i, n).liberties.length} khí.`);
    return;
  }
  if (mode === 'lesson') {
    const l = current();
    if (solved) return;
    if (l.answer !== undefined) { message('Hãy chọn câu trả lời bên dưới.'); return; }
    const result = move(board, i, 1, n, history);
    if (result.error) { message(result.error, 'error'); return; }
    if (l.kind !== 'place' && !targets().includes(i)) {
      message('Nước hợp lệ nhưng chưa thuộc lời giải của bài này. Thử đọc lại mục tiêu hoặc xem gợi ý.', 'error');
      return;
    }
    board = result.board;
    history.push(board.join(''));
    last = i;
    selected = -1;
    hinted = false;
    if (l.kind === 'sequence') {
      candidates = candidates.filter(line => line[lineStep] === i);
      lineStep++;
      if (lineStep === candidates[0].length) { complete(l.success); draw(); return; }
      busy = true;
      draw();
      message('Trắng đang đáp theo biến minh họa…');
      const currentEpoch = epoch;
      setTimeout(() => {
        if (currentEpoch !== epoch) return;
        const replyPoint = candidates[0][lineStep];
        const reply = move(board, replyPoint, 2, n, history);
        busy = false;
        if (reply.error) { message('Biến bài học không hợp lệ. Hãy làm lại bài.', 'error'); return; }
        candidates = candidates.filter(line => line[lineStep] === replyPoint);
        board = reply.board;
        history.push(board.join(''));
        last = replyPoint;
        lineStep++;
        message(reply.captured ? `Trắng vừa bắt ${reply.captured} quân. Tìm nước đen tiếp theo.` : 'Trắng đã đáp. Tìm nước đen tiếp theo.');
        draw();
      }, 400);
      return;
    }
    complete(l.success || (l.kind === 'place' ? 'Bạn vừa đi nước đầu tiên. Tiếp theo, học cách giữ quân sống.' : l.kind === 'save' ? 'Đúng! Nhóm đen đã nối ra ngoài và có 3 khí.' : `Đúng! Bạn đã bắt ${result.captured} quân trắng.`));
    draw();
    return;
  }
  if (ended) return;
  const result = move(board, i, 1, n, history);
  if (result.error) { message(result.error, 'error'); return; }
  saveTurn();
  apply(result, i, 1);
  passes = 0;
  message(result.captured ? `Bạn bắt được ${result.captured} quân trắng.` : 'Quan sát khí của các nhóm trước khi đi tiếp.');
  reply();
}
function saveTurn() { snapshots.push({board: [...board], history: [...history], last, captures: [...captures], passes,moveCount:gameMoves.length}); }
function apply(result, i, c) {
  gameMoves.push({color:c,point:i});
  board = result.board;
  history.push(board.join(''));
  last = i;
  selected = -1;
  captures[c - 1] += result.captured;
  draw();
}
function reply() {
  persist();busy=true;draw();const currentEpoch=epoch;
  const applyReply=i=>{if(currentEpoch!==epoch)return;
    if(i===-1||i===null){gameMoves.push({color:2,point:-1});passes++;message('Máy bỏ lượt vì không tìm thấy nước có ích theo cách đánh giá của máy.');if(passes>=2)finish();}
    else{const result=move(board,i,2,n,history);if(result.error){busy=false;message(result.error,'error');return;}apply(result,i,2);passes=0;}
    busy=false;persist();draw();
  };
  if($('bot-level').value==='search'){
    searchWorker?.terminate();searchWorker=new Worker('./search-worker.js?v=20261005search',{type:'module'});
    searchWorker.onmessage=({data})=>{if(currentEpoch!==epoch)return;searchWorker?.terminate();searchWorker=null;if(data.error){applyReply(bot(board,n,history));message('Engine tìm kiếm lỗi; máy đã dùng mức Cơ bản cho lượt này.');return;}applyReply(data.result.best.point);};
    searchWorker.onerror=()=>{if(currentEpoch!==epoch)return;searchWorker?.terminate();searchWorker=null;applyReply(bot(board,n,history));message('Không tải được engine tìm kiếm; máy đã dùng mức Cơ bản cho lượt này.');};
    searchWorker.postMessage({type:'move',board,size:n,history});
  }else setTimeout(()=>{if(currentEpoch===epoch)applyReply(bot(board,n,history,{difficulty:$('bot-level').value}));},350);
}
function start(save=true) {
  searchWorker?.terminate();searchWorker=null;
  epoch++;
  busy = false;
  mode = 'game';
  n = Number($('game-size').value);
  board = empty(n);
  gameMoves=[];$('analysis-output').textContent='';deadStones.clear();pendingPoint=-1;
  history = [board.join('')];
  snapshots = [];
  last = selected = -1;
  passes = 0;
  ended = false;
  captures = [0, 0];
  hinted = solved = false;
  $('chapter').textContent = `VÁN LUYỆN TẬP · ${n}×${n}`;
  $('title').textContent = `Luyện chơi ${n}×${n}`;
  $('board-size').textContent = `${n} × ${n}`;
  $('board-size').hidden = false;
  $('play-surface').hidden = false;
  $('concept').hidden = true;
  $('board-footer').hidden = false;
  $('guide-title').textContent = 'Bạn cầm đen';
  $('description').textContent = 'Bạn cầm Đen, máy cầm Trắng. Chọn mức Dễ để tập luật, hoặc Cơ bản để máy ưu tiên bắt và cứu quân. Mức Tìm kiếm xét thêm cách đối thủ đáp. Máy có thể bỏ lượt; các mức chưa có hạng thi đấu.';
  const url=new URL(location.href);url.searchParams.delete('lesson');url.searchParams.set('play','1');url.searchParams.set('size',String(n));window.history.replaceState(null,'',url);$('previous').hidden=true;
  $('description').hidden = false;
  $('tip').textContent = 'Khi không còn nước có ích, bỏ lượt. Hai lượt bỏ liên tiếp kết thúc ván. Chơi tiếp để bắt hết quân chết trước khi kết thúc.';
  renderTerms($('terms'),$('description').textContent+' '+$('tip').textContent);
  $('answers').replaceChildren();
  $('game-controls').hidden = false;
  $('size-help').hidden = false;
  $('size-help').textContent = n === 9 ? '9×9: tập luật và bắt quân. Đổi kích thước rồi bấm “Ván mới” để bắt đầu bàn khác.' : `${n}×${n}: ${n === 13 ? 'tập quản lý nhiều nhóm' : 'tập chiến lược toàn bàn'}. Trên màn hình nhỏ, vuốt ngang bàn để xem các cột còn lại. Đổi kích thước chỉ áp dụng khi bấm “Ván mới”. Máy vẫn ở mức luyện cơ bản.`;
  document.querySelector('.workflow-help p').textContent='Chọn mức máy, rồi nhấn giao điểm để đặt quân đen. Máy đáp bằng quân trắng. Khi hết nước có ích, bấm “Bỏ lượt”; hai lượt bỏ liên tiếp kết thúc ván.';
  $('next').hidden = true;
  $('hint').hidden = true;
  $('retry').hidden = true;
  message('Chạm một giao điểm để đi nước đầu.');
  navigation();
  draw();
  if(save)persist();
}
function finish() {
  ended = true;pendingPoint=-1;
  const s = score(board, n);
  message(`Ước tính diện tích: đen ${s.black}, trắng ${s.white} (komi 6,5). ${s.black > s.white ? 'Đen' : 'Trắng'} dẫn ${Math.abs(s.black - s.white)} điểm. Chưa tự nhận diện quân chết hoặc seki; đây không phải kết quả phân xử chính thức.`);
}
$('practice').onclick = () => {if(localStorage.getItem(GAME_KEY))resume();else start();};
$('new-game').onclick = () => start();
$('retry').onclick = () => load(lesson);
$('next').onclick = () => {lesson === lessons.length - 1 ? start() : load(lesson + 1);showLesson();};
$('hint').onclick = () => {
  hinted = true;
  const l = current();
  if (l.kind === 'count') { selected = 12; message('Bốn điểm trống: trên, dưới, trái, phải.'); }
  else if (l.kind === 'territory') message('Vùng trống giữa vòng đen chỉ có một giao điểm.');
  else message(l.hint || (l.target !== undefined ? 'Điểm được tô sáng là khí cần tìm.' : 'Chạm một giao điểm trống bất kỳ.'));
  draw();
};
$('pass').onclick = () => {
  if (busy || ended) return;
  saveTurn();
  gameMoves.push({color:1,point:-1});
  passes++;
  if (passes >= 2) { finish(); persist(); draw(); }
  else { message('Bạn bỏ lượt. Máy sẽ đi nếu còn nước hợp lệ.'); reply(); }
};
$('undo').onclick = () => {
  if (busy || !snapshots.length) return;
  epoch++;
  const s = snapshots.pop();
  board = s.board; history = s.history; last = s.last; captures = s.captures; passes = s.passes;gameMoves=gameMoves.slice(0,s.moveCount);persist();
  ended = false; selected = -1;
  message('Đã lùi cả lượt của bạn và máy.');
  draw();
};
$('show-liberties').onchange = () => { if (!$('show-liberties').checked) selected = -1; draw(); };
$('lesson-select').onchange=()=>{load(lessons.findIndex(l=>l.id===$('lesson-select').value));showLesson();};
$('previous').onclick=()=>{if(lesson>0){load(lesson-1);showLesson();}};
$('confirm-move').checked=window.matchMedia('(max-width:700px)').matches;
function savedSizeMatches(size){try{return String(JSON.parse(localStorage.getItem(GAME_KEY)).size)===size;}catch{return true;}}
const parameters=new URLSearchParams(location.search);const requestedLesson=lessons.findIndex(l=>l.id===parameters.get('lesson'));
$('game-size').value=['9','13','19'].includes(parameters.get('size'))?parameters.get('size'):'9';
if(parameters.get('play')==='1'){if(localStorage.getItem(GAME_KEY)&&(!parameters.has('size')||savedSizeMatches(parameters.get('size'))))resume();else start();}else load(requestedLesson<0?0:requestedLesson);

$('bot-level').onchange=()=>message('Đã đổi mức máy. Mức mới áp dụng từ lượt máy tiếp theo.');

$('game-size').onchange=()=>{$('size-help').textContent=`Đã chọn ${$('game-size').value}×${$('game-size').value} cho ván tiếp theo. Bấm “Ván mới” để bắt đầu; ván hiện tại vẫn giữ nguyên.`;};

$('resume-game').hidden=!localStorage.getItem(GAME_KEY);$('resume-game').onclick=resume;
$('export-game').onclick=()=>{if(busy)return;const url=URL.createObjectURL(new Blob([recordSgf(record())],{type:'application/x-go-sgf;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`igo-${n}x${n}.sgf`;a.click();URL.revokeObjectURL(url);};
$('review-game').onclick=()=>{if(busy){message('Đợi máy đi xong rồi mở ván.');return;}try{localStorage.setItem(REVIEW_GAME_KEY,recordSgf(record()));location.href='./review.html?game=latest';}catch{message('Không chuyển được ván. Hãy tải SGF và mở ở Xem lại ván.','error');}};

$('board-zoom').oninput=draw;
$('confirm-point').onclick=()=>{if(pendingPoint>=0)click(pendingPoint,true);};$('cancel-point').onclick=()=>{pendingPoint=-1;draw();};$('confirm-move').onchange=()=>{pendingPoint=-1;draw();};
$('resume-scoring').onclick=()=>{while(gameMoves.at(-1)?.point===-1)gameMoves.pop();persist();resume();};

$('analyze-game').onclick=()=>{if(busy)return;searchWorker?.terminate();searchWorker=new Worker('./search-worker.js?v=20261005search',{type:'module'});$('analysis-output').textContent='Đang tìm các quyết định cần xem lại…';const activeEpoch=epoch;searchWorker.onmessage=({data})=>{if(activeEpoch!==epoch)return;if(data.progress){$('analysis-output').textContent=`Đang xem nước ${data.progress}/${data.total}…`;return;}searchWorker.terminate();searchWorker=null;if(data.error){$('analysis-output').textContent=data.error;return;}$('analysis-output').textContent=data.findings.length?data.findings.map(f=>`Nước ${f.move}: bạn đi ${f.played===-1?'bỏ lượt':pointName(f.played)}. Cân nhắc ${f.point===-1?'bỏ lượt':pointName(f.point)}; đối thủ có thể đáp ${f.reply===-1?'bỏ lượt':pointName(f.reply)}. Chênh lệch đánh giá: ${f.gap.toFixed(1)} đơn vị nội bộ.`).join('\n'):'Engine chưa tìm được nước thay thế tốt hơn trong các nhánh đã xét.';};searchWorker.onerror=e=>{$('analysis-output').textContent=`Không tải được engine phân tích: ${e.message||'không có chi tiết lỗi'}`;};searchWorker.postMessage({type:'review',record:record()});};
