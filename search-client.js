// Runs one search-worker request at a time. Starting a new request cancels the previous one.
// run() resolves with the worker's final message (which may carry `error`), with
// { cancelled: true } if superseded or cancelled, and rejects if the worker fails to load.
export function createSearchClient(url = './search-worker.js') {
  /** @type {Worker | null} */
  let worker = null,
    /** @type {{ resolve: (value: any) => void } | null} */ // resolves with the worker's untyped reply
    settle = null;

  function cancel() {
    worker?.terminate();
    worker = null;
    const pending = settle;
    settle = null;
    pending?.resolve({ cancelled: true });
  }

  /** @param {object} message @param {{ onProgress?: (data: any) => void }} [options] */
  function run(message, { onProgress } = {}) {
    cancel();
    const mine = new Worker(url, { type: 'module' });
    worker = mine;
    return new Promise((resolve, reject) => {
      /** @param {(value: any) => void} fn @param {any} value */
      const finish = (fn, value) => {
        if (worker !== mine) return;
        mine.terminate();
        worker = null;
        settle = null;
        fn(value);
      };
      settle = { resolve };
      mine.onmessage = ({ data }) => {
        if (worker !== mine) return;
        if (data.progress) onProgress?.(data);
        else finish(resolve, data);
      };
      mine.onerror = (event) => finish(reject, new Error(event.message || 'worker error'));
      mine.postMessage(message);
    });
  }

  return { run, cancel };
}
