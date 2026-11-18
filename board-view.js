// DOM helpers shared by the lesson, training and review boards.
export const COLUMNS = 'ABCDEFGHJKLMNOPQRST';
/** @type {Record<number, string>} */
const COLOR_NAME = { 0: 'trống', 1: 'đen', 2: 'trắng' };

/** @param {number} i @param {number} n */
export const coordinate = (i, n) => `${COLUMNS[i % n]}${n - Math.floor(i / n)}`;
/** @param {number} value */
export const colorName = (value) => COLOR_NAME[value] ?? COLOR_NAME[0];

/** @param {number} i @param {number} n */
export function isStarPoint(i, n) {
  const mid = (n - 1) / 2,
    edge = n === 9 ? 2 : 3,
    r = Math.floor(i / n),
    c = i % n;
  if (n === 19) {
    const lines = [edge, mid, n - 1 - edge];
    return lines.includes(r) && lines.includes(c);
  }
  return (
    ((r === edge || r === n - 1 - edge) && (c === edge || c === n - 1 - edge)) ||
    (r === mid && c === mid)
  );
}

/** @param {string} className @param {string | number} [text] */
export function span(className, text) {
  const el = document.createElement('span');
  el.className = className;
  if (text !== undefined) el.textContent = String(text);
  return el;
}

/** A board intersection button with edge classes (left/right/top/bottom) and extra classes. */
/** @param {number} i @param {number} n @param {...string} extraClasses */
export function createPoint(i, n, ...extraClasses) {
  const button = document.createElement('button');
  button.className = [
    i % n === 0 ? 'left' : '',
    i % n === n - 1 ? 'right' : '',
    i < n ? 'top' : '',
    i >= n * (n - 1) ? 'bottom' : '',
    ...extraClasses,
  ].join(' ');
  return button;
}

/** Appends a stone span; returns it so callers can attach markers. */
/** @param {HTMLElement} button @param {number} color @param {boolean} [isLast] */
export function appendStone(button, color, isLast) {
  const stone = span(`stone ${color === 1 ? 'black' : 'white'} ${isLast ? 'last' : ''}`);
  button.append(stone);
  return stone;
}

/** Row numbers on the left edge and column letters along the bottom edge. */
/** @param {HTMLElement} button @param {number} i @param {number} n */
export function appendEdgeLabels(button, i, n) {
  if (i % n === 0) {
    const label = span('grid-label row-label', n - Math.floor(i / n));
    label.setAttribute('aria-hidden', 'true');
    button.append(label);
  }
  if (i >= n * (n - 1)) {
    const label = span('grid-label column-label', COLUMNS[i % n]);
    label.setAttribute('aria-hidden', 'true');
    button.append(label);
  }
}

/**
 * Pixel width for a play board: fits the column and viewport height, never narrower than
 * 28px per point, then scaled by the zoom factor.
 * @param {{ n: number, zoom: number, columnWidth: number, viewportHeight: number }} p
 */
export function boardPixelWidth({ n, zoom, columnWidth, viewportHeight }) {
  const min = n * 28;
  return Math.max(min, Math.min(columnWidth, Math.max(viewportHeight - 250, min))) * zoom;
}
