import { useState } from "react";
import { FALLBACK_MODEL_ID, MODEL_SPECS, WEBGPU_MODEL_ID, type ModelId } from "../../lib/model-spec";
import { formatMib } from "../format";
import type { usePipeline } from "../hooks/usePipeline";
import { Chip } from "./ui";

const OPTIONS: { id: ModelId; name: string; note: string }[] = [
  { id: FALLBACK_MODEL_ID, name: "RMBG-1.4", note: "runs in every modern browser" },
  { id: WEBGPU_MODEL_ID, name: "MODNet", note: "smaller and faster, but needs WebGPU" }
];

/**
 * Segmented control instead of a `<select>` so the two models can carry their real
 * trade-off (size, and that MODNet is a portrait matting model) instead of a label.
 */
export function ModelPicker({ pipeline }: { pipeline: ReturnType<typeof usePipeline> }) {
  const { model, capabilities, items, switchTo } = pipeline;
  const [pendingSwitch, setPendingSwitch] = useState<ModelId | null>(null);
  const [blocked, setBlocked] = useState(false);

  const nameOf = (id: ModelId) => OPTIONS.find((option) => option.id === id)?.name ?? id;

  const choose = (next: ModelId) => {
    if (next === model) return;
    setBlocked(false);
    // Switching cannot be done in place: onnxruntime-web cannot reset `wasm.proxy` once a
    // session exists, so the page reloads. `switchTo` hands the queue to IndexedDB first.
    if (items.length > 0) setPendingSwitch(next);
    else void switchTo(next);
  };

  const confirmSwitch = async () => {
    if (!pendingSwitch) return;
    if ((await switchTo(pendingSwitch)) === "blocked") setBlocked(true);
  };

  const selected = OPTIONS.find((option) => option.id === model);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="label">Model</p>
        {capabilities.isIOS && <Chip tone="warn">iOS · WASM only</Chip>}
      </div>

      <div
        role="radiogroup"
        aria-label="Background removal model"
        className="mt-2 grid grid-cols-2 gap-2"
      >
        {OPTIONS.map((option) => {
          const active = option.id === model;
          const requiresWebGPU = option.id === WEBGPU_MODEL_ID && !capabilities.isWebGPUSupported;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={requiresWebGPU}
              onClick={() => choose(option.id)}
              title={requiresWebGPU ? "This browser has no WebGPU support" : undefined}
              className={`rounded-md px-3 py-2.5 text-left ring-1 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                active
                  ? "bg-ink-700 ring-lime/40 shadow-accent"
                  : "bg-ink-900 ring-line hover:bg-ink-800"
              }`}
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-sm text-paper">{option.name}</span>
                <span className="readout text-xs text-mute">
                  {formatMib(MODEL_SPECS[option.id].bytes)}
                </span>
              </span>
              <span className="mt-1 block text-xs text-mute">
                {requiresWebGPU ? "unavailable here" : option.note}
              </span>
            </button>
          );
        })}
      </div>

      {selected && (
        <p className="mt-2 text-xs text-mute">
          {model === WEBGPU_MODEL_ID
            ? "MODNet is trained for people — it is excellent on portraits and weaker on products and text."
            : "RMBG-1.4 is the general-purpose matting model: better on objects, larger to fetch once."}
        </p>
      )}

      {pendingSwitch && (
        <div className="mt-3 rounded-md bg-ink-900 px-4 py-3 ring-1 ring-line">
          <p className="text-sm text-paper">
            Switch to {nameOf(pendingSwitch)}? This reloads the page and re-cuts the{" "}
            {items.length} image{items.length === 1 ? "" : "s"} here with the new model.
          </p>
          {blocked && (
            <p className="mt-2 text-xs text-coral">
              This browser is not allowing local storage, so nothing could be carried across the
              reload. Cancel, download what you need, then switch.
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={confirmSwitch}
              disabled={blocked}
              className="btn-primary px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40"
            >
              Switch model
            </button>
            <button
              type="button"
              onClick={() => {
                setPendingSwitch(null);
                setBlocked(false);
              }}
              className="btn-ghost px-3 py-1.5 text-xs"
            >
              Keep {selected?.name}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
