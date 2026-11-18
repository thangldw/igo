import { parseSgf, replaySgf, validateSgf, trialMove } from './sgf.js';
import { parseOgsGameId, fetchOgsSgf } from './ogs.js';
import { group } from './engine.js';
import { renderTerms } from './terms.js';
import { validNotes } from './review-notes.js';
import {
  coordinate,
  colorName,
  span,
  createPoint,
  appendStone,
  appendEdgeLabels,
} from './board-view.js';
renderTerms(
  /** @type {HTMLDetailsElement} */ (document.getElementById('terms')),
  'SGF, đọc biến, ko, superko, komi, phản bác'
);
/** @type {(id: string) => any} DOM lookups are by known ids in the page markup. */
const $ = (id) => document.getElementById(id),
  KEY = 'igo-sgf-review-v1';
const sample =
  '(;FF[4]GM[1]SZ[19]KM[6.5]RU[Japanese]PB[Đen minh họa]PW[Trắng minh họa]C[Ván tự tạo để học thao tác; không phải ván chuẩn 3 dan.];B[pd];W[dd];B[qp];W[dp];B[fq];W[cn]C[Dừng tại đây. Thử hai hướng phát triển trước khi đọc tiếp.](;B[qo]C[Nhánh minh họa A: gia cố bên phải.];W[fc];B[jq])(;B[cf]C[Nhánh minh họa B: tiếp cận góc trên trái.];W[fd];B[cc]))';
/**
 * @typedef {import('./sgf.js').SgfState} Frame
 * @typedef {{
 *   game: any, source: string, filename: string, notes: Record<string, any>,
 *   drafts: Record<string, Record<string, string>>, choices: number[], frames: Frame[],
 *   cursor: number, trials: Frame[], inspected: number[], writable: boolean
 * }} ReviewState  `game` is the parsed SGF tree (see sgf.js).
 */
/** @type {ReviewState} */
const review = {
  game: null,
  source: '',
  filename: '',
  notes: {},
  drafts: {},
  choices: [],
  frames: [],
  cursor: 0,
  trials: [],
  inspected: [],
  writable: true,
};
/** @param {number} p */
const pointName = (p) => (p === -1 ? 'bỏ lượt' : coordinate(p, review.game.size));
const base = () => review.frames[review.cursor],
  current = () => (review.trials.length ? review.trials.at(-1) : base());
