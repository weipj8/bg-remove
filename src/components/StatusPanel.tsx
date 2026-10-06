import { formatDuration, formatMib, formatRate } from "../format";
import type { usePipeline } from "../hooks/usePipeline";
import { WEBGPU_MODEL_ID } from "../../lib/model-spec";
import type { ReactNode } from "react";
import { Chip, IconAlert, IconCheck, IconCpu, IconRefresh, IconShield } from "./ui";

interface StatusPanelProps {
  pipeline: ReturnType<typeof usePipeline>;
}

/**
 * One surface for "what is happening and what will happen". It is deliberately the
 * same component before and during a run, so the visitor sees the download being
 * disclosed first and then tracked, instead of a spinner that appears out of nowhere.
 */
export function StatusPanel({ pipeline }: StatusPanelProps) {
  const {
    phase,
    model,
    spec,
    cached,
    bytes,
    rate,
    remainingSeconds,
    elapsedMs,
    stalled,
    failure,
    counts,
    items
  } = pipeline;

  const pending = (counts.queued ?? 0) + (counts.processing ?? 0);
  const finished = counts.done ?? 0;
  const modelName = model === WEBGPU_MODEL_ID ? "MODNet" : "RMBG-1.4";

  if (failure) {
    return (
      <Shell tone="bad" label={failure.stage.toUpperCase()} role="alert">
        <p className="font-display text-lg text-coral">{failure.message}</p>
        <p className="mt-2 text-sm text-mute">
          Your images are still in the list — nothing was discarded. This step usually fails on a
          dropped connection or a browser that will not let the page cache large files.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => pipeline.retry()} className="btn-ghost">
            <IconRefresh className="h-4 w-4" />
            Try again
          </button>
          {pending > 0 && (
            <span className="readout text-xs text-mute">{pending} image(s) waiting</span>
          )}
        </div>
      </Shell>
    );
  }

  if (phase === "acquiring" && !bytes) {
    // Before the first chunk there is nothing to measure — but the request is live, and
    // saying so beats showing the idle panel while a connection hangs.
    return (
      <Shell tone={stalled ? "warn" : "live"} label="ACQUIRING MODEL">
        <p className="font-display text-lg">
          {stalled ? "The connection is not answering" : "Reaching the model…"}
        </p>
        <Gauge indeterminate tone={stalled ? "amber" : "lime"} />
        <p className="mt-3 text-sm text-mute">
          {stalled
            ? "No bytes have arrived yet. Try again — if a filter or extension is blocking this origin, that is usually why."
            : "Asking this origin for the weight file. The bar appears as soon as the first bytes land."}
        </p>
      </Shell>
    );
  }

  if (phase === "acquiring" && bytes) {
    const percent = Math.min(100, (bytes.loaded / bytes.total) * 100);
    return (
      <Shell tone={stalled ? "warn" : "live"} label="ACQUIRING MODEL">
        <div className="flex items-baseline justify-between gap-4">
          <p className="font-display text-lg">
            {stalled ? "This connection is very slow" : "Downloading the model — once"}
          </p>
          <span className="readout text-lime">{percent.toFixed(0)}%</span>
        </div>

        <Gauge percent={percent} tone={stalled ? "amber" : "lime"} />

        <dl className="readout mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-mute sm:grid-cols-4">
          <Fact value={`${formatMib(bytes.loaded)} / ${formatMib(bytes.total)}`} label="received" />
          <Fact value={rate ? formatRate(rate) : "measuring"} label="speed" />
          <Fact
            value={remainingSeconds != null ? `${formatDuration(remainingSeconds)} left` : "—"}
            label="estimate"
          />
          <Fact value={formatDuration(elapsedMs / 1000)} label="elapsed" />
        </dl>

        <p className="mt-3 text-sm text-mute">
          {stalled
            ? "It is still running. Keep this tab open — a backgrounded tab may be paused by the browser."
            : "This weight is stored inside this browser afterwards, so the next visit starts instantly. Keep this tab open until it finishes."}
        </p>
      </Shell>
    );
  }

  if (phase === "preparing") {
    return (
      <Shell tone="live" label="COMPILING">
        <p className="font-display text-lg">Compiling the model for this device</p>
        <Gauge indeterminate tone="lime" />
        <p className="mt-3 text-sm text-mute">
          Bytes are on disk. The runtime is now building an executable graph for your GPU or CPU, which
          cannot be measured from the page.
        </p>
      </Shell>
    );
  }

  if (phase === "processing") {
    return (
      <Shell tone="live" label="CUTTING">
        <div className="flex items-baseline justify-between gap-4">
          <p className="font-display text-lg">Removing backgrounds</p>
          <span className="readout text-lime">
            {finished} of {items.length}
          </span>
        </div>
        <Gauge percent={items.length ? (finished / items.length) * 100 : 0} tone="lime" />
        <p className="mt-3 text-sm text-mute">
          Each image is decoded, inferred and re-encoded locally. Large photos take a few seconds and
          the page may feel briefly heavy — that is the model running, not a hang.
        </p>
      </Shell>
    );
  }

  if (phase === "done" && finished > 0) {
    return (
      <Shell tone="good" label="DONE">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="good">
            <IconCheck className="h-3.5 w-3.5" />
            {finished} image{finished === 1 ? "" : "s"} cut
          </Chip>
          <Chip>{formatDuration(elapsedMs / 1000)} total</Chip>
          <Chip tone="neutral">
            <IconShield className="h-3.5 w-3.5" />0 bytes uploaded
          </Chip>
        </div>
        <p className="mt-3 text-sm text-mute">
          The model stays cached, so another image now costs only the inference time.
        </p>
      </Shell>
    );
  }

  // idle: the expectation layer, shown before the visitor has committed to anything.
  return (
    <Shell tone={cached ? "good" : "neutral"} label={cached ? "MODEL CACHED" : "ONE-TIME SETUP"}>
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone={cached ? "good" : "neutral"}>
          <IconCpu className="h-3.5 w-3.5" />
          {modelName} · {formatMib(spec.bytes)}
        </Chip>
        {cached && (
          <Chip tone="good">
            <IconCheck className="h-3.5 w-3.5" />
            nothing to download
          </Chip>
        )}
      </div>

      <p className="mt-3 text-sm text-paper">
        {cached
          ? `The ${formatMib(spec.bytes)} model is already stored in this browser, so the first image goes straight to inference.`
          : `The first image downloads a ${formatMib(spec.bytes)} model into this browser. That happens once, on this device.`}
      </p>

      <dl className="readout mt-4 space-y-0 text-xs">
        {!cached && <Row k="model download" v="15–30 s on broadband" />}
        {!cached && <Row k="same, at 200 KB/s" v="a few minutes" />}
        <Row k="compile + first image" v="10–15 s" />
        <Row k="each extra image" v="2–4 s" />
        <Row k="uploaded to a server" v="never" />
      </dl>

      {!cached && (
        <p className="mt-3 text-sm text-mute">
          Nothing is fetched from anywhere else, and nothing leaves this device — the whole model runs in
          this tab. Expect one large download, then instant starts.
        </p>
      )}
      {cached && (
        <p className="mt-3 text-sm text-mute">
          Drop an image whenever you are ready — results appear below, and you can recolour or download
          each one.
        </p>
      )}
    </Shell>
  );
}

