import {move} from './engine.js';
import {boundedReader,goalAchieved} from './reading.js';

export function handleReading(data) {
  const {id, action, board, size, target, remaining, history, point, goal='capture'} = data;
  let response;
  const respond = result => { response = {id, ...result}; };
  const execute = () => {
  try {
    const reader = boundedReader(board, size, target, remaining, history, 250000, goal);
    if (action === 'hint') {
      const result = reader.read();
      respond(!result.certain ? {status:'unknown'} : result.win ? {status:'hint',point:result.point} : {status:'lost'});
      return;
    }
    if(point===-1){respond({status:'wrong',counter:-1});return;}
    const played = point === -1 ? {board:[...board],captured:0} : move(board, point, 1, size, history);
    if (played.error) { respond({status:'invalid',message:played.error}); return; }
    const nextHistory = point === -1 ? history : [...history, played.board.join('')];
    if (goalAchieved(played.board,size,target,goal)) {
      respond({status:'solved',playerBoard:played.board,board:played.board,history:nextHistory,remaining:remaining-1,blackCaptured:played.captured});
      return;
    }
    const verdict = reader.read(played.board, 2, remaining-1, nextHistory);
    if (!verdict.certain) { respond({status:'unknown'}); return; }
    if (!verdict.win) { respond({status:'wrong',counter:verdict.point}); return; }
    const reply = verdict.point === -1 ? {board:played.board,captured:0} : move(played.board, verdict.point, 2, size, nextHistory);
    if (reply.error) { respond({status:'unknown'}); return; }
    respond({status:'continue',playerBoard:played.board,board:reply.board,history:verdict.point===-1?nextHistory:[...nextHistory,reply.board.join('')],remaining:remaining-2,reply:verdict.point,blackCaptured:played.captured,whiteCaptured:reply.captured});
  } catch { respond({status:'unknown'}); }
  };
  execute();
  return response;
}
if (typeof self !== 'undefined') self.onmessage = ({data}) => self.postMessage(handleReading(data));
