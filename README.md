# Image Background Remover in the browser 

A powerful React + Vite application that removes backgrounds from images directly in your browser. This app leverages machine learning models through Transformers.js to process media locally, ensuring your files never leave your device.

## Features

- 🎯 One-click background removal for images
- 🎨 Custom background color and image selection
- 💾 Download options for both transparent and colored backgrounds
- 🏃‍♂️ Local processing - no server uploads needed
- 🔒 Privacy-focused - all processing happens in your browser
- ⚡ Optional WebGPU acceleration for supported browsers

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

1. **File Selection**: Upload any image file
2. **Model Selection**: 
   - By default, uses RMBG-1.4 for maximum compatibility
   - If WebGPU is available, offers option to switch to MODNet
3. **Background Removal**: The selected ML model processes your media, creating an alpha mask
4. **Customization**: Choose a custom background color, image or keep transparency
5. **Export**: Download your processed media with either transparent or colored background

## Getting Started

1. Clone the repository:
```bash
git clone https://github.com/weipj8/bg-remove.git
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
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

- React + Vite for the frontend framework
- Transformers.js for ML model inference
- RMBG-1.4 as the default cross-browser model
- Optional WebGPU acceleration with MODNet
- IndexedDB (via Dexie.js) for local file management
- TailwindCSS for styling

## Credits

Based on the [WebGPU background removal demo](https://github.com/huggingface/transformers.js-examples/tree/main/remove-background-webgpu) by [@xenova](https://github.com/xenova)

## License

MIT License - feel free to use this in your own projects!
