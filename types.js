// Shared JSDoc typedefs (no runtime code). Reference them as import('./types.js').Board etc.

/** @typedef {number[]} Board  Row-major intersections: 0 empty, 1 black, 2 white. */
/** @typedef {0 | 1 | 2} Stone */
/** @typedef {1 | 2} Color  1 = black, 2 = white. */
/** @typedef {string[]} History  Board snapshots serialised with board.join('') (for superko). */
/** @typedef {{ stones: number[], liberties: number[] }} Group */
/** @typedef {{ board: Board, captured: number } | { error: string }} MoveResult */

export {};
