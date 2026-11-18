// Pure helpers for how the training page explains a reading puzzle move.
import { move } from './engine.js';
import { coordinate } from './board-view.js';

/**
 * The learner's wrong move followed by White's refutation, as two trace steps ready to replay.
 * Returns an empty list when either move is illegal (nothing sensible to show).
 * @param {import('./types.js').Board} board @param {number} point @param {number} counter
 * @param {number} size @param {import('./types.js').History} history
 */
export function refutationSteps(board, point, counter, size, history) {
  const a = move(board, point, 1, size, history);
  if ('error' in a) return [];
  const b = move(a.board, counter, 2, size, [...history, a.board.join('')]);
  if ('error' in b) return [];
  return [
    { board: [...a.board], point, color: 1, refute: true },
    { board: [...b.board], point: counter, color: 2, refute: true },
  ];
}

/**
 * Feedback for a move that does not reach the goal.
 * @param {{ counter?: number }} result @param {{ goal?: string, size: number }} puzzle
 */
export function wrongMoveText(result, puzzle) {
  const response =
    result.counter === undefined
      ? ''
      : ` Trắng có thể ngăn bạn đạt mục tiêu bằng nước ${coordinate(result.counter, puzzle.size)}; xem trên bàn, rồi chọn “Trở lại thế hiện tại”.`;
  return `Nước này không buộc ${puzzle.goal === 'eyes' ? 'tạo hai mắt' : 'bắt được nhóm'} trong số lượt còn lại.${response} Hãy thử hướng khác.`;
}

/**
 * Feedback after a correct-so-far move when White answers.
 * @param {{ reply: number, whiteCaptured?: number }} result @param {number} size
 */
export function replyText(result, size) {
  const captured = result.whiteCaptured ? `, bắt ${result.whiteCaptured} quân đen` : '';
  return `Trắng ${coordinate(result.reply, size)}${captured}. Đọc nước đen tiếp theo.`;
}

export const PASS_WRONG_TEXT =
  'Bỏ lượt chưa đạt mục tiêu: trắng có thể bỏ lượt để kết thúc bàn mà nhóm mục tiêu chưa được xử lý. Hãy tìm một nước đặt quân.';

/**
 * Text for the three escalating hints of a reading puzzle.
 * @param {1 | 2 | 3} level
 * @param {{ size: number, liberties?: number, point?: number }} data  `point` is the hinted move.
 */
export function hintText(level, { size, liberties = 0, point = 0 }) {
  if (level === 1)
    return `Gợi ý 1/3: nhóm có dấu tam giác còn ${liberties} khí (chấm trên bàn). Thử tìm nước liên quan tới các khí này.`;
  if (level === 2) return `Gợi ý 2/3: nước đúng nằm ở hàng ${size - Math.floor(point / size)}.`;
  return `Gợi ý 3/3: một nước giữ khả năng đạt mục tiêu là ${coordinate(point, size)}.`;
}
