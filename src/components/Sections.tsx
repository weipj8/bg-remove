import { useState } from "react";
import {
  IconCheck,
  IconCpu,
  IconDownload,
  IconShield,
  IconUpload,
  SectionHeader,
} from "./ui";

/**
 * The FAQ answers are also written into `index.html` as `FAQPage` JSON-LD. Search
 * engines compare the two, so the copy here and the structured data must stay identical.
 */
export const FAQ_ITEMS = [
  {
    q: "Does my photo get uploaded to a server?",
    a: "No. The image stays in the tab and the model runs on your own GPU or CPU. Once the setup download finishes there is no network request for your photos at all — you can even switch on airplane mode and it keeps working.",
  },
  {
    q: "Why is the first image slow?",
    a: "The first run downloads the neural network to your browser — about 25 MiB for MODNet or 42 MiB for RMBG. That happens once per browser, it is stored in the cache, and every visit after that starts processing immediately.",
  },
  {
    q: "Which model should I pick?",
    a: "MODNet needs WebGPU, is smaller and is faster, and is the right choice for people. RMBG runs everywhere, is the better all-rounder for products, furniture and text, and is the default. You can switch at any time.",
  },
  {
    q: "What formats can I use?",
    a: "JPEG, PNG and WebP up to a few thousand pixels per side. You get a transparent PNG back, and the background editor can flatten it onto a solid colour or an image of your own.",
  },
  {
    q: "Is it really free?",
    a: "Yes, with no account, no watermark and no usage limit. There is no backend inference to pay for, which is why it can be. The code is open source.",
  },
];

const STEPS = [
  {
    n: "01",
    icon: IconUpload,
    title: "Drop the images",
    body: "One at a time or twenty at once. They are listed instantly, in the order you dropped them, and nothing leaves the tab.",
  },
  {
    n: "02",
    icon: IconCpu,
    title: "The model wakes up",
    body: "On a first visit your browser downloads and compiles the network for this device. It is a one-time cost measured in tens of seconds, and it never repeats.",
  },
  {
    n: "03",
    icon: IconDownload,
    title: "Take the PNG",
    body: "Cut-outs appear on a transparency checkerboard. Download them individually, or edit one onto a new background first.",
  },
];

