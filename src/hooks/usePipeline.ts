import { useCallback, useEffect, useRef, useState } from "react";
import { saveHandoff, takeHandoff } from "../../lib/handoff";
import {
  FALLBACK_MODEL_ID,
  MODEL_SPECS,
  detectCapabilities,
  getStoredModelId,
  isModelCached,
  switchModel,
  type Capabilities,
  type ModelId
} from "../../lib/model-spec";
import type { ModelEvent } from "../../lib/process";

export type ItemState = "queued" | "processing" | "done" | "error";

export interface WorkItem {
  id: number;
  file: File;
  state: ItemState;
  processed?: File;
  error?: string;
}

export type Phase = "idle" | "acquiring" | "preparing" | "processing" | "done" | "error";

export interface Failure {
  stage: "acquiring" | "preparing" | "processing";
  message: string;
}

const STALL_MS = 45_000;
const RATE_WINDOW_MS = 4_000;

function messageOf(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Something went wrong while loading the model.";
}

/**
 * Owns the whole model + inference lifecycle so the page can describe exactly what is
 * happening. transformers.js is only ever pulled in through a dynamic `import()`,
 * which keeps ~700 KB out of the first paint.
 */
export function usePipeline() {
  // Read once, at first render, rather than in an effect: the handoff restore below can
  // start inference immediately, and it must not capture the wrong model in its closure.
  const [model] = useState<ModelId>(() =>
    typeof window === "undefined" ? FALLBACK_MODEL_ID : getStoredModelId()
  );
  const [capabilities, setCapabilities] = useState<Capabilities>({
    isWebGPUSupported: false,
    isIOS: false
  });
  const [items, setItems] = useState<WorkItem[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [bytes, setBytes] = useState<{ loaded: number; total: number } | null>(null);
  const [rate, setRate] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [cached, setCached] = useState(false);
  const [stalled, setStalled] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);

  const engine = useRef<Promise<typeof import("../../lib/process")> | null>(null);
  const modelLoaded = useRef(false);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const itemsRef = useRef<WorkItem[]>([]);
  const phaseRef = useRef<Phase>("idle");
  const nextId = useRef(1);
  const startedAt = useRef(0);
  const lastEventAt = useRef(0);
  const bytesRef = useRef<{ loaded: number; total: number } | null>(null);
  const samples = useRef<{ t: number; b: number }[]>([]);
  const frame = useRef(0);

  const loadEngine = useCallback(() => {
    engine.current ??= import("../../lib/process");
    return engine.current;
  }, []);

  const updatePhase = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  /**
   * The queue is drained in microtasks, which can run before React flushes a `setItems`
   * updater — so the ref has to be updated synchronously here, not inside the updater.
   * Otherwise a drop that arrives straight from `fetch()` enqueues an id nothing knows yet.
   */
  const commit = useCallback((updater: (prev: WorkItem[]) => WorkItem[]) => {
    itemsRef.current = updater(itemsRef.current);
    setItems(itemsRef.current);
  }, []);

  const patch = useCallback(
    (id: number, changes: Partial<WorkItem>) => {
      commit((prev) => prev.map((item) => (item.id === id ? { ...item, ...changes } : item)));
    },
    [commit]
  );

  /** Inference is serialized: one session, and phase updates never interleave. */
  const enqueue = useCallback((task: () => Promise<void>) => {
    const run = () => Promise.resolve(task()).catch((error) => console.error(error));
    queue.current = queue.current.then(run, run);
  }, []);

  const flush = useCallback(() => {
    frame.current = 0;
    const first = samples.current[0];
    const last = samples.current[samples.current.length - 1];
    if (first && last && last.t > first.t) {
      const bytesPerSecond = ((last.b - first.b) / (last.t - first.t)) * 1000;
      setRate(bytesPerSecond > 0 ? bytesPerSecond : null);
    }
    setBytes(bytesRef.current);
    setElapsedMs(performance.now() - startedAt.current);
  }, []);

  const onEvent = useCallback(
    (event: ModelEvent) => {
      const now = performance.now();
      lastEventAt.current = now;

      if (event.stage === "preparing") {
        bytesRef.current = null;
        setBytes(null);
        setRate(null);
        updatePhase("preparing");
        return;
      }

      updatePhase("acquiring");
      bytesRef.current = { loaded: event.loaded, total: event.total };
      samples.current.push({ t: now, b: event.loaded });
      while (
        samples.current.length > 2 &&
        now - samples.current[0].t > RATE_WINDOW_MS
      ) {
        samples.current.shift();
      }
      if (!frame.current) frame.current = requestAnimationFrame(flush);
    },
    [flush, updatePhase]
  );

  const ensureModel = useCallback(async () => {
    if (modelLoaded.current) return;
    const engineModule = await loadEngine();
    bytesRef.current = null;
    samples.current = [];
    setBytes(null);
    setRate(null);
    setStalled(false);
    lastEventAt.current = performance.now();
    updatePhase("acquiring");

    if (!(await engineModule.initializeModel(model, onEvent))) {
      throw new Error("The background removal model could not be started.");
    }
    modelLoaded.current = true;
    setCached(true);
  }, [loadEngine, model, onEvent, updatePhase]);

  const processOne = useCallback(
    async (id: number) => {
      const item = itemsRef.current.find((candidate) => candidate.id === id);
      if (!item) return;
      updatePhase("processing");
      patch(id, { state: "processing", error: undefined });
      try {
        const engineModule = await loadEngine();
        const processed = await engineModule.processImage(item.file);
        patch(id, { state: "done", processed });
      } catch (error) {
        patch(id, { state: "error", error: messageOf(error) });
      }
    },
    [loadEngine, patch, updatePhase]
  );

  /** Runs the model once, then every remaining unfinished item. */
  const runOver = useCallback(
    async (ids: number[]) => {
      try {
        await ensureModel();
      } catch (error) {
        updatePhase("error");
        setFailure({ stage: "acquiring", message: messageOf(error) });
        // The dropped files stay in the list as `queued` — a failed download must not
        // also throw away the work the user just did to pick them.
        return;
      }
      for (const id of ids) await processOne(id);
      if (phaseRef.current !== "error") {
        updatePhase("done");
        setElapsedMs(performance.now() - startedAt.current);
      }
    },
    [ensureModel, processOne, updatePhase]
  );

  const addFiles = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;
      const fresh = files.map((file) => ({
        id: nextId.current++,
        file,
        state: "queued" as const
      }));
      commit((prev) => [...prev, ...fresh]);
      setFailure(null);
      if (!startedAt.current) startedAt.current = performance.now();
      const ids = fresh.map((item) => item.id);
      enqueue(() => runOver(ids));
    },
    [commit, enqueue, runOver]
  );

  const retry = useCallback(
    (id?: number) => {
      if (!startedAt.current) startedAt.current = performance.now();
      setFailure(null);
      const ids =
        id !== undefined
          ? [id]
          : itemsRef.current.filter((item) => item.state !== "done").map((item) => item.id);
      enqueue(() => runOver(ids));
    },
    [enqueue, runOver]
  );

  const removeItem = useCallback(
    (id: number) => {
      commit((prev) => prev.filter((item) => item.id !== id));
    },
    [commit]
  );

  const clear = useCallback(() => {
    commit(() => []);
    updatePhase("idle");
    setFailure(null);
    setBytes(null);
    startedAt.current = 0;
    setElapsedMs(0);
  }, [commit, updatePhase]);

  /**
   * Snapshots the work, then reloads onto the other model. Refuses to reload if the
   * snapshot could not be written — dropping the queue is worse than not switching.
   */
  const switchTo = useCallback(
    async (next: ModelId): Promise<"switched" | "blocked"> => {
      if (next === model) return "switched";
      const queued = itemsRef.current;
      if (queued.length > 0) {
        try {
          await saveHandoff({
            targetModel: next,
            savedAt: Date.now(),
            items: queued.map((item) => ({
              id: item.id,
              // A cut that was mid-flight never finished, so it comes back as pending.
              state: item.state === "processing" ? "queued" : item.state,
              file: item.file,
              processed: item.processed,
              error: item.error
            }))
          });
        } catch (error) {
          console.error(error);
          return "blocked";
        }
      }
      switchModel(next);
      return "switched";
    },
    [model]
  );

  useEffect(() => {
    setCapabilities(detectCapabilities());
  }, []);

  // A model switch reloads the page; this picks the queue back up on the other side.
  // Everything is re-cut by the new model — that is the reason people switch — but the
  // previous cut-out stays under the "waiting" chip until the new one replaces it.
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    let cancelled = false;
    takeHandoff()
      .then((handoff) => {
        if (cancelled || !handoff || handoff.targetModel !== model || handoff.items.length === 0) return;
        const carried: WorkItem[] = handoff.items.map((item) => ({
          id: item.id,
          file: item.file,
          state: "queued",
          processed: item.processed,
          error: undefined
        }));
        nextId.current = carried.reduce((max, item) => Math.max(max, item.id + 1), 1);
        commit(() => carried);
        startedAt.current = performance.now();
        enqueue(() => runOver(carried.map((item) => item.id)));
      })
      .catch(() => {
        // Private mode, no quota, or nothing pending: the visit simply starts empty.
      });
    return () => {
      cancelled = true;
    };
  }, [commit, enqueue, model, runOver]);

  useEffect(() => {
    if (modelLoaded.current) return;
    let cancelled = false;
    isModelCached(model).then((hit) => {
      if (!cancelled && !modelLoaded.current) setCached(hit);
    });
    return () => {
      cancelled = true;
    };
  }, [model]);

  // A download that has not reported a byte in 45 s is not "slow but fine" — say so
  // and let the visitor decide, instead of a spinner that never resolves.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (
        phaseRef.current === "acquiring" &&
        performance.now() - lastEventAt.current > STALL_MS
      ) {
        setStalled(true);
      }
    }, 2000);
    return () => window.clearInterval(timer);
  }, []);

  const spec = MODEL_SPECS[model];
  const remaining = bytes && rate ? (bytes.total - bytes.loaded) / rate : null;
  const counts = items.reduce(
    (acc, item) => ({ ...acc, [item.state]: (acc[item.state] ?? 0) + 1 }),
    {} as Record<ItemState, number>
  );

  return {
    model,
    spec,
    capabilities,
    items,
    counts,
    phase,
    bytes,
    rate,
    remainingSeconds: remaining,
    elapsedMs,
    cached,
    stalled,
    failure,
    busy: phase === "acquiring" || phase === "preparing" || phase === "processing",
    addFiles,
    retry,
    removeItem,
    clear,
    switchTo
  };
}
