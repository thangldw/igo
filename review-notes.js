// Validation of the saved per-position notes in the SGF review page.

/** @typedef {{ move: number, path: number[], candidates: string, refutation: string, conclusion: string }} ReviewNote */
export const NOTE_FIELDS = ['candidates', 'refutation', 'conclusion'];
const MAX_NOTE_LENGTH = 2000;

/**
 * True when `value` is a map from JSON-encoded variation path to a well-formed note.
 * Untrusted data from storage or a file, so every field is checked.
 * @param {any} value
 * @returns {boolean}
 */
export function validNotes(value) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.entries(value).every(([key, n]) => {
      try {
        const path = JSON.parse(key);
        return (
          Array.isArray(path) &&
          path.every((x) => Number.isInteger(x) && x >= 0) &&
          n &&
          Number.isInteger(n.move) &&
          NOTE_FIELDS.every((id) => typeof n[id] === 'string' && n[id].length <= MAX_NOTE_LENGTH) &&
          JSON.stringify(n.path) === key
        );
      } catch {
        return false; // key is not JSON
      }
    })
  );
}
