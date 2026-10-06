# AGENTS.md

Operational notes for anyone (human or AI) working in this repo.

## What this is

A Vite + React SPA that removes image backgrounds **in the visitor's own browser**
via [Transformers.js](https://github.com/huggingface/transformers.js). There is no
application server: inference never touches Cloudflare, and no user image is uploaded
anywhere. `npm run build` produces a pure static `dist/`.

## Build pipeline

```bash
npm run fonts      # scripts/vendor-fonts.mjs -> public/fonts/*.woff2 + src/fonts.css
npm run manifest   # scripts/gen-model-manifest.mjs -> src/generated/model-manifest.json
npm run build      # vite build, then scripts/prerender.mjs fills dist/index.html
npm run typecheck  # tsc --noEmit; esbuild alone would type-check nothing
```

- **The manifest is the progress denominator.** `readResponse()` in
  `@huggingface/transformers/src/utils/hub.js:605-648` derives `total` from
  `Content-Length`; the R2 stream has no such header, so the library grows its buffer per
  chunk and reports `total === loaded` — i.e. 100% on the first chunk. Only `loaded` is
  trustworthy, so `MODEL_SPECS[id].bytes` comes from `fs.statSync` over the committed
  weights at build time. `src/generated/model-manifest.json` is derived and gitignored.
- **Prerender, not hydration.** `scripts/prerender.mjs` renders `src/ssr.jsx` through a
  throwaway Vite SSR server and writes the markup into `dist/index.html`'s `#root`, so
  crawlers and link previews get real prose. It is `renderToStaticMarkup`, and
  `src/main.jsx` re-renders with `createRoot`. Do not convert this to `hydrateRoot`:
  nearly every fact on the page (WebGPU support, cache state, `crossOriginIsolated`) only
  exists in the browser, so hydration would mismatch on almost every visit.
- Anything rendered by the page must be SSR-safe: no `window`, `navigator` or `caches`
  during render — read them inside an effect or guard with `typeof`.

## The invariant: zero third-party runtime dependencies

Every byte the app needs at runtime is served from the site's own origin. This is a
deliberate design constraint, not an accident — the original upstream pulled models from
Hugging Face, the ONNX WASM bundle from jsDelivr, sample images from Unsplash, and
redirected iPhone visitors to `bg-mobile.addy.ie`. All of that is gone.

Do not reintroduce it. Concretely:

- `lib/process.ts` sets `env.allowRemoteModels = false`. Leave it false. It is what turns
  a missing model file into a loud failure instead of a silent fetch to a third party.
- Never add an `http(s)://` URL to `src/`, `lib/`, or `index.html` for something the app
  renders or fetches. Put the file in `public/` instead.
- `functions/_middleware.js` sends `Cross-Origin-Embedder-Policy: require-corp` site-wide.
  Any cross-origin image/script you add will be **blocked by the browser**, so adding one
  is a build-visible mistake, not a quiet degradation.
- **Fonts are files in `public/fonts/`, not a `<link>`.** They are vendored out of the
  `@fontsource/*` devDependencies by `scripts/vendor-fonts.mjs` (`npm run fonts`), which
  copies the latin woff2 faces under stable names, keeps each OFL licence next to its
  family, and regenerates `src/fonts.css` from them. `src/index.css` imports that file, and
  `tailwind.config.js` `fontFamily` must name the same families. Runtime CSS that points at
  any other origin is the same third-party dependency as a Google Fonts `<link>`.

## Assets and where they live

| Asset | Size | Served by |
|---|---|---|
| `public/models/Xenova/modnet/onnx/model.onnx` | 24.7 MiB | Pages static asset |
| `public/models/briaai/RMBG-1.4/config.json`, `preprocessor_config.json` | <1 KiB | Pages static asset |
| `public/models/Xenova/modnet/config.json`, `preprocessor_config.json` | <1 KiB | Pages static asset |
| R2 key `models/briaai/RMBG-1.4/onnx/model_quantized.onnx` | 42.3 MiB | Pages Function → R2 |
| `dist/assets/ort-wasm-simd-threaded.jsep-*.wasm` | 20.3 MiB | Pages static asset |
| `public/samples/sample-{1..4}.jpg` | ~430 KiB total | Pages static asset |

The JSEP WASM bundle is imported from `node_modules` with Vite's `?url` suffix in
`lib/process.ts` and assigned to `env.backends.onnx.wasm.wasmPaths`. That bundle is what
carries the WebGPU and WebNN execution providers — if it fails to load, WebGPU dies with
`WebAssembly is not initialized yet`. Importing from `node_modules` keeps the binary in
lockstep with the bundled JS glue.

### The 404 page is hand-written HTML, not React

`public/404.html` is standalone: no bundle, no `#root`, inline CSS, and fonts pulled from
`/fonts/` like everything else. It exists so an unknown path answers `404` instead of the
SPA fallback (`index.html` with `200`), which reads to a crawler as a soft 404. Keep it that
way — a second `<script type="module">` entry would drag transformers.js into a page whose
only job is an apology. Note that Pages only serves it if the project's not-found behaviour
is not forced to SPA, so re-check `curl -I` on the deployed origin after changing anything
here.

### Why R2 exists

Cloudflare caps **any single static asset at 25 MiB** — on Pages and on Workers alike.
(The 2025 limit increase raised the file *count* to 100,000; the per-file size was left
unchanged.) RMBG-1.4's 42.3 MiB weight exceeds it, so it lives in R2 and a Pages Function
streams it **same-origin**. Same-origin is required, not cosmetic: under COEP a
cross-origin model file would be blocked.

MODNet at 24.7 MiB fits under the cap with ~325 KiB of headroom. If you ever swap it for a
larger variant, it has to move to R2 too.

## Which ONNX file gets requested

`@huggingface/transformers@3.0.0-alpha.15` picks the filename from the device's default
dtype (`src/utils/dtypes.js`): `wasm → q8` (suffix `_quantized`), `webgpu → fp32`
(suffix empty). So:

- RMBG-1.4 (WASM path) → `onnx/model_quantized.onnx`
- MODNet (WebGPU path) → `onnx/model.onnx`, also pinned fp32 by its own
  `config.json` → `transformers.js_config.dtype`

Passing `{ dtype: "..." }` to `AutoModel.from_pretrained` overrides this and changes which
filename is requested — if you do, vendor the corresponding file.

## Model switching, and the queue handoff

`wasm.proxy` is fixed by the first ORT session a page creates, so the WASM (RMBG) and
WebGPU (MODNet) backends cannot coexist in one page: switching models has to reload.
`lib/handoff.ts` makes that reload non-destructive. Before `switchModel()` reloads, the queue
— the dropped `File`s **and** any finished cut-outs — is written to IndexedDB; the first
render after the reload takes it back out, marks every item `queued` and re-cuts it with the
new model. The re-run is deliberate: switching models is how you ask for a second opinion,
and the previous result stays under the "waiting" chip until the new one replaces it.

- **Do not move this to `sessionStorage`.** It stringifies, and a `File` serialises to `{}`.
  IndexedDB structured-clones `File`/`Blob` with their `name`/`type` intact, which is the
  whole trick.
- `takeHandoff()` reads and deletes in a single transaction, so a handoff can never be
  applied twice, and a record older than 10 minutes is dropped rather than resurrecting a
  session the visitor abandoned.
- If IndexedDB is unavailable (private mode, quota), `switchTo()` returns `"blocked"` and the
  UI **refuses to reload** instead of destroying the images. Do not "simplify" that to
  fire-and-forget.
- `usePipeline` reads the stored model in a `useState` initialiser, not an effect, because the
  handoff restore can start inference immediately and must not capture the wrong model id.

## Local development

```bash
npm install
npm run dev          # Vite dev server on :5173; models served from public/models/
```

`npm run dev` exercises everything except the Pages Functions, so it cannot catch
routing or R2 problems. For those, use the production-shaped server:

```bash
npm run pages:dev    # vite build && wrangler pages dev dist
```

Note that `wrangler pages dev` uses a **local** miniflare R2 namespace. If it is empty,
the function falls through to `env.ASSETS.fetch()` and the copy in `public/models/` is
served instead — which is why the deploy script deletes that copy from `dist`.

## Deploying

One-time setup (already done for `bg-remove`):

```bash
npx wrangler login
npx wrangler r2 bucket create bg-remove-models
npx wrangler pages project create bg-remove --production-branch main
```

Upload the oversized weight to R2. **The R2 key must equal the URL path minus its leading
slash** — the function derives the key from `new URL(request.url).pathname`:

```bash
npx wrangler r2 object put \
  "bg-remove-models/models/briaai/RMBG-1.4/onnx/model_quantized.onnx" \
  --file public/models/briaai/RMBG-1.4/onnx/model_quantized.onnx \
  --content-type application/octet-stream \
  --remote
```

`--remote` is required. Without it wrangler writes into local miniflare storage and prints
"Upload complete", which looks like success.

Then deploy:

```bash
npm run pages:deploy
```

That script is `vite build && rm -f dist/models/briaai/RMBG-1.4/onnx/model_quantized.onnx
&& wrangler pages deploy dist --branch main`. The `rm` is load-bearing: without it Pages
rejects the upload for the 25 MiB per-file cap.

Live site: **https://bg-remove-1cl.pages.dev** (production branch `main`).

Bindings live in `wrangler.toml` (`[[r2_buckets]]` → binding `MODELS`).

### Do not switch this project to Pages Git-integration builds

A Git-connected build would try to upload `public/models/briaai/RMBG-1.4/onnx/
model_quantized.onnx` as a static asset and fail the 25 MiB cap. If you ever do want
integration builds, the build command must strip that file first.

## Verifying a deploy

The property worth checking is that nothing left the origin. Load the site in a real
browser, drop an image, wait for the processed result, and assert zero requests to any
other host — for **both** models (the choice persists in `localStorage` under
`bg-remove:model`; switching models reloads the page because `wasm.proxy` cannot be
flipped once a session exists, and `lib/handoff.ts` carries the queue across that reload —
see below).

```bash
BASE=https://bg-remove-1cl.pages.dev node /tmp/bgtest/selfcontained.mjs "briaai/RMBG-1.4"
BASE=https://bg-remove-1cl.pages.dev node /tmp/bgtest/selfcontained.mjs "Xenova/modnet"
```

(That script is scratch and lives outside the repo. If it is gone, the check to reimplement
is: `page.on("request")` → collect any URL whose host is not the site's, expect none.)

Also confirm `self.crossOriginIsolated === true` in the page; if it is false, COOP/COEP
regressed and the WASM backend silently dropped to a single thread.

## Re-fetching a model file

The weights are committed, so this is only needed for a new or different variant.
Hugging Face is the canonical source; on networks where it is throttled, ModelScope mirrors
these repos under identical IDs and is much faster:

```bash
curl -fL "https://www.modelscope.cn/api/v1/models/<repo>/repo?Revision=master&FilePath=onnx/model_quantized.onnx" \
  -o public/models/<repo>/onnx/model_quantized.onnx
```

List a repo's files and sizes with
`https://www.modelscope.cn/api/v1/models/<repo>/repo/files?Recursive=true`.

## Cost model at ~10k visitors/month

- **R2 egress is free.** 10k × 42 MB ≈ 420 GB of transfers costs $0. This is the whole
  reason the model goes through R2 rather than a self-hosted VM.
- **R2 storage:** 42 MB of 10 GiB free.
- **R2 reads (Class B):** ~1 per RMBG visitor; free tier is 10 million/month.
- **Pages static requests:** unmetered.
- **Functions requests:** billed as Workers requests, 100,000/day free. This is why the
  function is mounted at `/models/briaai/RMBG-1.4/onnx/*` rather than `/models/*` — a
  broad mount would bill every model file of every visitor.
- **Workers Free also allows only 10 ms of CPU per invocation.** The proxy stays inside
  that because `new Response(object.body)` *streams* — the edge never holds the 42 MB. Do
  not "simplify" it to `await object.arrayBuffer()` or any other buffering form; that
  converts a free passthrough into a CPU and memory bill, and will fail outright on the
  free plan.
- Each visitor downloads a model **once**; Transformers.js persists it in the browser
  Cache API and the response is `max-age=31536000, immutable`.

For comparison, the same 420 GB of monthly egress on a typical VPS billed at
$0.05–0.12/GB would run $20–50/month. R2's free egress is what makes the free plan viable
here.

## Known limitations

- **iPhone/iPad:** Safari has no WebGPU and enforces a tight per-tab WASM memory ceiling,
  so the 42 MB RMBG model may fail there. This is a visitor-device limit, not a hosting
  one — Cloudflare only delivers bytes.
- **First visit on a slow connection:** the RMBG path downloads 42 MB. On this network
  (~200 KB/s) a full run measured 280 s end to end; the same model takes ~14 s on a warm
  cache locally.
- The R2-proxied response is chunked, so the browser cannot report download progress
  ("Unable to determine content-length" in the console). Harmless — the app has no
  progress bar — but it means a slow first visit looks like a plain spinner.
