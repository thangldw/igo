// DOM helpers shared by the lesson, training and review boards.
export const COLUMNS = 'ABCDEFGHJKLMNOPQRST';
const COLOR_NAME = { 0: 'trống', 1: 'đen', 2: 'trắng' };

export const coordinate = (i, n) => `${COLUMNS[i % n]}${n - Math.floor(i / n)}`;
export const colorName = (value) => COLOR_NAME[value] ?? COLOR_NAME[0];

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

export function span(className, text) {
  const el = document.createElement('span');
  el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

/** A board intersection button with edge classes (left/right/top/bottom) and extra classes. */
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
export function appendStone(button, color, isLast) {
  const stone = span(`stone ${color === 1 ? 'black' : 'white'} ${isLast ? 'last' : ''}`);
  button.append(stone);
  return stone;
}

/** Row numbers on the left edge and column letters along the bottom edge. */
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
