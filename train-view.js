// Presentational helpers for the training page. They receive data and callbacks as arguments
// and hold no page state, so they can be tested without a browser where they are pure.
import { studyStats, problemStatus } from './study-state.js';

export const STAGE_LABELS = /** @type {Record<string, string>} */ ({
  foundation: 'Nền tảng',
  tactics: 'Nối, cắt và bắt quân',
  reading: 'Sống/chết và đọc trước',
  strategy: 'Kế hoạch và cuối ván',
  dan: 'Đọc sâu',
  dan2: 'Tính điểm và tranh ko',
  dan3: 'Quyết định trên cả bàn',
});
const STATUS_MARK = /** @type {Record<string, string>} */ ({
  new: '',
  solved: ' · ✓',
  retained: ' · ★',
  due: ' · ↻',
});

/**
 * Fisher-Yates shuffle returning a copy.
 * @template T
 * @param {T[]} items @param {() => number} [random]
 */
export function shuffle(items, random = Math.random) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Message under the stage list describing whether progress can be saved.
 * @param {{ writable: boolean, available: boolean }} state
 */
export function storageStatusText({ writable, available }) {
  if (!writable)
    return 'Tiến độ cũ không tương thích; chưa ghi đè. Phiên này chỉ lưu trong bộ nhớ.';
  return available
    ? 'Lưu trên trình duyệt này.'
    : 'Không lưu được tiến độ tại máy. Giữ tab mở để tiếp tục phiên này.';
}

/**
 * Summary shown after a 10-question test.
 * @param {{ correct: boolean, ms: number }[]} results @param {number} total
 */
export function testResultText(results, total) {
  const correct = results.filter((r) => r.correct).length;
  const seconds = Math.round(
    results.reduce((t, r) => t + r.ms, 0) / Math.max(results.length, 1) / 1000
  );
  const advice =
    correct >= 8
      ? 'Bạn có thể chuyển chặng luyện hoặc kiểm tra lại bằng bộ ngẫu nhiên.'
      : 'Ưu tiên ôn các bài sai trước khi kiểm tra lại.';
  return `Kết quả: ${correct}/${total} bài đúng ở lần thử đầu. ${advice} Thời gian trung bình ${seconds} giây/bài. Đây là điểm bài tập, không xác nhận đẳng.`;
}

/**
 * Stage buttons (desktop), stage select (mobile) and the overall totals.
 * @param {{ list: HTMLElement, select: HTMLSelectElement, total: HTMLElement }} els
 * @param {{ stages: any[], bank: any[], study: any, stage: string, onPick: (stageId: string) => void }} data
 */
export function renderStages(els, { stages, bank, study, stage, onPick }) {
  els.list.replaceChildren();
  els.select.replaceChildren();
  stages.forEach((s, i) => {
    const stats = studyStats(
      bank.filter((p) => p.stage === s.id),
      study
    );
    const button = document.createElement('button');
    button.className = s.id === stage ? 'active' : '';
    button.setAttribute('aria-current', s.id === stage ? 'step' : 'false');
    const rank = document.createElement('span');
    rank.textContent = s.name;
    const option = document.createElement('option');
    option.value = s.id;
    option.textContent = `${i + 1}. ${STAGE_LABELS[s.id]} · ${s.name}`;
    els.select.append(option);
    const name = document.createElement('strong');
    name.textContent = `${i + 1}. ${STAGE_LABELS[s.id]}`;
    const count = document.createElement('span');
    count.textContent = `${stats.clean}/${stats.total}${stats.due ? ` · ${stats.due} cần ôn` : ''}`;
    count.title = `${stats.clean}/${stats.total} bài tự giải`;
    button.append(name, rank, count);
    button.onclick = () => onPick(s.id);
    els.list.append(button);
  });
  els.select.value = stage;
  const active = /** @type {HTMLElement | null} */ (els.list.querySelector('.active'));
  if (active) els.list.scrollLeft = Math.max(0, active.offsetLeft - els.list.offsetLeft);
  const total = studyStats(bank, study);
  els.total.replaceChildren();
  for (const text of [
    `${total.solved}/${total.total} đã giải`,
    `${total.clean} tự giải`,
    `${total.retained} nhớ qua nhiều ngày`,
  ]) {
    const s = document.createElement('span');
    s.textContent = text;
    els.total.append(s);
  }
}

