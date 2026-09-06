// Tiny pub/sub so screens re-query the local DB after it changes (e.g. a sync).

type Listener = () => void;

let version = 0;
const listeners = new Set<Listener>();

/** Notify subscribers that stored data changed. */
export function bumpData(): void {
  version++;
  for (const l of listeners) l();
}

export function dataVersion(): number {
  return version;
}

export function subscribeData(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
