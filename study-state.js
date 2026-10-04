const DAY = 86400000;
export const freshStudy = () => ({version:1,records:{},games:[]});
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
  const r=entry(state,id);r.solves++;
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
