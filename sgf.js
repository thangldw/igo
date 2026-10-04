import {empty,move,group} from './engine.js';
const MAX_TEXT=1000000,MAX_NODES=10000,MAX_DEPTH=128;
export function parseSgf(text) {
  if(typeof text!=='string'||text.length>MAX_TEXT)throw Error('SGF phải là văn bản tối đa 1 MB.');
  text=text.replace(/^\uFEFF/,'');let i=0,nodes=0;
  const skip=()=>{while(/\s/.test(text[i]||'')&&i<text.length)i++;};
  const expect=c=>{skip();if(text[i++]!==c)throw Error(`SGF sai cú pháp gần ký tự ${i}.`);};
  function value(){
    expect('[');let out='';
    while(i<text.length){const c=text[i++];if(c===']')return out;
      if(c==='\\'){if(i>=text.length)break;const next=text[i++];if(next==='\r'){if(text[i]==='\n')i++;}else if(next!=='\n')out+=next;}
      else out+=c;
    }throw Error('SGF thiếu dấu đóng giá trị ].');
  }
  function tree(depth){
    if(depth>MAX_DEPTH)throw Error('SGF có quá nhiều tầng biến.');expect('(');let first=null,last=null;skip();
    while(text[i]===';'){
      i++;if(++nodes>MAX_NODES)throw Error('SGF vượt 10.000 nút.');const node={props:{},children:[]};
      skip();while(/[A-Z]/.test(text[i]||'')){
        let id='';while(/[A-Z]/.test(text[i]||''))id+=text[i++];skip();
        if(node.props[id])throw Error(`Thuộc tính ${id} bị lặp trong cùng nút.`);
        const vals=[];while(text[i]==='['){vals.push(value());skip();}if(!vals.length)throw Error(`Thuộc tính ${id} thiếu giá trị.`);node.props[id]=vals;
      }
      if(last)last.children.push(node);else first=node;last=node;skip();
    }
    if(!first)throw Error('Cây SGF không có nút.');
    while(text[i]==='('){last.children.push(tree(depth+1));skip();}expect(')');return first;
  }
  const root=tree(0);skip();if(i!==text.length)throw Error('Chỉ hỗ trợ một ván SGF mỗi file.');
  const single=id=>{const values=root.props[id];if(values&&values.length!==1)throw Error(`${id} cần đúng một giá trị.`);return values?.[0];};
  if(single('GM')&&single('GM')!=='1')throw Error('File này không phải cờ vây (GM[1]).');
  if(single('FF')&&single('FF')!=='4')throw Error('Chỉ hỗ trợ SGF FF[4] hoặc không khai báo FF.');
  if(single('CA')&&!['UTF-8','UTF8','US-ASCII'].includes(single('CA').toUpperCase()))throw Error('Chỉ hỗ trợ file mã hóa UTF-8 hoặc ASCII.');
  const size=Number(single('SZ')||19);if(![9,13,19].includes(size))throw Error('Hỗ trợ bàn vuông 9×9, 13×13 và 19×19.');
  const km=single('KM');if(km!==undefined&&(km.trim()===''||!Number.isFinite(Number(km))))throw Error('Komi không hợp lệ.');
  return {root,size,komi:km===undefined?null:Number(km),black:single('PB')||'Đen',white:single('PW')||'Trắng',result:single('RE')||'',rules:single('RU')||'Không khai báo',nodeCount:nodes};
}
export function sgfPoint(value,size,allowPass=false){
  if(allowPass&&(value===''||value==='tt'))return -1;
  if(!/^[a-s]{2}$/.test(value))throw Error(`Tọa độ SGF không hợp lệ: ${value}.`);
  const col=value.charCodeAt(0)-97,row=value.charCodeAt(1)-97;
  if(col>=size||row>=size)throw Error(`Tọa độ ${value} nằm ngoài bàn.`);return row*size+col;
}
function points(values,size){
  return (values||[]).flatMap(v=>{if(!v.includes(':'))return [sgfPoint(v,size)];
    const parts=v.split(':');if(parts.length!==2)throw Error('Vùng setup SGF không hợp lệ.');
    const a=sgfPoint(parts[0],size),b=sgfPoint(parts[1],size),x1=a%size,x2=b%size,y1=Math.floor(a/size),y2=Math.floor(b/size);
    if(x1>x2||y1>y2)throw Error('Vùng setup SGF bị đảo tọa độ.');const out=[];for(let y=y1;y<=y2;y++)for(let x=x1;x<=x2;x++)out.push(y*size+x);return out;
  });
}
export function applyNode(previous,node,size,isRoot=false){
  const p=node.props;for(const id of ['B','W','PL'])if(p[id]&&p[id].length!==1)throw Error(`${id} cần đúng một giá trị.`);
  if(!isRoot&&['SZ','GM','FF','KM','RU'].some(id=>p[id]))throw Error('Thuộc tính thông tin ván chỉ được hỗ trợ ở nút gốc.');
  if(p.B&&p.W)throw Error('Một nút không được có cả B và W.');
  const setup=['AB','AW','AE'].some(id=>p[id]);if((setup||p.PL)&&(p.B||p.W))throw Error('Không hỗ trợ setup và nước đi trong cùng nút.');
  let board=[...previous.board],next=previous.next,last=-1,count=previous.count,history=previous.history.length?previous.history.slice(-2):[board.join('')];
  if(setup){const used=new Set();for(const [id,color] of [['AE',0],['AB',1],['AW',2]])for(const point of points(p[id],size)){if(used.has(point))throw Error('Setup chồng lấp tại một điểm.');used.add(point);board[point]=color;}
    for(let point=0;point<board.length;point++)if(board[point]&&!group(board,point,size).liberties.length)throw Error('Setup có nhóm hết khí.');
    history=[board.join('')];
  }
  if(isRoot&&p.HA){if(p.HA.length!==1||!/^\d+$/.test(p.HA[0]))throw Error('HA không hợp lệ.');if(Number(p.HA[0])>=2)next=2;}
  if(p.B||p.W){const color=p.B?1:2;last=sgfPoint((p.B||p.W)[0],size,true);
    if(last>=0){const r=move(board,last,color,size,history.length>=2?[history[history.length-2]]:[]);if(r.error)throw Error(`Nước ${count+1}: ${r.error}`);board=r.board;}
    count++;history.push(board.join(''));history=history.slice(-2);next=3-color;
  }
  if(p.PL){if(!['B','W'].includes(p.PL[0]))throw Error('PL phải là B hoặc W.');next=p.PL[0]==='B'?1:2;}
  return {board,next,last,count,history,comment:(p.C||[]).join('\n'),node};
}
export function replaySgf(game,path=[]){
  let state={board:empty(game.size),next:1,last:-1,count:0,history:[]};state=applyNode(state,game.root,game.size,true);
  const frames=[state];let node=game.root;
  for(const choice of path){if(!Number.isInteger(choice)||choice<0||!node.children[choice])throw Error('Đường biến không hợp lệ.');node=node.children[choice];state=applyNode(state,node,game.size);frames.push(state);}
  return frames;
}
export function validateSgf(game){
  const initial=applyNode({board:empty(game.size),next:1,last:-1,count:0,history:[]},game.root,game.size,true);
  const queue=[{node:game.root,state:initial}];while(queue.length){const {node,state}=queue.pop();for(const child of node.children)queue.push({node:child,state:applyNode(state,child,game.size)});}return game;
}
export function trialMove(state,point,size){
  const board=state.board;if(point===-1)return {...state,next:3-state.next,last:-1,count:state.count+1,history:[...state.history,board.join('')].slice(-2)};
  const r=move(board,point,state.next,size,state.history.length>=2?[state.history[state.history.length-2]]:[]);if(r.error)throw Error(r.error);
  return {...state,board:r.board,next:3-state.next,last:point,count:state.count+1,history:[...state.history,r.board.join('')].slice(-2)};
}
