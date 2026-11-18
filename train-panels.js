// Presentational panels of the training page. They take data and callbacks as arguments
// and touch only the container they are given, so they carry no shared page state.

/** "Hôm nay" card: progress towards the daily goal, streak and the last 7 days. */
export function renderToday(card, { plan, streak, dots }) {
  const fresh = plan.items.length - plan.due;
  const title = document.createElement('h2'),
    line = document.createElement('p'),
    week = document.createElement('div');
  title.textContent = `Hôm nay · ${Math.min(plan.done, plan.goal)}/${plan.goal} bài`;
  line.textContent = plan.items.length
    ? `${plan.due} bài cần ôn, ${fresh} bài mới. Chuỗi ${streak} ngày liên tiếp.`
    : 'Đã hết bài trong kế hoạch. Chọn “Làm bài mới” hoặc “Ôn bài cần nhớ” để luyện thêm.';
  week.className = 'week-dots';
  week.setAttribute('aria-label', '7 ngày gần nhất');
  for (const d of dots) {
    const i = document.createElement('i');
    i.className = `${d.on ? 'on' : ''} ${d.today ? 'today' : ''}`;
    i.title = d.day;
    week.append(i);
  }
  card.replaceChildren(title, line, week);
}

/** Strong/weak topic list; `onPick(topicStat)` runs when a topic row is clicked. */
export function renderTopics(box, stats, onPick) {
  box.replaceChildren();
  if (!stats.length) {
    const p = document.createElement('p');
    p.textContent = 'Chưa có dữ liệu. Làm vài bài để xem chủ đề nào cần luyện.';
    box.append(p);
    return;
  }
  for (const t of stats) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = `topic-row${t.weak ? ' weak' : ''}`;
    const head = document.createElement('span'),
      name = document.createElement('b'),
      num = document.createElement('small');
    name.textContent = t.topic;
    num.textContent = `${t.clean}/${t.total}${t.due ? ` · ${t.due} cần ôn` : ''}`;
    head.append(name, num);
    const bar = document.createElement('span'),
      fill = document.createElement('i');
    bar.className = 'topic-bar';
    fill.style.width = `${Math.round((100 * t.clean) / t.total)}%`;
    bar.append(fill);
    row.append(head, bar);
    row.onclick = () => onPick(t);
    box.append(row);
  }
}

/** Last ten post-game notes; links are only rendered for http(s) URLs. */
export function renderJournal(list, games) {
  list.replaceChildren();
  for (const game of [...games].reverse().slice(0, 10)) {
    const item = document.createElement('div');
    item.className = 'game-item';
    const date = document.createElement('small');
    date.textContent = game.date;
    const note = document.createElement('p');
    note.textContent = game.note;
    item.append(date, note);
    try {
      const url = new URL(game.url);
      if (['http:', 'https:'].includes(url.protocol)) {
        const link = document.createElement('a');
        link.href = url.href;
        link.textContent = 'Xem ván ↗';
        link.target = '_blank';
        link.rel = 'noopener';
        item.append(link);
      }
    } catch {
      // no or malformed URL on this note: show it without a link
    }
    list.append(item);
  }
}
