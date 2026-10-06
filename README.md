# Image Background Remover in the browser 

A powerful React + Vite application that removes backgrounds from images directly in your browser. This app leverages machine learning models through Transformers.js to process media locally, ensuring your files never leave your device.

## Features

- One-click background removal for images, in bulk
- Transparent PNG export, plus a compositor for a solid colour or your own background
- Honest first-run expectations: the download is disclosed before you drop a file, then
  tracked in MB, KB/s and an estimate — not a spinner
- A "model cached" state on every visit after that one, and it really is offline afterwards
- Optional WebGPU acceleration for supported browsers
- No account, no watermark, no upload, and zero third-party requests at runtime

## Technical Implementation

The app implements a cross-browser approach to background removal with optional WebGPU acceleration:

### Default Implementation (All Browsers)
- Uses [RMBG-1.4](https://huggingface.co/briaai/RMBG-1.4), a robust background removal model
- Ensures consistent performance across all modern browsers
- Processes images efficiently using WebAssembly

### Optional WebGPU Acceleration
- For browsers with WebGPU support, offers [MODNet](https://huggingface.co/Xenova/modnet) as an alternative
- Can be enabled through a dropdown when WebGPU is available
- Leverages GPU acceleration for potentially faster processing

Both implementations use Transformers.js to run the machine learning models directly in the browser, eliminating the need for server-side processing.

## How It Works

1. **Drop, paste or pick** — a file, a screenshot from the clipboard, or one of the four
   bundled samples
2. **Model selection** — RMBG-1.4 by default for maximum compatibility; MODNet appears when
   the browser reports WebGPU
3. **One-time setup** — the first run downloads the weight into the browser cache, then
   onnxruntime-web compiles it for this device. Every later visit skips both steps.
4. **Inference** — the model produces an alpha matte and the image is re-encoded as a
   transparent PNG, entirely in the tab
5. **Optional compositing** — flatten onto a colour or your own background image
6. **Export** — download per image; nothing was ever sent anywhere

## Getting Started

```bash
npm install
npm run dev          # Vite on :5173; models served from public/models/
```

The model weights are committed, so a fresh clone needs no download step. Other scripts:

```bash
npm run typecheck    # tsc --noEmit
npm run lint
npm run build        # manifest -> vite build -> prerender dist/index.html
npm run pages:dev    # build, then serve through wrangler (COOP/COEP + Functions)
npm run fonts        # re-vendor public/fonts + src/fonts.css from @fontsource
```

## Deployment

The site is **self-contained**: every model weight, the ONNX WASM runtime and the sample
images are served from the site's own origin, so a visitor's browser never contacts a
third party. Nothing is inferred or uploaded server-side — Cloudflare only delivers files.

Live at **https://bg-remove-1cl.pages.dev**, deployed with:

```bash
npm run pages:deploy
```

Requires `npx wrangler login` first, plus the one-time R2 bucket and Pages project
described in [AGENTS.md](./AGENTS.md). That file also covers the two constraints worth
knowing before you change anything: Cloudflare's **25 MiB per-static-file cap** (which is
why RMBG-1.4's 42 MiB weight is streamed from R2 by a Pages Function rather than shipped
as an asset), and the **COOP/COEP headers** that make the page `crossOriginIsolated` —
they buy multithreaded WASM, but they also mean any cross-origin asset you add will simply
be blocked.

## Browser Support

- **Default Experience**: All modern browsers (Chrome, Firefox, Safari, Edge)
- **Optional WebGPU**: Chrome/Edge 113+ and other browsers with WebGPU enabled. iOS Safari
  has no WebGPU and a tight per-tab WASM memory ceiling, so it stays on the WASM path and
  may struggle with the 42 MiB model.

## Technical Stack

- React 18 + Vite + Tailwind, deployed as static files on Cloudflare Pages
- Transformers.js + onnxruntime-web for in-browser inference (JSEP WASM bundle vendored)
- RMBG-1.4 as the default cross-browser model, MODNet when WebGPU is available
- Self-hosted woff2 fonts (Instrument Serif / Spline Sans / Spline Sans Mono)
- `dist/index.html` is prerendered at build time so crawlers see prose, then the client
  renders the tool over it
- No database, no queue, no server-side code beyond the one Function that streams the
  oversized model out of R2

## Credits

Based on the [WebGPU background removal demo](https://github.com/huggingface/transformers.js-examples/tree/main/remove-background-webgpu) by [@xenova](https://github.com/xenova)

## License

MIT License - feel free to use this in your own projects!
