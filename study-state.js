const DAY = 86400000;
export const DEFAULT_GOAL = 5;
export const freshStudy = () => ({version:1,records:{},games:[],activity:{},goal:DEFAULT_GOAL});
const integer = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
export function restoreStudy(raw, validIds) {
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.version !== 1 || !parsed.records || typeof parsed.records !== 'object') return freshStudy();
    const state = freshStudy();
    for (const id of validIds) {
      const r = parsed.records[id];
      if (!r || typeof r !== 'object') continue;
      state.records[id] = {
        attempts:integer(r.attempts),solves:integer(r.solves),clean:integer(r.clean),misses:integer(r.misses),
        streak:integer(r.streak),due:integer(r.due),lastCleanDay:typeof r.lastCleanDay==='string'?r.lastCleanDay:null,
        lastResult:['clean','assisted','wrong'].includes(r.lastResult)?r.lastResult:'wrong',
        revealedDay:typeof r.revealedDay==='string'?r.revealedDay:null
      };
    }
    if (Array.isArray(parsed.games)) state.games = parsed.games.slice(-100).filter(g=>g&&typeof g.note==='string'&&typeof g.date==='string').map(g=>({date:g.date.slice(0,10),url:typeof g.url==='string'?g.url.slice(0,500):'',note:g.note.slice(0,1000),stage:typeof g.stage==='string'?g.stage:''}));
    if (parsed.activity && typeof parsed.activity === 'object' && !Array.isArray(parsed.activity)) {
      const days = Object.keys(parsed.activity).filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k) && integer(parsed.activity[k])).sort().slice(-90);
      for (const k of days) state.activity[k] = integer(parsed.activity[k]);
    }
    if (Number.isSafeInteger(parsed.goal) && parsed.goal >= 1 && parsed.goal <= 50) state.goal = parsed.goal;
    return state;
  } catch { return freshStudy(); }
}
export function entry(state,id) {
  return state.records[id] ||= {attempts:0,solves:0,clean:0,misses:0,streak:0,due:0,lastCleanDay:null,lastResult:'wrong',revealedDay:null};
}
export function beginAttempt(state,id) { entry(state,id).attempts++; }
export function recordMiss(state,id,now=Date.now()) {
  const r=entry(state,id);r.misses++;r.streak=0;r.lastCleanDay=null;r.due=now;r.lastResult='wrong';
}
function localDay(now) { const d=new Date(now);return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`; }
export function reveal(state,id,now=Date.now()) { entry(state,id).revealedDay=localDay(now); }
export function eligibleClean(state,id,now=Date.now()) { return state.records[id]?.revealedDay!==localDay(now); }
export function recordSolve(state,id,clean,now=Date.now()) {
  const r=entry(state,id);r.solves++;countActivity(state,now);
  if(clean){r.clean++;const today=localDay(now);if(r.lastCleanDay!==today){r.streak++;r.lastCleanDay=today;}r.lastResult='clean';}
  else if(r.lastCleanDay===localDay(now)){return;}
  else{r.streak=0;r.lastCleanDay=null;r.lastResult='assisted';}
  const days=clean?[1,3,7,14,30][Math.min(Math.max(r.streak-1,0),4)]:1;
  r.due=now+days*DAY;
}
export function needsReview(record, now=Date.now()) { return !!record && (record.lastResult==='wrong'||record.due<=now); }
export function studyStats(bank,state,now=Date.now()) {
  return {
    total:bank.length,solved:bank.filter(p=>state.records[p.id]?.solves>0).length,
    clean:bank.filter(p=>state.records[p.id]?.clean>0).length,
    retained:bank.filter(p=>state.records[p.id]?.streak>=2).length,
    due:bank.filter(p=>needsReview(state.records[p.id],now)).length
  };
}

// Activity: solved problems per local calendar day (zero-padded so keys sort), capped to 90 days.
export const isoDay = (now = Date.now()) => { const d = new Date(now); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
export function countActivity(state, now = Date.now()) {
  state.activity ||= {};
  const day = isoDay(now);
  state.activity[day] = integer(state.activity[day]) + 1;
  for (const k of Object.keys(state.activity).sort().slice(0, -90)) delete state.activity[k];
}
export const todayCount = (state, now = Date.now()) => integer(state.activity?.[isoDay(now)]);
// Consecutive active days ending today; a quiet today does not break a streak that ended yesterday.
export function streakDays(state, now = Date.now()) {
  let count = 0, t = now;
  if (!state.activity?.[isoDay(t)]) t -= DAY;
  while (state.activity?.[isoDay(t)]) { count++; t -= DAY; }
  return count;
}
export function weekDots(state, now = Date.now()) {
  return Array.from({ length: 7 }, (_, i) => { const t = now - (6 - i) * DAY; return { day: isoDay(t), on: !!state.activity?.[isoDay(t)], today: i === 6 }; });
}
// Four states: new (never solved), solved (with help or not yet repeated), retained (clean on 2+ days), due (needs review).
export function problemStatus(record, now = Date.now()) {
  if (!record || !record.attempts) return 'new';
  if (needsReview(record, now)) return 'due';
  if (record.streak >= 2) return 'retained';
  return record.solves > 0 ? 'solved' : 'new';
}
// Topic mastery over problems that were attempted at least once; `weak` flags a low clean rate with enough data.
export function topicStats(bank, state, now = Date.now()) {
  const map = new Map();
  for (const p of bank) {
    const t = map.get(p.topic) || { topic: p.topic, total: 0, clean: 0, due: 0, attempted: 0, misses: 0 };
    const r = state.records[p.id];
    t.total++;
    if (r?.clean > 0) t.clean++;
    if (r?.attempts) { t.attempted++; t.misses += r.misses; }
    if (needsReview(r, now)) t.due++;
    map.set(p.topic, t);
  }
  return [...map.values()].map(t => ({ ...t, weak: t.attempted >= 3 && (t.due >= 2 || t.misses / t.attempted >= 0.5) })).sort((a, b) => Number(b.weak) - Number(a.weak) || b.due - a.due || a.topic.localeCompare(b.topic, 'vi'));
}
// Today's plan: due reviews first (oldest first, max 3), then fresh problems in curriculum order until the daily goal.
export function dailyPlan(bank, state, now = Date.now(), stageOrder = []) {
  const goal = state.goal || DEFAULT_GOAL;
  const rank = id => { const i = stageOrder.indexOf(id); return i < 0 ? 99 : i; };
  const due = bank.filter(p => needsReview(state.records[p.id], now)).sort((a, b) => state.records[a.id].due - state.records[b.id].due).slice(0, Math.min(3, goal));
  const taken = new Set(due.map(p => p.id));
  const fresh = bank.filter(p => !state.records[p.id]?.attempts && !taken.has(p.id)).sort((a, b) => rank(a.stage) - rank(b.stage));
  const items = [...due, ...fresh.slice(0, Math.max(goal - due.length, 0))];
  return { goal, done: todayCount(state, now), due: due.length, items };
}
