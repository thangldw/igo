// Loading and saving the study state in browser storage, tolerating blocked or incompatible data.
import { restoreStudy } from './study-state.js';

/** @typedef {Pick<Storage, 'getItem' | 'setItem'>} StorageLike */

/**
 * Reads the saved study state.
 * `available` is false when storage cannot be read; `writable` is false when saved data exists
 * but is from an incompatible version, in which case it must not be overwritten.
 * @param {string} key @param {Iterable<string>} validIds @param {StorageLike} [storage]
 */
export function loadStudy(key, validIds, storage = localStorage) {
  let stored = null,
    available = true,
    writable = true;
  try {
    stored = storage.getItem(key);
  } catch {
    available = false; // storage blocked: run in memory
  }
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (
        parsed?.version !== 1 ||
        !parsed.records ||
        typeof parsed.records !== 'object' ||
        Array.isArray(parsed.records)
      )
        writable = available = false;
    } catch {
      writable = available = false; // corrupt JSON: keep it untouched
    }
  }
  return { study: restoreStudy(stored, validIds), available, writable };
}

/**
 * Writes the study state. Returns false when storage rejects the write.
 * @param {string} key @param {unknown} study @param {StorageLike} [storage]
 */
export function saveStudy(key, study, storage = localStorage) {
  try {
    storage.setItem(key, JSON.stringify(study));
    return true;
  } catch {
    return false; // storage blocked or full
  }
}
