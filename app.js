import {empty, group, move, score, bot} from './engine.js';
import {lessons, levels} from './lessons.js';
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
  root.style.minWidth = mode === 'game' && n > 9 ? `${n * 28}px` : '';
  $('play-surface').style.minWidth = mode === 'game' && n > 9 ? `${n * 28 + 48}px` : '';
  root.replaceChildren();
  root.style.gridTemplateColumns = `repeat(${n},1fr)`;
  const liberties = selected >= 0 && board[selected] ? group(board, selected, n).liberties : [];
  for (let i = 0; i < board.length; i++) {
    const button = document.createElement('button');
    button.className = [i % n === 0 ? 'left' : '', i % n === n - 1 ? 'right' : '', i < n ? 'top' : '', i >= n * (n - 1) ? 'bottom' : '', mode === 'lesson' && hinted && targets().includes(i) ? 'hinted' : ''].join(' ');
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
function click(i) {
  if (busy) return;
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
function saveTurn() { snapshots.push({board: [...board], history: [...history], last, captures: [...captures], passes}); }
function apply(result, i, c) {
  board = result.board;
  history.push(board.join(''));
  last = i;
  selected = -1;
  captures[c - 1] += result.captured;
  draw();
}
function reply() {
  busy = true;
  draw();
  const currentEpoch = epoch;
  setTimeout(() => {
    if (currentEpoch !== epoch) return;
    const i = bot(board, n, history, {difficulty: $('bot-level').value});
    if (i === null) {
      passes++;
      message('Máy bỏ lượt vì không tìm thấy nước có ích theo cách đánh giá cơ bản. Bạn có thể đi tiếp hoặc bỏ lượt để kết thúc ván.');
      if (passes >= 2) finish();
    } else {
      apply(move(board, i, 2, n, history), i, 2);
      passes = 0;
    }
    busy = false;
    draw();
  }, 350);
}
function start() {
  epoch++;
  busy = false;
  mode = 'game';
  n = Number($('game-size').value);
  board = empty(n);
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
  $('description').textContent = 'Bạn cầm Đen, máy cầm Trắng. Chọn mức Dễ để tập luật, hoặc Cơ bản để máy ưu tiên bắt và cứu quân. Máy tránh đi thêm vào đất đã bao kín và có thể bỏ lượt; chưa có hạng thi đấu.';
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
}
function finish() {
  ended = true;
  const s = score(board, n);
  message(`Ước tính diện tích: đen ${s.black}, trắng ${s.white} (komi 6,5). ${s.black > s.white ? 'Đen' : 'Trắng'} dẫn ${Math.abs(s.black - s.white)} điểm. Chưa tự nhận diện quân chết hoặc seki; đây không phải kết quả phân xử chính thức.`);
}
$('practice').onclick = start;
$('new-game').onclick = start;
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
  passes++;
  if (passes >= 2) { finish(); draw(); }
  else { message('Bạn bỏ lượt. Máy sẽ đi nếu còn nước hợp lệ.'); reply(); }
};
$('undo').onclick = () => {
  if (busy || !snapshots.length) return;
  epoch++;
  const s = snapshots.pop();
  board = s.board; history = s.history; last = s.last; captures = s.captures; passes = s.passes;
  ended = false; selected = -1;
  message('Đã lùi cả lượt của bạn và máy.');
  draw();
};
$('show-liberties').onchange = () => { if (!$('show-liberties').checked) selected = -1; draw(); };
$('lesson-select').onchange=()=>{load(lessons.findIndex(l=>l.id===$('lesson-select').value));showLesson();};
$('previous').onclick=()=>{if(lesson>0){load(lesson-1);showLesson();}};
const parameters=new URLSearchParams(location.search);const requestedLesson=lessons.findIndex(l=>l.id===parameters.get('lesson'));
$('game-size').value=['9','13','19'].includes(parameters.get('size'))?parameters.get('size'):'9';
if(parameters.get('play')==='1')start();else load(requestedLesson<0?0:requestedLesson);

$('bot-level').onchange=()=>message('Đã đổi mức máy. Mức mới áp dụng từ lượt máy tiếp theo.');

$('game-size').onchange=()=>{$('size-help').textContent=`Đã chọn ${$('game-size').value}×${$('game-size').value} cho ván tiếp theo. Bấm “Ván mới” để bắt đầu; ván hiện tại vẫn giữ nguyên.`;};
