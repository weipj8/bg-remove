import { useEffect, useState } from "react";
import { formatMib } from "../format";
import type { WorkItem } from "../hooks/usePipeline";
import { EditModal } from "./EditModal";
import { IconAlert, IconDownload, IconPencil, IconRefresh, IconTrash } from "./ui";

interface ResultsProps {
  items: WorkItem[];
  onRemove: (id: number) => void;
  onRetry: (id: number) => void;
  onClear: () => void;
}

export function Results({ items, onRemove, onRetry, onClear }: ResultsProps) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="results-heading" className="mt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="results-heading" className="font-display text-xl">
          Cut-outs
        </h2>
        <button type="button" onClick={onClear} className="readout text-xs text-mute underline-offset-4 hover:text-paper hover:underline">
          Clear all
        </button>
      </div>
      <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <li key={item.id}>
            <ResultCard item={item} onRemove={onRemove} onRetry={onRetry} />
          </li>
        ))}
      </ul>
    </section>
  );
}

interface ResultCardProps {
  item: WorkItem;
  onRemove: (id: number) => void;
  onRetry: (id: number) => void;
}

function ResultCard({ item, onRemove, onRetry }: ResultCardProps) {
  const [editedUrl, setEditedUrl] = useState<string | null>(null);
  const [showingOriginal, setShowingOriginal] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const sourceUrl = useObjectUrl(item.file);
  const resultUrl = useObjectUrl(item.processed);

  const visible = showingOriginal ? sourceUrl : (editedUrl ?? resultUrl ?? sourceUrl);
  const downloadable = editedUrl ?? resultUrl;

  return (
    <article className="overflow-hidden rounded-lg bg-ink-800 shadow-card">
      <div className={`checker relative aspect-square ${item.state === "error" ? "opacity-40" : ""}`}>
        {visible && (
          <img
            src={visible}
            alt={
              item.state === "done"
                ? `${item.file.name} with its background removed`
                : `${item.file.name}, ${item.state}`
            }
            className="thumb-img"
            loading="lazy"
            decoding="async"
          />
        )}

        {item.state === "processing" && (
          <div className="absolute inset-0 flex items-center justify-center bg-ink-950/60">
            <span className="readout flex items-center gap-2 rounded-sm bg-ink-900 px-3 py-1.5 text-xs text-lime ring-1 ring-lime/30">
              <span className="h-3 w-3 animate-spin rounded-full border-t border-lime" />
              cutting
            </span>
          </div>
        )}

        {item.state === "queued" && (
          <div className="absolute inset-0 flex items-center justify-center bg-ink-950/60">
            <span className="readout rounded-sm bg-ink-900 px-3 py-1.5 text-xs text-mute ring-1 ring-line">
              waiting
            </span>
          </div>
        )}

        {item.state === "done" && (
          <button
            type="button"
            onMouseDown={() => setShowingOriginal(true)}
            onMouseUp={() => setShowingOriginal(false)}
            onMouseLeave={() => setShowingOriginal(false)}
            onFocus={() => setShowingOriginal(true)}
            onBlur={() => setShowingOriginal(false)}
            className="readout absolute bottom-2 right-2 rounded-sm bg-ink-950/80 px-2 py-1 text-xs text-mute ring-1 ring-line hover:text-paper"
          >
            hold to compare
          </button>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-line px-3 py-2.5">
        <p className="readout min-w-0 flex-1 truncate text-xs text-mute" title={item.file.name}>
          {item.file.name}
          {item.processed && <span className="text-mute/60"> · {formatMib(item.processed.size)} PNG</span>}
        </p>

        {item.state === "error" ? (
          <div className="flex items-center gap-2">
            <span className="readout flex items-center gap-1 text-xs text-coral">
              <IconAlert className="h-3.5 w-3.5" />
              failed
            </span>
            <button
              type="button"
              onClick={() => onRetry(item.id)}
              aria-label={`Retry ${item.file.name}`}
              className="btn-ghost px-2 py-1"
            >
              <IconRefresh className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            {item.state === "done" && (
              <>
                <button
                  type="button"
                  onClick={() => setModalOpen(true)}
                  aria-label={`Edit background of ${item.file.name}`}
                  className="btn-ghost px-2 py-1"
                >
                  <IconPencil className="h-4 w-4" />
                </button>
                <a
                  href={downloadable ?? "#"}
                  download={item.processed?.name ?? item.file.name}
                  aria-label={`Download ${item.file.name} as PNG`}
                  className="btn-primary px-2.5 py-1"
                >
                  <IconDownload className="h-4 w-4" />
                </a>
              </>
            )}
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              aria-label={`Remove ${item.file.name}`}
              className="btn-ghost px-2 py-1"
            >
              <IconTrash className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {item.state === "error" && item.error && (
        <p className="readout border-t border-line bg-ink-900 px-3 py-2 text-xs text-coral">
          {item.error}
        </p>
      )}

      {modalOpen && (
        <EditModal
          item={item}
          sourceUrl={resultUrl}
          onClose={() => setModalOpen(false)}
          onSave={setEditedUrl}
        />
      )}
    </article>
  );
}

/**
 * Created in an effect and revoked on unmount: calling `createObjectURL` during render
 * leaked one URL per render and threw on the prerender pass.
 */
function useObjectUrl(file?: File): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }
    const created = URL.createObjectURL(file);
    setUrl(created);
    return () => URL.revokeObjectURL(created);
  }, [file]);

  return url;
}
