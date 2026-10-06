import manifest from "../src/generated/model-manifest.json";

export const WEBGPU_MODEL_ID = "Xenova/modnet";
export const FALLBACK_MODEL_ID = "briaai/RMBG-1.4";

export type ModelId = typeof WEBGPU_MODEL_ID | typeof FALLBACK_MODEL_ID;

export interface ModelSpec {
  /** Relative to the site origin, which is also this file's `transformers-cache` key. */
  path: string;
  /** The filename transformers.js reports in `progress_callback`. */
  file: string;
  bytes: number;
}

// Written by scripts/gen-model-manifest.mjs from the committed weights, and spelled
// out per repo rather than looked up dynamically: adding a model has to be a build
// failure here, not a progress bar whose denominator is the wrong file.
export const MODEL_SPECS: Record<ModelId, ModelSpec> = {
  [FALLBACK_MODEL_ID]: manifest["briaai/RMBG-1.4"],
  [WEBGPU_MODEL_ID]: manifest["Xenova/modnet"],
};

export interface Capabilities {
  isWebGPUSupported: boolean;
  isIOS: boolean;
}

/**
 * Deliberately does not live in `lib/process.ts`: the page needs these facts on first
 * paint to describe the models, and importing the engine there would drag
 * transformers.js (~700 KB) back into the initial chunk.
 */
export function detectCapabilities(): Capabilities {
  const touchOnMac =
    navigator.userAgent.includes("Mac") && "ontouchend" in document;
  return {
    // `gpu` is still missing from the DOM lib types; feature detection is the whole point.
    isWebGPUSupported: Boolean((navigator as Navigator & { gpu?: unknown }).gpu),
    isIOS:
      ["iPad Simulator", "iPhone Simulator", "iPod Simulator", "iPad", "iPhone", "iPod"].includes(
        navigator.platform
      ) || touchOnMac,
  };
}

/** Whether the weight is already in the Cache API, so the visit needs no download. */
export async function isModelCached(modelId: ModelId): Promise<boolean> {
  if (typeof caches === "undefined") return false;
  try {
    const cache = await caches.open("transformers-cache");
    return (await cache.match(MODEL_SPECS[modelId].path)) !== undefined;
  } catch {
    // Private mode / iframe restrictions: treat as cold rather than claim a lie.
    return false;
  }
}

const MODEL_CHOICE_KEY = "bg-remove:model";

export function getStoredModelId(): ModelId {
  return localStorage.getItem(MODEL_CHOICE_KEY) === WEBGPU_MODEL_ID
    ? WEBGPU_MODEL_ID
    : FALLBACK_MODEL_ID;
}

/**
 * onnxruntime-web cannot change `wasm.proxy` once a session exists, so the WASM and
 * WebGPU backends cannot coexist in one page. Reloading lets the requested model be
 * the first session created, which is the only order that initialises cleanly.
 */
export function switchModel(modelId: ModelId): void {
  localStorage.setItem(MODEL_CHOICE_KEY, modelId);
  window.location.reload();
}