function Shell({
  tone,
  label,
  role,
  children
}: {
  tone: "neutral" | "live" | "good" | "warn" | "bad";
  label: string;
  role?: "alert";
  children: ReactNode;
}) {
  const rings = {
    neutral: "ring-line",
    live: "ring-lime/25",
    good: "ring-lime/30",
    warn: "ring-amber/30",
    bad: "ring-coral/40"
  } as const;
  const labels = {
    neutral: "text-mute",
    live: "text-lime",
    good: "text-lime",
    warn: "text-amber",
    bad: "text-coral"
  } as const;

  return (
    <div
      role={role ?? "status"}
      aria-live={role ? "assertive" : "polite"}
      className={`min-h-[9.5rem] rounded-md bg-ink-900 px-4 py-4 ring-1 ${rings[tone]}`}
    >
      <div className={`label mb-3 flex items-center gap-2 ${labels[tone]}`}>
        {tone === "bad" && <IconAlert className="h-3.5 w-3.5" />}
        {label}
      </div>
      {children}
    </div>
  );
}

function Gauge({
  percent,
  tone,
  indeterminate = false
}: {
  percent?: number;
  tone: "lime" | "amber";
  indeterminate?: boolean;
}) {
  const color = tone === "amber" ? "bg-amber" : "bg-lime";
  return (
    <div className="relative mt-4 h-[3px] w-full overflow-hidden rounded-full bg-ink-700">
      <div
        className={`absolute inset-y-0 left-0 ${color} ${
          indeterminate
            ? "w-2/5 animate-[indeterminate_1.4s_ease-in-out_infinite]"
            : "transition-[width] duration-200 ease-out"
        }`}
        style={indeterminate ? undefined : { width: `${Math.max(0, Math.min(100, percent ?? 0))}%` }}
      />
      {/* Hairline ticks so the bar reads as a gauge rather than a decorative blob. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex justify-between">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="w-px bg-ink-950/70" />
        ))}
      </div>
    </div>
  );
}

function Fact({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <dt className="text-mute/70">{label}</dt>
      <dd className="text-paper">{value}</dd>
    </div>
  );
}

/** A key/value line with a hairline rule — the idle panel is a spec sheet, not a paragraph. */
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line/70 py-1.5 last:border-0">
      <dt className="text-mute/80">{k}</dt>
      <dd className="text-paper">{v}</dd>
    </div>
  );
}
