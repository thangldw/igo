// Presentational pieces of the lesson/play page. Functions take data and callbacks as
// arguments and touch only the elements passed in, so they hold no shared page state.

/** @typedef {{ id: string, name: string, summary: string }} Level */
/** @typedef {any} Lesson  Lesson shape varies by `kind`; see lessons.js. */

/**
 * Level tabs, lesson list (desktop), lesson select (mobile) and progress bar.
 * @param {{ levelsBox: HTMLElement, summary: HTMLElement, list: HTMLElement, select: HTMLSelectElement,
 *   progressText: HTMLElement, progressBar: HTMLElement }} els
 * @param {{ levels: Level[], lessons: Lesson[], level: string, inLesson: boolean, currentId: string,
 *   done: string[], onLevel: (levelId: string) => void, onLesson: (lesson: Lesson) => void }} data
 */
export function renderNavigation(els, data) {
  const { levels, lessons, level, inLesson, currentId, done } = data;
  const inLevel = lessons.filter((l) => l.level === level);
  els.levelsBox.replaceChildren();
  for (const l of levels) {
    const button = document.createElement('button');
    button.textContent = l.name;
    button.setAttribute('aria-pressed', String(l.id === level));
    button.onclick = () => data.onLevel(l.id);
    els.levelsBox.append(button);
  }
  els.summary.textContent = levels.find((l) => l.id === level)?.summary ?? '';
  els.list.replaceChildren();
  els.select.replaceChildren();
  inLevel.forEach((l, index) => {
    const isCurrent = inLesson && l.id === currentId;
    const button = document.createElement('button');
    button.setAttribute('aria-current', isCurrent ? 'step' : 'false');
    button.className = isCurrent ? 'active' : '';
    const option = document.createElement('option');
    option.value = l.id;
    option.textContent = `${index + 1}. ${l.title}`;
    els.select.append(option);
    const number = document.createElement('span');
    number.className = 'number';
    number.textContent = done.includes(l.id) ? '✓' : String(index + 1).padStart(2, '0');
    button.replaceChildren(number, document.createTextNode(l.title));
    button.onclick = () => data.onLesson(l);
    els.list.append(button);
  });
  els.select.value = currentId;
  const active = /** @type {HTMLElement | null} */ (els.list.querySelector('.active'));
  if (active) els.list.scrollLeft = Math.max(0, active.offsetLeft - els.list.offsetLeft);
  const completed = inLevel.filter((l) => done.includes(l.id)).length;
  els.progressText.textContent = `${completed} / ${inLevel.length}`;
  els.progressBar.style.width = `${(completed / inLevel.length) * 100}%`;
}

/**
 * Answer choices for quiz/territory lessons; `onPick(correct)` runs for the chosen option.
 * @param {HTMLElement} box @param {Lesson} lesson @param {(correct: boolean) => void} onPick
 */
export function renderAnswers(box, lesson, onPick) {
  box.replaceChildren();
  if (lesson.answer === undefined) return;
  /** @type {string[]} */
  const choices =
    lesson.choices ||
    [1, 2, 3, 4].map((v) => `${v} ${lesson.kind === 'territory' ? 'điểm' : 'khí'}`);
  choices.forEach((label, index) => {
    const button = document.createElement('button');
    button.textContent = label;
    button.onclick = () => {
      const correct = lesson.choices ? index === lesson.answer : index + 1 === lesson.answer;
      onPick(correct);
    };
    box.append(button);
  });
}

/**
 * Feedback shown when the learner picks the right answer or finds the solution.
 * @param {Lesson} lesson @param {number} [captured]
 */
export function successText(lesson, captured = 0) {
  if (lesson.success) return lesson.success;
  if (lesson.answer !== undefined)
    return lesson.kind === 'territory'
      ? 'Đúng! Vùng giữa có 1 điểm đất. Quân trên bàn cũng được tính khi đếm diện tích.'
      : 'Đúng! Quân giữa bàn có 4 khí.';
  if (lesson.kind === 'place')
    return 'Bạn vừa đi nước đầu tiên. Tiếp theo, học cách giữ quân sống.';
  if (lesson.kind === 'save') return 'Đúng! Nhóm đen đã nối ra ngoài và có 3 khí.';
  return `Đúng! Bạn đã bắt ${captured} quân trắng.`;
}

/**
 * Prompt shown when a lesson opens.
 * @param {Lesson} lesson @param {boolean} conceptual
 */
export function introText(lesson, conceptual) {
  if (lesson.kind === 'sequence')
    return 'Nghĩ trước cách Trắng đáp rồi đặt quân Đen. Trong bài này, Trắng đi theo chuỗi mẫu.';
  return conceptual ? 'Chọn đáp án theo tình huống trong đề.' : 'Thử trực tiếp trên bàn cờ.';
}

/**
 * Label on the "next" button once a lesson is solved.
 * @param {Lesson | undefined} next @param {string} level @param {Level[]} levels
 */
export function nextLabel(next, level, levels) {
  if (!next) return 'Luyện với máy →';
  if (next.level !== level)
    return `Sang ${levels.find((l) => l.id === next.level).name.toLowerCase()} →`;
  return 'Bài tiếp theo →';
}

/**
 * Turn indicator under the board.
 * @param {{ mode: string, lesson: Lesson, lineStep: number, solved: boolean, ended: boolean, busy: boolean }} state
 */
export function turnText({ mode, lesson, lineStep, solved, ended, busy }) {
  if (mode === 'lesson') {
    if (solved) return '✓ Đã hoàn thành bài';
    return lesson.kind === 'sequence'
      ? `● Đen đi · Nước ${Math.floor(lineStep / 2) + 1} / ${Math.ceil(lesson.lines[0].length / 2)}`
      : '● Bạn đặt quân đen';
  }
  if (ended) return 'Ván đã kết thúc';
  return busy ? '○ Máy đang đi…' : '● Lượt của bạn';
}

/**
 * Capture counter / sequence hint beside the turn indicator.
 * @param {{ mode: string, lesson: Lesson, captures: number[] }} state
 */
export function capturedText({ mode, lesson, captures }) {
  if (mode === 'lesson') return lesson.kind === 'sequence' ? 'Trắng đáp theo chuỗi mẫu' : '';
  return `Đã bắt: đen ${captures[0]} · trắng ${captures[1]}`;
}
