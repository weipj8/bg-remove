import { useCallback, useRef, useState } from "react";
import { IconUpload } from "./ui";

interface DropzoneProps {
  onFiles: (files: File[]) => void;
  busy: boolean;
}

/**
 * Hand-rolled rather than a dropzone library: the drag states drive a custom frame,
 * and the page is prerendered at build time, so this also has to render on a server.
 */
export function Dropzone({ onFiles, busy }: DropzoneProps) {
  const [depth, setDepth] = useState(0);
  const [rejected, setRejected] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragging = depth > 0;

  const take = useCallback(
    (list: FileList | null) => {
      if (!list || list.length === 0) return;
      const all = Array.from(list);
      const images = all.filter((file) => file.type.startsWith("image/"));
      if (images.length === 0) {
        setRejected(`${all.length} file${all.length === 1 ? "" : "s"} — not an image.`);
        return;
      }
      setRejected(
        images.length === all.length
          ? null
          : `Skipped ${all.length - images.length} non-image file${all.length - images.length === 1 ? "" : "s"}.`
      );
      onFiles(images);
    },
    [onFiles]
  );

  return (
    <div
      onDragEnter={(event) => {
        event.preventDefault();
        setDepth((value) => value + 1);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={() => setDepth((value) => Math.max(0, value - 1))}
      onDrop={(event) => {
        event.preventDefault();
        setDepth(0);
        take(event.dataTransfer.files);
      }}
      className={`relative overflow-hidden rounded-md border border-dashed transition-colors duration-200 ${
        dragging ? "border-lime bg-ink-700" : "border-line bg-ink-900"
      } ${busy ? "opacity-60" : ""}`}
    >
      <input
        ref={inputRef}
        id="background-remover-file"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        className="peer sr-only"
        onChange={(event) => {
          take(event.target.files);
          event.target.value = "";
        }}
      />
      <label
        htmlFor="background-remover-file"
        className="flex min-h-[17rem] cursor-pointer select-none flex-col items-center justify-center gap-3 px-6 py-10 text-center peer-focus-visible:ring-2 peer-focus-visible:ring-lime peer-focus-visible:ring-inset"
      >
        <span
          className={`flex h-12 w-12 items-center justify-center rounded-md ring-1 transition-colors ${
            dragging ? "bg-lime text-ink-950 ring-lime" : "bg-ink-800 text-lime ring-line"
          }`}
        >
          <IconUpload className="h-6 w-6" />
        </span>
        <span className="font-display text-xl text-paper">
          {dragging ? "Release to cut" : "Drop an image here"}
        </span>
        <span className="readout text-xs text-mute">
          or click to browse · PNG, JPG, WebP · many at once is fine
        </span>
        <span className="readout text-xs text-mute">You can also paste from the clipboard.</span>
      </label>

      {dragging && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-lime/25 to-transparent animate-[sheen_1.1s_linear_infinite]"
        />
      )}

      {rejected && (
        <p className="readout border-t border-line bg-ink-900 px-4 py-2 text-xs text-amber">
          {rejected}
        </p>
      )}
    </div>
  );
}