const noteKey = () => JSON.stringify(review.choices.slice(0, review.cursor));
/** @param {number[]} path */
function extend(path) {
  let node = review.game.root;
  for (const n of path) node = node.children[n];
  while (node.children.length) {
    path.push(0);
    node = node.children[0];
  }
  return path;
}
/** @param {string} text @param {string} name @param {Record<string, any>} [savedNotes] */
function open(text, name, savedNotes = {}) {
  const parsed = validateSgf(parseSgf(text));
  // Commit only after every branch passes replay validation.
  review.game = parsed;
  review.source = text;
  review.filename = name;
  review.notes = savedNotes;
  review.drafts = {};
  review.choices = extend([]);
  review.frames = replaySgf(review.game, review.choices);
  review.cursor = 0;
  review.trials = [];
  review.inspected = [];
  $('game-title').textContent = `${review.game.black} · ${review.game.white}`;
  $('metadata').textContent =
    `${review.game.size}×${review.game.size} · komi ${review.game.komi ?? 'không khai báo'} · luật ${review.game.rules} · kết quả ${review.game.result || 'chưa khai báo'} · ${review.game.nodeCount} nút`;
  $('status').textContent =
    `Đã mở ${name}. File không được gửi lên máy chủ. Nước đi được kiểm tra về đặt quân và bắt quân; bạn vẫn cần tự đánh giá cách đi.`;
  render(true);
}
function render(loadNote = false) {
  const ready = !!review.game;
  for (const id of [
    'first',
    'prev',
    'next',
    'last',
    'seek',
    'pass',
    'undo',
    'reset',
    'liberties',
    'export',
  ])
    $(id).disabled = !ready;
  for (const id of ['candidates', 'refutation', 'conclusion']) $(id).disabled = !ready;
  $('note-form').querySelector('button').disabled = !ready;
  $('review-surface').hidden = !ready;
  if (!ready) return;
  const state = current(),
    size = review.game.size;
  $('board').replaceChildren();
  $('board').style.setProperty('--size', size);
  $('board').style.gridTemplateColumns = `repeat(${size},1fr)`;
  for (let i = 0; i < size * size; i++) {
    const button = createPoint(i, size);
    button.setAttribute(
      'aria-label',
      `${pointName(i)}: ${colorName(state.board[i])}${review.inspected.includes(i) ? ', khí' : ''}`
    );
    if (state.board[i]) appendStone(button, state.board[i], state.last === i);
    if (review.inspected.includes(i)) button.append(span('liberty-mark'));
    appendEdgeLabels(button, i, size);
    button.onclick = () => {
      if ($('liberties').checked) {
        if (!state.board[i]) {
          $('liberty-status').textContent = 'Chọn một nhóm quân để xem khí.';
          return;
        }
        review.inspected = group(state.board, i, size).liberties;
        $('liberty-status').textContent =
          `Nhóm tại ${pointName(i)} có ${review.inspected.length} khí.`;
        render();
      } else play(i);
    };
    $('board').append(button);
  }
  $('position').textContent =
    `Ván gốc: nước ${base().count} · vị trí ${review.cursor}/${review.frames.length - 1}`;
  $('turn').textContent =
    `${state.next === 1 ? '● Đen' : '○ Trắng'} đi${review.trials.length ? ' · đang thử cách đi khác' : ''}`;
  $('seek').max = review.frames.length - 1;
  $('seek').value = review.cursor;
  $('first').disabled = $('prev').disabled = review.cursor === 0 || review.trials.length > 0;
  $('next').disabled = $('last').disabled =
    review.cursor === review.frames.length - 1 || review.trials.length > 0;
  $('seek').disabled = review.trials.length > 0;
  $('undo').disabled = $('reset').disabled = !review.trials.length;
  $('trial-status').textContent = review.trials.length
    ? `Biến tự thử: ${review.trials.map((s) => `${s.next === 2 ? 'Đen' : 'Trắng'} ${pointName(s.last)}`).join(' → ')}. Đây là chuỗi bạn tự thử, chưa biết có thắng trước mọi cách đáp không.`
    : 'Nhấn bàn để thử một biến. Điều hướng ván gốc không thay đổi file.';
  $('comment').textContent = base().comment || 'Không có lời bình.';
  $('branches').replaceChildren();
  /** @type {any[]} */
  const children = base().node.children;
  if (children.length > 1) {
    children.forEach((child, i) => {
      const b = document.createElement('button');
      const color = child.props.B ? 'Đen' : child.props.W ? 'Trắng' : '';
      const val = (child.props.B || child.props.W)?.[0];
      b.textContent = `Cách tiếp ${i + 1}${val !== undefined ? `: ${color} ${pointName(val === '' || val === 'tt' ? -1 : (val.charCodeAt(1) - 97) * size + val.charCodeAt(0) - 97)}` : ''}`;
      b.disabled = review.trials.length > 0;
      b.onclick = () => {
        rememberDraft();
        review.choices = extend([...review.choices.slice(0, review.cursor), i]);
        review.frames = replaySgf(review.game, review.choices);
        review.cursor++;
        review.inspected = [];
        render(true);
      };
      $('branches').append(b);
    });
  }
  if (loadNote) {
    $('comment-wrap').open = false;
    const note = review.drafts[noteKey()] || review.notes[noteKey()] || {};
    for (const id of ['candidates', 'refutation', 'conclusion']) $(id).value = note[id] || '';
    $('save-status').textContent = '';
  }
}
function rememberDraft() {
  if (!review.game) return;
  review.drafts[noteKey()] = {};
  for (const id of ['candidates', 'refutation', 'conclusion'])
    review.drafts[noteKey()][id] = $(id).value;
}
/** @param {number} n */
function navigate(n) {
  if (!review.game || review.trials.length) return;
  rememberDraft();
  review.cursor = Math.max(0, Math.min(n, review.frames.length - 1));
  review.inspected = [];
  $('liberty-status').textContent = '';
  render(true);
}
/** @param {number} point */
function play(point) {
  if (!review.game) return;
  try {
    review.trials.push(trialMove(current(), point, review.game.size));
    review.inspected = [];
    $('liberty-status').textContent = '';
    render();
  } catch (e) {
    $('trial-status').textContent = e.message;
  }
}
$('first').onclick = () => navigate(0);
$('prev').onclick = () => navigate(review.cursor - 1);
$('next').onclick = () => navigate(review.cursor + 1);
$('last').onclick = () => navigate(review.frames.length - 1);
$('seek').oninput = () => navigate(Number($('seek').value));
$('pass').onclick = () => play(-1);
$('undo').onclick = () => {
  review.trials.pop();
  review.inspected = [];
  render();
};
$('reset').onclick = () => {
  review.trials = [];
  review.inspected = [];
  render();
};
$('liberties').onchange = () => {
  review.inspected = [];
  $('liberty-status').textContent = '';
  render();
};
$('ogs-form').onsubmit = async (/** @type {Event} */ event) => {
  event.preventDefault();
  const id = parseOgsGameId($('ogs-url').value);
  if (!id) {
    $('status').textContent = 'Dùng link dạng https://online-go.com/game/12345 hoặc chỉ số ván.';
    return;
  }
  $('status').textContent = 'Đang tải ván từ OGS…';
  try {
    open(await fetchOgsSgf(id), `OGS ${id}`);
  } catch (e) {
    $('status').textContent =
      `Không nhập được từ OGS: ${e.message === 'Failed to fetch' ? 'không kết nối được (mạng hoặc OGS chặn).' : e.message} Bạn có thể tải SGF trên OGS rồi chọn file. Ván đang mở được giữ nguyên.`;
  }
};
$('sample').onclick = () => {
  try {
    open(sample, 'Ván minh họa tự tạo');
  } catch (e) {
    $('status').textContent = e.message;
  }
};
$('file').onchange = async () => {
  const file = $('file').files[0];
  if (!file) return;
  if (file.size > 1000000) {
    $('status').textContent = 'File vượt 1 MB; ván đang mở được giữ nguyên.';
    return;
  }
  try {
    open(await file.text(), file.name);
  } catch (e) {
    $('status').textContent = `Không mở được: ${e.message} Ván đang mở được giữ nguyên.`;
  }
};
$('note-form').onsubmit = (/** @type {Event} */ e) => {
  e.preventDefault();
  if (!review.game) return;
  /** @type {Record<string, any>} */
  const note = { move: base().count, path: review.choices.slice(0, review.cursor) };
  for (const id of ['candidates', 'refutation', 'conclusion']) note[id] = $(id).value.trim();
  review.notes[noteKey()] = note;
  if (!review.writable) {
    $('save-status').textContent =
      'Dữ liệu cũ không tương thích; chỉ giữ trong phiên này. Tải bản ghi để lưu.';
    return;
  }
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        version: 1,
        source: review.source,
        filename: review.filename,
        notes: review.notes,
        choices: review.choices,
        cursor: review.cursor,
      })
    );
    $('save-status').textContent =
      `Đã lưu ghi chú ở nước ${base().count} và SGF gốc tại trình duyệt này.`;
  } catch {
    $('save-status').textContent = 'Không lưu được tại trình duyệt. Tải bản ghi để lưu.';
  }
};
$('export').onclick = () => {
  if (!review.game) return;
  const sections = [
    `# Xem ván: ${review.game.black} · ${review.game.white}`,
    'Ghi chú tự đánh giá; không chứng nhận sức chơi.',
  ];
  for (const note of Object.values(review.notes)) {
    sections.push(
      `## Nước ${note.move} · nhánh ${JSON.stringify(note.path)}`,
      `Các nước cân nhắc: ${note.candidates}`,
      `Cách đối thủ hóa giải: ${note.refutation}`,
      `Đối chiếu: ${note.conclusion}`
    );
  }
  sections.push('## SGF gốc', '```sgf', review.source, '```');
  const url = URL.createObjectURL(
    new Blob([sections.join('\n\n')], { type: 'text/markdown;charset=utf-8' })
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = 'igo-xem-van.md';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
render();
try {
  const raw = localStorage.getItem(KEY);
  if (raw) {
    const saved = JSON.parse(raw);
    if (
      saved.version !== 1 ||
      typeof saved.source !== 'string' ||
      typeof saved.filename !== 'string' ||
      !validNotes(saved.notes)
    )
      throw Error('Bản lưu không tương thích.');
    open(saved.source, saved.filename, saved.notes);
    if (
      Array.isArray(saved.choices) &&
      Number.isInteger(saved.cursor) &&
      saved.cursor >= 0 &&
      saved.cursor <= saved.choices.length
    ) {
      const recovered = replaySgf(review.game, saved.choices);
      review.choices = saved.choices;
      review.frames = recovered;
      review.cursor = saved.cursor;
      render(true);
    }
    $('status').textContent = 'Đã khôi phục ván và ghi chú đã lưu trên trình duyệt này.';
  }
} catch {
  review.writable = false;
  $('status').textContent =
    'Không đọc được bản lưu cũ; chưa ghi đè. Có thể mở SGF và tải ghi chú cho phiên mới.';
}

if (new URLSearchParams(location.search).get('game') === 'latest') {
  try {
    const sgf = localStorage.getItem('igo-game-review-v1');
    if (sgf) open(sgf, 'Ván vừa chơi với máy');
    else $('status').textContent = 'Chưa có ván được chuyển. Hãy mở file SGF.';
  } catch (e) {
    $('status').textContent = e.message;
  }
}
