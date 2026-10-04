import {parseSgf,replaySgf,validateSgf,trialMove} from './sgf.js';
import {group} from './engine.js';
import {renderTerms} from './terms.js';
renderTerms(document.getElementById('terms'),'SGF, đọc biến, ko, superko, komi, phản bác');
const $=id=>document.getElementById(id),KEY='igo-sgf-review-v1',letters='ABCDEFGHJKLMNOPQRST';
const sample='(;FF[4]GM[1]SZ[19]KM[6.5]RU[Japanese]PB[Đen minh họa]PW[Trắng minh họa]C[Ván tự tạo để học thao tác; không phải ván chuẩn 3 dan.];B[pd];W[dd];B[qp];W[dp];B[fq];W[cn]C[Dừng tại đây. Thử hai hướng phát triển trước khi đọc tiếp.](;B[qo]C[Nhánh minh họa A: gia cố bên phải.];W[fc];B[jq])(;B[cf]C[Nhánh minh họa B: tiếp cận góc trên trái.];W[fd];B[cc]))';
let game=null,source='',filename='',notes={},drafts={},choices=[],frames=[],cursor=0,trials=[],inspected=[],writable=true;
const pointName=p=>p===-1?'bỏ lượt':`${letters[p%game.size]}${game.size-Math.floor(p/game.size)}`;
const base=()=>frames[cursor],current=()=>trials.length?trials.at(-1):base();
const noteKey=()=>JSON.stringify(choices.slice(0,cursor));
function extend(path){let node=game.root;for(const n of path)node=node.children[n];while(node.children.length){path.push(0);node=node.children[0];}return path;}
function open(text,name,savedNotes={}){
  const parsed=validateSgf(parseSgf(text));
  // Commit only after every branch passes replay validation.
  game=parsed;source=text;filename=name;notes=savedNotes;drafts={};choices=extend([]);frames=replaySgf(game,choices);cursor=0;trials=[];inspected=[];
  $('game-title').textContent=`${game.black} · ${game.white}`;
  $('metadata').textContent=`${game.size}×${game.size} · komi ${game.komi??'không khai báo'} · luật ${game.rules} · kết quả ${game.result||'chưa khai báo'} · ${game.nodeCount} nút`;
  $('status').textContent=`Đã mở ${name}. File không được gửi lên máy chủ. Nước đi được kiểm tra về đặt quân và bắt quân; bạn vẫn cần tự đánh giá cách đi.`;render(true);
}
function render(loadNote=false){
  const ready=!!game;for(const id of ['first','prev','next','last','seek','pass','undo','reset','liberties','export'])$(id).disabled=!ready;
  for(const id of ['candidates','refutation','conclusion'])$(id).disabled=!ready;$('note-form').querySelector('button').disabled=!ready;
  $('review-surface').hidden=!ready;if(!ready)return;
  const state=current(),size=game.size;$('board').replaceChildren();$('board').style.setProperty('--size',size);$('board').style.gridTemplateColumns=`repeat(${size},1fr)`;
  for(let i=0;i<size*size;i++){
    const button=document.createElement('button');button.className=[i%size===0?'left':'',i%size===size-1?'right':'',i<size?'top':'',i>=size*(size-1)?'bottom':''].join(' ');
    button.setAttribute('aria-label',`${pointName(i)}: ${state.board[i]===1?'đen':state.board[i]===2?'trắng':'trống'}${inspected.includes(i)?', khí':''}`);
    
    if(state.board[i]){const stone=document.createElement('span');stone.className=`stone ${state.board[i]===1?'black':'white'}${state.last===i?' last':''}`;button.append(stone);}
    if(inspected.includes(i)){const mark=document.createElement('span');mark.className='liberty-mark';button.append(mark);}
    if(Math.floor(i/size)===size-1){const label=document.createElement('span');label.className='grid-label column-label';label.textContent=letters[i%size];button.append(label);}
    if(i%size===0){const label=document.createElement('span');label.className='grid-label row-label';label.textContent=size-Math.floor(i/size);button.append(label);}
    button.onclick=()=>{if($('liberties').checked){if(!state.board[i]){$('liberty-status').textContent='Chọn một nhóm quân để xem khí.';return;}inspected=group(state.board,i,size).liberties;$('liberty-status').textContent=`Nhóm tại ${pointName(i)} có ${inspected.length} khí.`;render();}else play(i);};$('board').append(button);
  }
  $('position').textContent=`Ván gốc: nước ${base().count} · vị trí ${cursor}/${frames.length-1}`;$('turn').textContent=`${state.next===1?'● Đen':'○ Trắng'} đi${trials.length?' · đang thử cách đi khác':''}`;
  $('seek').max=frames.length-1;$('seek').value=cursor;
  $('first').disabled=$('prev').disabled=cursor===0||trials.length>0;$('next').disabled=$('last').disabled=cursor===frames.length-1||trials.length>0;$('seek').disabled=trials.length>0;
  $('undo').disabled=$('reset').disabled=!trials.length;
  $('trial-status').textContent=trials.length?`Biến tự thử: ${trials.map(s=>`${s.next===2?'Đen':'Trắng'} ${pointName(s.last)}`).join(' → ')}. Đây là chuỗi bạn tự thử, chưa biết có thắng trước mọi cách đáp không.`:'Nhấn bàn để thử một biến. Điều hướng ván gốc không thay đổi file.';
  $('comment').textContent=base().comment||'Không có lời bình.';
  $('branches').replaceChildren();const children=base().node.children;
  if(children.length>1){children.forEach((child,i)=>{const b=document.createElement('button');const color=child.props.B?'Đen':child.props.W?'Trắng':'';const val=(child.props.B||child.props.W)?.[0];b.textContent=`Cách tiếp ${i+1}${val!==undefined?`: ${color} ${pointName(val===''||val==='tt'?-1:(val.charCodeAt(1)-97)*size+val.charCodeAt(0)-97)}`:''}`;b.disabled=trials.length>0;b.onclick=()=>{rememberDraft();choices=extend([...choices.slice(0,cursor),i]);frames=replaySgf(game,choices);cursor++;inspected=[];render(true);};$('branches').append(b);});}
  if(loadNote){$('comment-wrap').open=false;const note=drafts[noteKey()]||notes[noteKey()]||{};for(const id of ['candidates','refutation','conclusion'])$(id).value=note[id]||'';$('save-status').textContent='';}
}
function rememberDraft(){if(!game)return;drafts[noteKey()]={};for(const id of ['candidates','refutation','conclusion'])drafts[noteKey()][id]=$(id).value;}
function navigate(n){if(!game||trials.length)return;rememberDraft();cursor=Math.max(0,Math.min(n,frames.length-1));inspected=[];$('liberty-status').textContent='';render(true);}
function play(point){if(!game)return;try{trials.push(trialMove(current(),point,game.size));inspected=[];$('liberty-status').textContent='';render();}catch(e){$('trial-status').textContent=e.message;}}
$('first').onclick=()=>navigate(0);$('prev').onclick=()=>navigate(cursor-1);$('next').onclick=()=>navigate(cursor+1);$('last').onclick=()=>navigate(frames.length-1);$('seek').oninput=()=>navigate(Number($('seek').value));
$('pass').onclick=()=>play(-1);$('undo').onclick=()=>{trials.pop();inspected=[];render();};$('reset').onclick=()=>{trials=[];inspected=[];render();};$('liberties').onchange=()=>{inspected=[];$('liberty-status').textContent='';render();};
$('sample').onclick=()=>{try{open(sample,'Ván minh họa tự tạo');}catch(e){$('status').textContent=e.message;}};
$('file').onchange=async()=>{const file=$('file').files[0];if(!file)return;if(file.size>1000000){$('status').textContent='File vượt 1 MB; ván đang mở được giữ nguyên.';return;}try{open(await file.text(),file.name);}catch(e){$('status').textContent=`Không mở được: ${e.message} Ván đang mở được giữ nguyên.`;}};
$('note-form').onsubmit=e=>{e.preventDefault();if(!game)return;const note={move:base().count,path:choices.slice(0,cursor)};for(const id of ['candidates','refutation','conclusion'])note[id]=$(id).value.trim();notes[noteKey()]=note;
  if(!writable){$('save-status').textContent='Dữ liệu cũ không tương thích; chỉ giữ trong phiên này. Tải bản ghi để lưu.';return;}
  try{localStorage.setItem(KEY,JSON.stringify({version:1,source,filename,notes,choices,cursor}));$('save-status').textContent=`Đã lưu ghi chú ở nước ${base().count} và SGF gốc tại trình duyệt này.`;}catch{$('save-status').textContent='Không lưu được tại trình duyệt. Tải bản ghi để lưu.';}
};
$('export').onclick=()=>{if(!game)return;const sections=[`# Xem ván: ${game.black} · ${game.white}`,'Ghi chú tự đánh giá; không chứng nhận sức chơi.'];for(const note of Object.values(notes)){sections.push(`## Nước ${note.move} · nhánh ${JSON.stringify(note.path)}`,`Các nước cân nhắc: ${note.candidates}`,`Cách đối thủ hóa giải: ${note.refutation}`,`Đối chiếu: ${note.conclusion}`);}sections.push('## SGF gốc','```sgf',source,'```');const url=URL.createObjectURL(new Blob([sections.join('\n\n')],{type:'text/markdown;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='igo-xem-van.md';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
function validNotes(value){return value&&typeof value==='object'&&!Array.isArray(value)&&Object.entries(value).every(([key,n])=>{try{const path=JSON.parse(key);return Array.isArray(path)&&path.every(x=>Number.isInteger(x)&&x>=0)&&n&&Number.isInteger(n.move)&&['candidates','refutation','conclusion'].every(id=>typeof n[id]==='string'&&n[id].length<=2000)&&JSON.stringify(n.path)===key;}catch{return false;}});}
render();
try{const raw=localStorage.getItem(KEY);if(raw){const saved=JSON.parse(raw);if(saved.version!==1||typeof saved.source!=='string'||typeof saved.filename!=='string'||!validNotes(saved.notes))throw Error('Bản lưu không tương thích.');open(saved.source,saved.filename,saved.notes);if(Array.isArray(saved.choices)&&Number.isInteger(saved.cursor)&&saved.cursor>=0&&saved.cursor<=saved.choices.length){const recovered=replaySgf(game,saved.choices);choices=saved.choices;frames=recovered;cursor=saved.cursor;render(true);}$('status').textContent='Đã khôi phục ván và ghi chú đã lưu trên trình duyệt này.';}}catch{writable=false;$('status').textContent='Không đọc được bản lưu cũ; chưa ghi đè. Có thể mở SGF và tải ghi chú cho phiên mới.';}