/**
 * Topic filter for a stage; returns the topic that ended up selected.
 * @param {HTMLSelectElement} select @param {string[]} topics @param {string} wanted @param {boolean} disabled
 */
export function renderTopicSelect(select, topics, wanted, disabled) {
  select.replaceChildren();
  for (const name of ['all', ...new Set(topics)]) {
    const o = document.createElement('option');
    o.value = name;
    o.textContent = name === 'all' ? 'Tất cả chủ đề' : name;
    select.append(o);
  }
  const topic = [...select.options].some((o) => o.value === wanted) ? wanted : 'all';
  select.value = topic;
  select.disabled = disabled;
  return topic;
}

/**
 * Problem picker listing the queue with a status mark per problem.
 * @param {HTMLSelectElement} select @param {{ id: string, title: string }[]} queue @param {any} study @param {boolean} disabled
 */
export function renderProblemSelect(select, queue, study, disabled) {
  select.replaceChildren();
  queue.forEach((p, i) => {
    const o = document.createElement('option');
    o.value = String(i);
    o.textContent = `${i + 1}. ${p.title}${STATUS_MARK[problemStatus(study.records[p.id])]}`;
    select.append(o);
  });
  select.disabled = disabled || !queue.length;
}

/** Help line under the mode buttons. @param {string} mode */
export function modeHelpText(mode) {
  if (mode === 'today')
    return 'Kế hoạch hôm nay: bài đến hạn ôn trước, rồi bài mới theo thứ tự lộ trình. Không cần chọn chặng.';
  if (mode === 'practice') return 'Chọn chủ đề và bài. Bài sai chuyển sang “Ôn bài cần nhớ”.';
  if (mode === 'review')
    return 'Chỉ hiện bài sai hoặc bài đã tới lịch ôn của chặng đang chọn. Chưa có bài thì đổi chặng hoặc chọn “Làm bài mới”.';
  return '10 bài ngẫu nhiên trong chặng đang chọn. Chấm lần thử đầu; không có gợi ý, xem khí hay giải thích thuật ngữ.';
}

/** Heading shown when the current mode/filter yields no problems. @param {string} mode */
export function emptyQueueTitle(mode) {
  if (mode === 'review') return 'Chưa có bài cần ôn ở mốc này';
  if (mode === 'today') return 'Hôm nay đã xong kế hoạch';
  return 'Chưa có bài theo bộ lọc';
}

const MODE_TAG = /** @type {Record<string, string>} */ ({
  test: 'KIỂM TRA',
  review: 'ÔN TẬP',
  today: 'HÔM NAY',
});
/**
 * Eyebrow above the title, e.g. "NHẬP MÔN · BÀI TẬP 3/20".
 * @param {{ stageName: string, mode: string, index: number, total: number, rotated?: boolean }} p
 */
export function chapterLabel({ stageName, mode, index, total, rotated }) {
  const tag = MODE_TAG[mode] ?? 'BÀI TẬP';
  return `${stageName.toUpperCase()} · ${tag} ${index + 1}/${total}${rotated ? ' · GÓC NHÌN KHÁC' : ''}`;
}

/** How-to-practise tip for the guide panel. @param {{ kind: string, goal?: string }} puzzle */
export function tipText(puzzle) {
  if (puzzle.kind !== 'reading')
    return 'Chỉ dùng các điều kiện trong đề để chọn đáp án. Nếu có hình bàn 19×19, đó là hình minh họa cho tình huống, không phải lời giải đã được AI kiểm tra.';
  return puzzle.goal === 'eyes'
    ? 'Tìm cách chia khoảng trống thành hai mắt thật cho nhóm có dấu tam giác. Các quân bảo vệ hai mắt phải thuộc cùng nhóm. App kiểm tra các cách Trắng đáp.'
    : 'Bắt nhóm có dấu tam giác trước khi hết lượt. App kiểm tra các cách Trắng đáp; bạn có thể dùng bất kỳ nước nào vẫn bảo đảm đạt mục tiêu.';
}

