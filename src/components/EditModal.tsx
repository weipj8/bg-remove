import { useEffect, useRef, useState, type ReactNode } from "react";
import type { WorkItem } from "../hooks/usePipeline";
import { IconClose, IconDownload } from "./ui";

interface EditModalProps {
  item: WorkItem;
  /** Object URL of the cut-out, owned by the card so it is created once. */
  sourceUrl: string | null;
  onClose: () => void;
  onSave: (dataUrl: string) => void;
}

const BACKGROUND_COLORS = [
  "#FFFFFF",
  "#0E1216",
  "#EDEFF2",
  "#C4F135",
  "#FF6B5E",
  "#2A343E",
  "#7BE3D2",
  "#FFC44D"
];

const EFFECTS = [
  { id: "none", label: "None" },
  { id: "blur", label: "Blur" },
  { id: "brightness", label: "Bright" },
  { id: "contrast", label: "Contrast" }
] as const;

type EffectId = (typeof EFFECTS)[number]["id"];

export function EditModal({ item, sourceUrl, onClose, onSave }: EditModalProps) {
  const [useColor, setUseColor] = useState(true);
  const [bgColor, setBgColor] = useState("#FFFFFF");
  const [bgImage, setBgImage] = useState<File | null>(null);
  const [effect, setEffect] = useState<EffectId>("none");
  const [amount, setAmount] = useState(50);
  const [exportUrl, setExportUrl] = useState("");
  const [ready, setReady] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (!sourceUrl) return;
    const url = sourceUrl;
    let cancelled = false;
    setReady(false);

    // Composing writes a full-size PNG data URL, so it lives in one effect rather than a
    // callback: the dependency list below *is* the set of things that can change the result.
    async function compose() {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const img = new Image();
      img.src = url;
      try {
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = () => reject(new Error("Could not decode the cut-out"));
        });
      } catch {
        return;
      }

      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;

      if (useColor) {
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else if (bgImage) {
        const layerUrl = URL.createObjectURL(bgImage);
        const layer = new Image();
        layer.src = layerUrl;
        try {
          await new Promise((resolve, reject) => {
            layer.onload = resolve;
            layer.onerror = () => reject(new Error("Could not decode the background image"));
          });
          ctx.drawImage(layer, 0, 0, canvas.width, canvas.height);
        } catch {
          /* Fall back to transparency rather than blocking the composite. */
        } finally {
          URL.revokeObjectURL(layerUrl);
        }
      }

      ctx.drawImage(img, 0, 0);

      if (effect === "blur") {
        const temp = document.createElement("canvas");
        const tempCtx = temp.getContext("2d");
        if (!tempCtx) return;
        temp.width = canvas.width;
        temp.height = canvas.height;
        tempCtx.drawImage(canvas, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.filter = `blur(${amount / 10}px)`;
        ctx.drawImage(temp, 0, 0);
        ctx.filter = "none";
      } else if (effect !== "none") {
        const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = frame.data;
        const scale = amount / 50;
        const factor = (259 * (amount + 255)) / (255 * (259 - amount));
        for (let i = 0; i < data.length; i += 4) {
          if (effect === "brightness") {
            data[i] = Math.min(255, data[i] * scale);
            data[i + 1] = Math.min(255, data[i + 1] * scale);
            data[i + 2] = Math.min(255, data[i + 2] * scale);
          } else {
            data[i] = factor * (data[i] - 128) + 128;
            data[i + 1] = factor * (data[i + 1] - 128) + 128;
            data[i + 2] = factor * (data[i + 2] - 128) + 128;
          }
        }
        ctx.putImageData(frame, 0, 0);
      }

      if (cancelled) return;
      setExportUrl(canvas.toDataURL("image/png"));
      setReady(true);
    }

    void compose();
    return () => {
      cancelled = true;
    };
  }, [sourceUrl, useColor, bgColor, bgImage, effect, amount]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Composite a background for ${item.file.name}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/80 p-4 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-ink-800 shadow-raised">
        <header className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 className="font-display text-xl">Composite a background</h2>
            <p className="readout mt-1 truncate text-xs text-mute">{item.file.name}</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close editor"
            className="btn-ghost px-2 py-1"
          >
            <IconClose className="h-4 w-4" />
          </button>
        </header>

        <div className="grid gap-6 p-5 md:grid-cols-2">
          <div className="space-y-6">
            <div>
              <p className="label mb-2">Background</p>
              <div className="mb-3 grid grid-cols-2 gap-2">
                <ToggleButton active={useColor} onClick={() => setUseColor(true)}>
                  Solid
                </ToggleButton>
                <ToggleButton active={!useColor} onClick={() => setUseColor(false)}>
                  Image
                </ToggleButton>
              </div>

              {useColor ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    {BACKGROUND_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setBgColor(color)}
                        aria-label={`Use ${color}`}
                        className={`h-8 w-8 rounded-sm transition-shadow ${
                          bgColor === color
                            ? "ring-2 ring-lime ring-offset-2 ring-offset-ink-800"
                            : "ring-1 ring-line hover:ring-mute"
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <label className="readout mt-4 flex items-center gap-2 text-xs text-mute">
                    Custom
                    <input
                      type="color"
                      value={bgColor}
                      onChange={(event) => setBgColor(event.target.value)}
                      aria-label="Custom background colour"
                      className="h-8 w-12"
                    />
                    <span className="text-paper">{bgColor.toUpperCase()}</span>
                  </label>
                </>
              ) : (
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  aria-label="Background image"
                  onChange={(event) => setBgImage(event.target.files?.[0] ?? null)}
                  className="readout w-full text-xs text-mute file:mr-3 file:rounded-sm file:bg-ink-700 file:px-3 file:py-1.5 file:text-paper file:ring-1 file:ring-line"
                />
              )}
            </div>

            <div>
              <p className="label mb-2">Effect</p>
              <div className="grid grid-cols-4 gap-2">
                {EFFECTS.map((option) => (
                  <ToggleButton
                    key={option.id}
                    active={effect === option.id}
                    onClick={() => setEffect(option.id)}
                  >
                    {option.label}
                  </ToggleButton>
                ))}
              </div>
              {effect !== "none" && (
                <div className="mt-4">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={amount}
                    onChange={(event) => setAmount(Number(event.target.value))}
                    className="slider w-full"
                    aria-label={`Effect strength for ${effect}`}
                  />
                  <div className="readout mt-2 flex justify-between text-xs text-mute">
                    <span>soft</span>
                    <span className="text-paper">{amount}</span>
                    <span>strong</span>
                  </div>
                </div>
              )}
            </div>

            <p className="text-xs leading-relaxed text-mute">
              Effects apply to the whole composite, so the subject is affected too. Leave the
              effect on <span className="text-paper">None</span> to only change the background.
            </p>
          </div>

          <div>
            <p className="label mb-2">Preview</p>
            <div className="checker overflow-hidden rounded-md ring-1 ring-line">
              <img
                src={exportUrl || sourceUrl || undefined}
                alt={`Composite preview of ${item.file.name}`}
                className="max-h-[22rem] w-full object-contain"
              />
            </div>
            <p className="readout mt-2 text-xs text-mute">
              {exportUrl
                ? `${(exportUrl.length / 1024 / 1.37).toFixed(1)} MiB PNG`
                : "Rendering…"}
            </p>
          </div>
        </div>

        <footer className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-4">
          <button type="button" onClick={onClose} className="btn-ghost">
            Cancel
          </button>
          {ready && (
            <a
              href={exportUrl}
              download={`${item.file.name.replace(/\.[^.]+$/, "")}-background.png`}
              className="btn-ghost"
            >
              <IconDownload className="h-4 w-4" />
              Download
            </a>
          )}
          <button
            type="button"
            disabled={!ready}
            onClick={() => {
              onSave(exportUrl);
              onClose();
            }}
            className="btn-primary"
          >
            Apply
          </button>
        </footer>
      </div>
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  children
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-sm px-2.5 py-1.5 font-mono text-xs transition-colors ${
        active
          ? "bg-ink-700 text-lime ring-1 ring-lime/40"
          : "bg-ink-900 text-mute ring-1 ring-line hover:text-paper"
      }`}
    >
      {children}
    </button>
  );
}
