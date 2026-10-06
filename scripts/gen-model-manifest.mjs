import { statSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// transformers.js picks the weight filename from the dtype it is about to use
// (`src/utils/dtypes.js`): wasm -> q8 -> `model_quantized`, webgpu -> fp32 -> `model`.
// Spelled out here rather than globbed, so a rename is a build failure instead of a
// progress bar whose total is the wrong file.
const MODELS = {
  "briaai/RMBG-1.4": "onnx/model_quantized.onnx",
  "Xenova/modnet": "onnx/model.onnx",
};

const manifest = {};
for (const [repo, file] of Object.entries(MODELS)) {
  const bytes = statSync(resolve(root, "public/models", repo, file)).size;
  manifest[repo] = { path: `/models/${repo}/${file}`, file, bytes };
}

const out = resolve(root, "src/generated/model-manifest.json");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(manifest, null, 2) + "\n");
console.log("model-manifest.json", JSON.stringify(manifest));
