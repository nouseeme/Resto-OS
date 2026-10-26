// An event received during a fetch must cause a second read, not get discarded.
export function createRefreshQueue(run) {
  let running = null;
  let pending = false;
  return function request() {
    pending = true;
    if (!running) running = (async () => {
      let result;
      try { while (pending) { pending = false; result = await run(); } return result; }
      finally { running = null; }
    })();
    return running;
  };
}
