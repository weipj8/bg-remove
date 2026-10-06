import type { ModelId } from "./model-spec";

/**
 * A model switch cannot happen in place (see `switchModel`), and reloading would throw
 * away everything the visitor just dropped. `File` is structured-cloneable, so IndexedDB
 * can carry the real objects — including finished cut-outs — across the reload.
 * `sessionStorage` cannot: it stringifies, and a `File` becomes `{}`.
 */
const DB_NAME = "bg-remove-handoff";
const STORE = "handoff";
const KEY = "pending";

/** A handoff that outlived a crash is not worth restoring; it is also stale work. */
const MAX_AGE_MS = 10 * 60 * 1000;

export type HandoffState = "queued" | "done" | "error";

export interface HandoffItem {
  id: number;
  state: HandoffState;
  file: File;
  processed?: File;
  error?: string;
}

export interface Handoff {
  targetModel: ModelId;
  savedAt: number;
  items: HandoffItem[];
}

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("IndexedDB is unavailable."));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open the handoff store."));
  });
}

async function transact<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = run(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("The handoff store failed."));
    });
  } finally {
    db.close();
  }
}

export function saveHandoff(handoff: Handoff): Promise<void> {
  return transact("readwrite", (store) => store.put(handoff, KEY)).then(() => undefined);
}

/**
 * Reads and deletes in one transaction, so a handoff can never be applied twice and a
 * record for a switch that never happened cannot linger.
 */
export async function takeHandoff(): Promise<Handoff | null> {
  const handoff = await transact<Handoff | undefined>("readwrite", (store) => {
    const request = store.get(KEY);
    store.delete(KEY);
    return request;
  });
  if (!handoff) return null;
  return Date.now() - handoff.savedAt > MAX_AGE_MS ? null : handoff;
}