const byId = (/** @type {string} */ id) => /** @type {any} */ (document.getElementById(id));

/**
 * Replaces the board area with a "nothing to practise" message.
 * @param {{ mode: string, stageName: string }} data
 */
export function showEmptyQueue({ mode, stageName }) {
  byId('title').textContent = emptyQueueTitle(mode);
  byId('chapter').textContent = stageName;
  byId('objective').textContent = '';
  byId('play-surface').hidden = true;
  byId('board-size').hidden = true;
  byId('concept').hidden = false;
  byId('concept').textContent =
    'Chọn “Làm bài mới” để tiếp tục, hoặc đổi chặng luyện. Bài sai sẽ vào hàng ôn ngay; bài tự giải được nhắc lại từ ngày mai.';
  byId('guide-title').textContent = 'Ôn theo tiến độ';
  byId('tip').textContent = 'Không cần làm lại mọi bài mỗi ngày. Ưu tiên bài sai và bài đến hạn.';
  byId('turn').textContent = '';
  byId('depth').textContent = '';
  byId('reading-controls').hidden = true;
  for (const id of ['hint', 'solution', 'retry', 'next']) byId(id).disabled = true;
  byId('attempt-status').textContent = '';
}

/**
 * Shows a multiple-choice puzzle: hides the reading controls, puts the prompt on the board area
 * (or in the concept box when there is no diagram) and lists shuffled answer buttons.
 * @param {{ size?: number, prompt: string, choices: string[] }} puzzle
 * @param {(choice: number, button: HTMLButtonElement) => void} onPick
 */
export function showQuizChoices(puzzle, onPick) {
  byId('reading-controls').hidden = true;
  byId('hint').disabled = true;
  if (!puzzle.size) {
    byId('play-surface').hidden = true;
    byId('concept').hidden = false;
    byId('concept').textContent = puzzle.prompt;
  } else byId('objective').textContent = puzzle.prompt;
  shuffle(puzzle.choices.map((text, i) => ({ text, i }))).forEach(({ text, i }) => {
    const button = document.createElement('button');
    button.textContent = text;
    button.onclick = () => onPick(i, button);
    byId('answers').append(button);
  });
}

/**
 * Turn indicator under the training board.
 * @param {{ viewStep: number, finished: boolean, mode: string, wrong: number, busy: boolean, reading: boolean }} s
 */
export function turnStatusText({ viewStep, finished, mode, wrong, busy, reading }) {
  if (viewStep >= 0) return `Xem lại lượt ${viewStep} · không đặt quân ở thế này`;
  if (finished) return mode === 'test' && wrong ? '× Bài chưa đúng' : '✓ Bài đã kết thúc';
  if (busy) return 'Đang kiểm tra các cách đáp…';
  return reading ? '● Đen đi' : 'Chọn câu trả lời bên dưới';
}

/**
 * Remaining-moves line for reading puzzles; diagram-only puzzles say so.
 * @param {{ reading: boolean, hasBoard: boolean, depth: number, viewStep: number, remaining: number }} s
 */
export function depthStatusText({ reading, hasBoard, depth, viewStep, remaining }) {
  if (reading)
    return `Còn ${Math.max(viewStep >= 0 ? depth - viewStep : remaining, 0)} lượt cả hai bên`;
  return hasBoard ? 'Sơ đồ minh họa' : '';
}

/**
 * Attempt summary: mistakes and whether help was used.
 * @param {{ wrong: number, assisted: boolean, mode: string }} s
 */
export function attemptStatusText({ wrong, assisted, mode }) {
  const help = assisted
    ? 'Đã dùng gợi ý'
    : mode === 'test'
      ? 'Kiểm tra không gợi ý'
      : 'Chưa dùng gợi ý';
  return `${wrong ? `${wrong} lần sai · ` : ''}${help}`;
}
