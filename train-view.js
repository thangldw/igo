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
