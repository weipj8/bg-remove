import { useCallback, useEffect, useRef, useState } from "react";
import { Dropzone } from "./components/Dropzone";
import { ModelPicker } from "./components/ModelPicker";
import { Results } from "./components/Results";
import { StatusPanel } from "./components/StatusPanel";
import { BeforeAfter, Faq, HowItWorks, Privacy, SiteFooter } from "./components/Sections";
import { TopBar } from "./components/TopBar";
import { Chip, IconCheck } from "./components/ui";
import { usePipeline } from "./hooks/usePipeline";

const SAMPLES = [
  { url: "/samples/sample-1.jpg", name: "sample-1.jpg" },
  { url: "/samples/sample-2.jpg", name: "sample-2.jpg" },
  { url: "/samples/sample-3.jpg", name: "sample-3.jpg" },
  { url: "/samples/sample-4.jpg", name: "sample-4.jpg" }
];

const COMPARISONS = [
  { before: "/samples/sample-1.jpg", after: "/samples/sample-1-cut.png", label: "portrait" },
  { before: "/samples/sample-3.jpg", after: "/samples/sample-3-cut.png", label: "product" },
  { before: "/samples/sample-4.jpg", after: "/samples/sample-4-cut.png", label: "street" }
];

export default function App() {
  const pipeline = usePipeline();
  const [loadingSample, setLoadingSample] = useState<string | null>(null);
  const [sampleError, setSampleError] = useState<string | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const addFiles = pipeline.addFiles;

  // Pasting a screenshot is the fastest route in, and it is the one people try first.
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const files = Array.from(event.clipboardData?.items ?? [])
        .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
        .map((item) => item.getAsFile())
        .filter((file): file is File => file !== null);
      if (files.length === 0) return;
      event.preventDefault();
      addFiles(files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [addFiles]);

  useEffect(() => {
    if (pipeline.items.length > 0) resultsRef.current?.scrollIntoView({ block: "nearest" });
  }, [pipeline.items.length]);

  const loadSample = useCallback(async (url: string, name: string) => {
    setLoadingSample(url);
    setSampleError(null);
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(response.statusText);
      const blob = await response.blob();
      addFiles([new File([blob], name, { type: blob.type || "image/jpeg" })]);
    } catch {
      setSampleError("That sample could not be loaded.");
    } finally {
      setLoadingSample(null);
    }
  }, [addFiles]);

  return (
    <div id="top" className="min-h-screen pb-4">
      <TopBar />

      <main className="mx-auto max-w-page px-5 sm:px-8">
        <section aria-labelledby="hero-heading" className="grid gap-10 py-14 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:py-20">
          <div className="flex flex-col justify-center">
            <p className="label">In-browser background remover</p>
            <h1
              id="hero-heading"
              className="rise mt-4 font-display text-4xl leading-[1.05] tracking-display text-paper sm:text-5xl lg:text-6xl"
            >
              Cut the background
              <span className="block italic text-lime">without a server.</span>
            </h1>
            <p className="mt-6 max-w-prose text-lg leading-relaxed text-mute">
              Drop a photo and your own GPU does the work. Nothing is uploaded, there is no account,
              and once the model is cached it runs with the network off.
            </p>

            <ul className="mt-8 flex flex-wrap gap-2">
              {["No upload", "No account", "No watermark", "Free forever"].map((fact) => (
                <li key={fact}>
                  <Chip tone="good">
                    <IconCheck className="h-3.5 w-3.5" />
                    {fact}
                  </Chip>
                </li>
              ))}
            </ul>

            <dl className="readout mt-10 grid grid-cols-2 gap-x-8 gap-y-4 border-t border-line pt-6 text-xs sm:grid-cols-4">
              {[
                { k: "runs on", v: "your GPU / CPU" },
                { k: "models", v: "RMBG-1.4 · MODNet" },
                { k: "setup, once", v: "25–42 MB" },
                { k: "price", v: "$0 · no account" }
              ].map((spec) => (
                <div key={spec.k}>
                  <dt className="text-mute/70">{spec.k}</dt>
                  <dd className="mt-1 text-paper">{spec.v}</dd>
                </div>
              ))}
            </dl>

            <p className="readout mt-8 max-w-prose text-xs leading-relaxed text-mute">
              {pipeline.capabilities.isWebGPUSupported
                ? "This browser reports WebGPU, so MODNet is available as well as RMBG."
                : "This browser has no WebGPU, so MODNet is disabled and RMBG runs on the CPU."}
            </p>
          </div>

          <div className="rounded-lg bg-ink-800/70 p-5 shadow-card ring-1 ring-line sm:p-6">
            <ModelPicker pipeline={pipeline} />

            <div className="mt-5">
              <Dropzone onFiles={addFiles} busy={pipeline.busy} />
            </div>

            <div className="mt-5">
              <StatusPanel pipeline={pipeline} />
            </div>

            <div className="mt-6 border-t border-line pt-5">
              <p className="label mb-3">No image handy? Try one</p>
              <div className="grid grid-cols-4 gap-2">
                {SAMPLES.map((sample) => (
                  <button
                    key={sample.url}
                    type="button"
                    onClick={() => loadSample(sample.url, sample.name)}
                    disabled={loadingSample !== null}
                    aria-label={`Process ${sample.name}`}
                    className="group relative overflow-hidden rounded-md ring-1 ring-line transition-shadow hover:ring-2 hover:ring-lime disabled:opacity-50"
                  >
                    <img
                      src={sample.url}
                      alt=""
                      className="thumb-img aspect-square"
                      loading="lazy"
                      decoding="async"
                    />
                    {loadingSample === sample.url && (
                      <span className="absolute inset-0 flex items-center justify-center bg-ink-950/70">
                        <span className="h-4 w-4 animate-spin rounded-full border-t border-lime" />
                      </span>
                    )}
                  </button>
                ))}
              </div>
              {sampleError && <p className="readout mt-2 text-xs text-amber">{sampleError}</p>}
            </div>
          </div>
        </section>

        <div ref={resultsRef}>
          <Results
            items={pipeline.items}
            onRemove={pipeline.removeItem}
            onRetry={pipeline.retry}
            onClear={pipeline.clear}
          />
        </div>

        <BeforeAfter slides={COMPARISONS} />
        <HowItWorks />
        <Privacy />
        <Faq />
      </main>

      <div className="mx-auto max-w-page px-5 sm:px-8">
        <SiteFooter />
      </div>
    </div>
  );
}
