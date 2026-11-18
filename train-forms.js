// Form handlers of the training page: backup export/import and the post-game journal.
import { exportBackup, parseBackup } from './backup.js';

const EXTRA_KEYS = ['igo-progress', 'igo-current-lesson-v1'];
const MAX_BACKUP_BYTES = 2e6;

/** Other app data that travels with a backup. @param {Pick<Storage, 'getItem'>} [storage] */
export function collectExtras(storage = localStorage) {
  /** @type {Record<string, string>} */
  const extras = {};
  for (const key of EXTRA_KEYS) {
    try {
      const value = storage.getItem(key);
      if (value) extras[key] = value;
    } catch {
      // storage blocked: the backup simply omits these
    }
  }
  return extras;
}

/**
 * Valid when empty or an http(s) URL.
 * @param {string} url
 */
export function isAcceptableGameUrl(url) {
  if (!url) return true;
  try {
    return ['http:', 'https:'].includes(new URL(url).protocol);
  } catch {
    return false;
  }
}

/**
 * Wires the backup buttons.
 * @param {{ exportButton: HTMLElement, importInput: HTMLInputElement, status: HTMLElement,
 *   getStudy: () => any, getBankIds: () => string[], onImport: (result: any) => void }} o
 */
export function setupBackup({ exportButton, importInput, status, getStudy, getBankIds, onImport }) {
  exportButton.onclick = () => {
    const url = URL.createObjectURL(
      new Blob([exportBackup(getStudy(), collectExtras())], { type: 'application/json' })
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `igo-backup-${new Date().toLocaleDateString('sv-SE')}.json`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status.textContent = 'Đã xuất file sao lưu.';
  };
  importInput.onchange = async () => {
    const file = importInput.files?.[0];
    importInput.value = '';
    if (!file) return;
    if (file.size > MAX_BACKUP_BYTES) {
      status.textContent = 'File quá lớn để là bản sao lưu Igo.';
      return;
    }
    const result = parseBackup(await file.text(), getBankIds());
    if (!result.ok) {
      status.textContent = result.error;
      return;
    }
    try {
      localStorage.setItem('igo-study-v1-before-import', JSON.stringify(getStudy()));
      for (const [k, v] of Object.entries(result.extras))
        localStorage.setItem(k, /** @type {string} */ (v));
    } catch {
      // storage blocked: the import still applies for this session
    }
    onImport(result);
    status.textContent = `Đã nhập ${result.restored} bài${result.skipped ? `, bỏ qua ${result.skipped} bài không còn trong ngân hàng` : ''}. Tiến độ cũ được giữ ở khóa igo-study-v1-before-import.`;
  };
}

/**
 * Wires the journal form. `onAdd(entry)` returns whether the note could be stored on this device.
 * @param {{ form: HTMLFormElement, noteInput: HTMLTextAreaElement, urlInput: HTMLInputElement,
 *   status: HTMLElement, onAdd: (entry: { date: string, url: string, note: string }) => boolean }} o
 */
export function setupJournalForm({ form, noteInput, urlInput, status, onAdd }) {
  form.onsubmit = (event) => {
    event.preventDefault();
    const note = noteInput.value.trim();
    if (!note) return;
    const url = urlInput.value.trim();
    if (!isAcceptableGameUrl(url)) {
      status.textContent = 'Dùng link http hoặc https.';
      return;
    }
    const stored = onAdd({ date: new Date().toLocaleDateString('sv-SE'), url, note });
    form.reset();
    status.textContent = stored
      ? 'Đã lưu lỗi của ván tại máy.'
      : 'Đã giữ trong phiên này, chưa lưu được tại máy.';
  };
}
