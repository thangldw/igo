// Browser-storage access for the lesson page. Every call tolerates unavailable storage
// (private mode, blocked site data) and falls back to in-memory behaviour.
const PROGRESS_KEY = 'igo-progress';
const LESSON_KEY = 'igo-current-lesson-v1';

/** @param {string} key */
function read(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null; // storage blocked or unavailable
  }
}
/**
 * @param {string} key
 * @param {string} value
 */
function write(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false; // storage blocked, or quota exceeded
  }
}

/** Completed lesson ids; migrates the legacy numeric ids and drops unknown ones. */
/** @param {Array<{ id: string }>} lessons */
export function loadProgress(lessons) {
  try {
    const stored = JSON.parse(read(PROGRESS_KEY) || '[]');
    if (!Array.isArray(stored)) return [];
    return [
      ...new Set(
        stored
          .map((x) => (Number.isInteger(x) ? `beginner-${x}` : x))
          .filter((x) => lessons.some((l) => l.id === x))
      ),
    ];
  } catch {
    return []; // corrupt JSON: start fresh rather than crash
  }
}
/** @param {string[]} done */
export const saveProgress = (done) => write(PROGRESS_KEY, JSON.stringify(done));

export const loadLessonId = () => read(LESSON_KEY);
/** @param {string} id */
export const saveLessonId = (id) => write(LESSON_KEY, id);

/** Raw stored value for a key (used for saved games). */
export const readItem = read;
export const writeItem = write;
