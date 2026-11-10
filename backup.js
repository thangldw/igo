import {restoreStudy} from './study-state.js';
// Portable backup of study progress. The envelope is versioned; the study payload goes through restoreStudy
// so unknown problem ids and malformed fields are dropped exactly as they are on a normal load.
export const BACKUP_KIND = 'igo-backup';
export function exportBackup(study, extras = {}, now = new Date()) {
  return JSON.stringify({ kind: BACKUP_KIND, version: 1, exportedAt: now.toISOString(), study, extras }, null, 2);
}
export function parseBackup(text, validIds) {
  let data;
  try { data = JSON.parse(text); } catch { return { ok: false, error: 'File không phải JSON hợp lệ.' }; }
  const payload = data?.kind === BACKUP_KIND ? data.study : data?.version === 1 && data.records ? data : null; // also accept a raw igo-study-v1 dump
  if (!payload || payload.version !== 1 || typeof payload.records !== 'object' || Array.isArray(payload.records)) return { ok: false, error: 'Không phải file sao lưu tiến độ Igo.' };
  const study = restoreStudy(JSON.stringify(payload), validIds);
  const extras = {};
  if (data.extras && typeof data.extras === 'object') for (const [k, v] of Object.entries(data.extras)) if (/^igo-[\w-]+$/.test(k) && typeof v === 'string' && v.length < 200000) extras[k] = v;
  return { ok: true, study, extras, restored: Object.keys(study.records).length, skipped: Object.keys(payload.records).length - Object.keys(study.records).length };
}
