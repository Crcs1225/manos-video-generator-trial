export function abortableWait<T>(pending: Promise<T>, signal?: AbortSignal, timeoutMs = 30000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const abort = () => finish(new Error("Rendering canceled."));
    const timer = setTimeout(() => finish(new Error("Video engine loading timed out. Please retry.")), timeoutMs);
    function finish(error?: Error, value?: T) {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      if (error) reject(error); else resolve(value as T);
    }
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    pending.then((value) => finish(undefined, value), (error) => finish(error));
  });
}
