// Pure text formatting for the play page.

/**
 * Area-score summary shown while marking dead stones.
 * @param {{ blackStones: number, blackLand: number, black: number, whiteStones: number,
 *   whiteLand: number, white: number, neutral: number }} s
 * @param {number} komi
 */
export function scoreSummary(s, komi) {
  const komiText = String(komi).replace('.', ',');
  return `Đen: ${s.blackStones} quân sống + ${s.blackLand} đất = ${s.black}. Trắng: ${s.whiteStones} quân sống + ${s.whiteLand} đất + ${komiText} komi = ${s.white}. Trung lập: ${s.neutral}. Theo dấu quân chết bạn chọn, ${s.black > s.white ? 'Đen' : 'Trắng'} hơn ${Math.abs(s.black - s.white)} điểm.`;
}

/**
 * One line per decision the post-game analysis suggests revisiting.
 * @param {{ move: number, played: number, point: number, reply: number, gap: number }[]} findings
 * @param {(point: number) => string} name  coordinate formatter; -1 means a pass
 */
export function analysisSummary(findings, name) {
  if (!findings.length) return 'Engine chưa tìm được nước thay thế tốt hơn trong các nhánh đã xét.';
  const label = (/** @type {number} */ p) => (p === -1 ? 'bỏ lượt' : name(p));
  return findings
    .map(
      (f) =>
        `Nước ${f.move}: bạn đi ${label(f.played)}. Cân nhắc ${label(f.point)}; đối thủ có thể đáp ${label(f.reply)}. Chênh lệch đánh giá: ${f.gap.toFixed(1)} đơn vị nội bộ.`
    )
    .join('\n');
}