export function HowItWorks() {
  return (
    <section aria-labelledby="how-heading" className="mt-24">
      <SectionHeader
        id="how-heading"
        eyebrow="How it works"
        title="Three steps, no account, no upload"
        lede="Everything happens between your keyboard and your GPU."
      />
      <ol className="mt-8 grid gap-4 md:grid-cols-3">
        {STEPS.map((step) => (
          <li
            key={step.n}
            className="rise rounded-lg bg-ink-800/60 p-5 ring-1 ring-line"
          >
            <div className="flex items-center justify-between">
              <span className="readout text-xs text-lime">{step.n}</span>
              <step.icon className="h-5 w-5 text-mute" />
            </div>
            <h3 className="mt-4 font-display text-lg text-paper">{step.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-mute">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function Privacy() {
  return (
    <section aria-labelledby="privacy-heading" className="mt-24">
      <SectionHeader
        id="privacy-heading"
        eyebrow="Privacy"
        title="Your photos never leave this device"
        lede="Not a promise about our policy — a description of how the software is built."
      />
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <Panel
          title="No upload"
          body="The image is decoded with the File API and painted onto a canvas in this page. There is no request that could carry it, and no server that could keep it."
        />
        <Panel
          title="No account"
          body="Nothing to sign up for, nothing to identify you, no analytics script in the bundle. Your model preference is the only thing stored, in this browser's own storage."
        />
        <Panel
          title="Works offline"
          body="After the one-time setup the page needs no connection: the model and the code are already local. Airplane mode is a valid way to use this tool."
        />
      </div>
    </section>
  );
}

function Panel({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg bg-ink-800/60 p-5 ring-1 ring-line">
      <h3 className="flex items-center gap-2 font-display text-lg text-paper">
        <IconShield className="h-4 w-4 shrink-0 text-lime" />
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-mute">{body}</p>
    </div>
  );
}

export function Faq() {
  return (
    <section aria-labelledby="faq-heading" className="mt-24">
      <SectionHeader
        id="faq-heading"
        eyebrow="Questions"
        title="The things people ask before dropping a photo"
      />
      <dl className="mt-8 divide-y divide-line border-y border-line">
        {FAQ_ITEMS.map((item) => (
          <div key={item.q}>
            <dt>
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-sans text-base text-paper marker:hidden [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <span
                    aria-hidden="true"
                    className="readout shrink-0 text-lime transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <dd className="pb-5 pr-8 text-sm leading-relaxed text-mute">{item.a}</dd>
              </details>
            </dt>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line pt-8">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-10">
        <p className="readout text-xs text-mute">
          bg-remove · MIT licensed · runs on Cloudflare Pages
        </p>
        <p className="readout flex items-center gap-2 text-xs text-mute">
          <IconCheck className="h-3.5 w-3.5 text-lime" />
          zero third-party requests at runtime
        </p>
      </div>
    </footer>
  );
}

/**
 * Hairline wipe: one `<img>` per side is layered with `clip-path` so both render the
 * same pixels at the same size; the range input only moves a number.
 */
export function BeforeAfter({
  slides,
}: {
  slides: { before: string; after: string; label: string }[];
}) {
  const [pos, setPos] = useState(52);
  const [index, setIndex] = useState(0);
  const slide = slides[index];

  if (!slide) return null;

  return (
    <section aria-labelledby="compare-heading" className="mt-24">
      <SectionHeader
        id="compare-heading"
        eyebrow="Result"
        title="What a cut looks like"
        lede="Drag the handle. Left is the original, right is the PNG you get."
      />
      <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_auto]">
        <div className="checker relative overflow-hidden rounded-lg ring-1 ring-line">
          {/* The cut-out is the base layer so its alpha hole reveals the checkerboard;
              the original is the overlay, clipped away from the right. Clipping the
              transparent image instead would just show the original through the hole. */}
          <img
            src={slide.after}
            alt={`${slide.label} after background removal`}
            className="block w-full"
            loading="lazy"
            decoding="async"
          />
          <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
            <img
              src={slide.before}
              alt={`${slide.label} before background removal`}
              className="block h-full w-full object-cover"
              loading="lazy"
              decoding="async"
            />
          </div>
          <div
            aria-hidden="true"
            className="absolute inset-y-0 w-px bg-lime/70"
            style={{ left: `${pos}%` }}
          />
          <input
            type="range"
            min={2}
            max={98}
            value={pos}
            onChange={(event) => setPos(Number(event.target.value))}
            aria-label="Reveal the result"
            className="absolute inset-0 h-full w-full cursor-ew-resize appearance-none bg-transparent opacity-0"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-lime shadow-accent"
            style={{ left: `${pos}%` }}
          />
          <span className="readout pointer-events-none absolute left-3 top-3 rounded-sm bg-ink-950/75 px-2 py-1 text-xs text-mute">
            original
          </span>
          <span className="readout pointer-events-none absolute right-3 top-3 rounded-sm bg-ink-950/75 px-2 py-1 text-xs text-lime">
            cut out
          </span>
        </div>

        <div className="flex gap-3 lg:w-28 lg:flex-col">
          {slides.map((option, i) => (
            <button
              key={option.before}
              type="button"
              onClick={() => setIndex(i)}
              aria-pressed={i === index}
              aria-label={`Show ${option.label}`}
              className={`checker overflow-hidden rounded-md ring-1 transition-shadow ${
                i === index ? "ring-2 ring-lime" : "ring-line hover:ring-mute"
              }`}
            >
              <img
                src={option.after}
                alt=""
                className="thumb-img aspect-square"
                loading="lazy"
                decoding="async"
              />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
