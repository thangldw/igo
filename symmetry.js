// Board symmetries (8 dihedral transforms) so a reading puzzle can be replayed from a different angle.
// Go rules are symmetric, so a transformed reading puzzle keeps its proof; only quiz diagrams are left alone.
export const SYMMETRIES = 8;
export function transformPoint(point, size, k) {
  if (point < 0) return point;
  const r = Math.floor(point / size), c = point % size, m = size - 1;
  const [nr, nc] = [[r, c], [c, m - r], [m - r, m - c], [m - c, r], [r, m - c], [m - r, c], [c, r], [m - c, m - r]][k % 8];
  return nr * size + nc;
}
export function transformPuzzle(puzzle, k) {
  k %= 8;
  if (!k || puzzle.kind !== 'reading' || !puzzle.size) return puzzle;
  const t = p => transformPoint(p, puzzle.size, k);
  const out = { ...puzzle, symmetry: k, setup: puzzle.setup.map(([p, c]) => [t(p), c]), target: t(puzzle.target) };
  if (Array.isArray(puzzle.winning)) out.winning = puzzle.winning.map(t);
  return out;
}
// Pick a variant on repeat visits only: the first attempt keeps the canonical orientation so shared links stay stable.
export const variantFor = (attempts, random = Math.random) => attempts > 0 ? 1 + Math.floor(random() * 7) : 0;
