// Request/response client for reading-worker.js. Each request resolves with the worker's reply,
// `{ status: 'cancelled' }` after reset(), or `{ status: 'unknown' }` if the worker crashes.
export function createReadingClient() {
  let worker = null,
    nextId = 0;
  const pending = new Map();

  function reset() {
    worker?.terminate();
    worker = null;
    for (const resolve of pending.values()) resolve({ status: 'cancelled' });
    pending.clear();
  }

  function ensureWorker() {
    if (worker) return worker;
    const created = new Worker(new URL('./reading-worker.js', import.meta.url), { type: 'module' });
    created.onmessage = ({ data }) => {
      const resolve = pending.get(data.id);
      if (resolve) {
        pending.delete(data.id);
        resolve(data);
      }
    };
    created.onerror = () => {
      for (const resolve of pending.values()) resolve({ status: 'unknown' });
      pending.clear();
      created.terminate();
      if (worker === created) worker = null;
    };
    worker = created;
    return created;
  }

  /** @param {object} payload fields sent to the worker alongside the generated request id */
  function ask(payload) {
    const target = ensureWorker();
    return new Promise((resolve) => {
      const id = ++nextId;
      pending.set(id, resolve);
      target.postMessage({ id, ...payload });
    });
  }

  return { ask, reset };
}
