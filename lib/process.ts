import {
  env,
  AutoModel,
  AutoProcessor,
  RawImage,
  PreTrainedModel,
  Processor
} from "@huggingface/transformers";

// Every asset the app needs is served from this origin: the models live under
// `public/models/` (transformers.js appends `{repo}/{file}` to `localModelPath`)
// and the JSEP bundle is the copy that ships with the bundled onnxruntime-web, so
// it always matches the JS glue. `allowRemoteModels = false` makes any missing
// file a hard failure instead of a silent third-party fetch.
import ortJsepWasm from "../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.wasm?url";
import {
  WEBGPU_MODEL_ID,
  FALLBACK_MODEL_ID,
  MODEL_SPECS,
  detectCapabilities,
  type ModelId
} from "./model-spec";

env.allowLocalModels = true;
env.allowRemoteModels = false;
env.localModelPath = "/models/";
// Asserted rather than narrowed away: if this assignment ever stopped applying, the JSEP
// bundle would be fetched from a CDN and the site would silently lose its
// no-third-party-request property.
env.backends.onnx.wasm!.wasmPaths = { wasm: ortJsepWasm };

interface ModelState {
  model: PreTrainedModel | null;
  processor: Processor | null;
  isWebGPUSupported: boolean;
  currentModelId: string;
  isIOS: boolean;
}

interface ModelInfo {
  currentModelId: string;
  isWebGPUSupported: boolean;
  isIOS: boolean;
}

/**
 * `preparing` covers the time after the weight bytes have arrived but before a
 * session exists — onnxruntime-web is compiling the graph for this device and
 * there is no way to measure it, so the UI shows it as indeterminate.
 */
export type ModelEvent =
  | { stage: "acquiring"; loaded: number; total: number }
  | { stage: "preparing" };

export type ModelEventSink = (event: ModelEvent) => void;

/**
 * transformers.js reports `progress`/`total` from `Content-Length`
 * (`src/utils/hub.js:605-648`). The RMBG weight is streamed out of R2 without that
 * header, so the library grows its buffer per chunk and sets `total = loaded` —
 * reporting 100% on the first chunk. Only `loaded` is trustworthy, so the
 * denominator has to come from the manifest generated at build time.
 */
function forwardProgress(modelId: ModelId, onEvent?: ModelEventSink) {
  if (!onEvent) return undefined;
  const { file, bytes } = MODEL_SPECS[modelId];
  return (progress: {
    status: string;
    file?: string;
    loaded?: number;
  }) => {
    if (progress.file !== file) return; // config.json and the tokenizer stream too
    if (progress.status === "done") {
      onEvent({ stage: "preparing" });
    } else if (progress.status === "progress" && typeof progress.loaded === "number") {
      onEvent({
        stage: "acquiring",
        loaded: Math.min(progress.loaded, bytes),
        total: bytes,
      });
    }
  };
}

const state: ModelState = {
  model: null,
  processor: null,
  isWebGPUSupported: false,
  currentModelId: FALLBACK_MODEL_ID,
  isIOS: detectCapabilities().isIOS
};

// Initialize WebGPU with proper error handling
async function initializeWebGPU(onEvent?: ModelEventSink) {
  const gpu = (navigator as any).gpu;
  if (!gpu) {
    return false;
  }

  try {
    // Test if we can actually create an adapter
    const adapter = await gpu.requestAdapter();
    if (!adapter) {
      return false;
    }

    // Configure environment for WebGPU. `proxy` must already be false here: this
    // ORT build has no way to reset the WASM backend, so a session created while
    // proxying was enabled permanently blocks the WebGPU path (see switchModel).
    if (env.backends?.onnx?.wasm) {
      env.backends.onnx.wasm.proxy = false;
    }

    // Initialize model with WebGPU
    state.model = await AutoModel.from_pretrained(WEBGPU_MODEL_ID, {
      device: "webgpu",
      config: {
        model_type: 'modnet',
        architectures: ['MODNet']
      },
      progress_callback: forwardProgress(WEBGPU_MODEL_ID, onEvent)
    });
    state.processor = await AutoProcessor.from_pretrained(WEBGPU_MODEL_ID);
    state.isWebGPUSupported = true;
    return true;
  } catch (error) {
    console.error("WebGPU initialization failed:", error);
    return false;
  }
}

// Initialize the model based on the selected model ID
export async function initializeModel(
  forceModelId?: ModelId,
  onEvent?: ModelEventSink
): Promise<boolean> {
  try {
    // Always use RMBG-1.4 for iOS
    if (state.isIOS) {
      console.log('iOS detected, using RMBG-1.4 model');
      if (env.backends?.onnx?.wasm) {
        env.backends.onnx.wasm.proxy = true;
      }

      state.model = await AutoModel.from_pretrained(FALLBACK_MODEL_ID, {
        config: { model_type: 'custom' },
        progress_callback: forwardProgress(FALLBACK_MODEL_ID, onEvent)
      });

      state.processor = await AutoProcessor.from_pretrained(FALLBACK_MODEL_ID, {
        config: {
          do_normalize: true,
          do_pad: false,
          do_rescale: true,
          do_resize: true,
          image_mean: [0.5, 0.5, 0.5],
          feature_extractor_type: "ImageFeatureExtractor",
          image_std: [1, 1, 1],
          resample: 2,
          rescale_factor: 0.00392156862745098,
          size: { width: 1024, height: 1024 },
        }
      });

      state.currentModelId = FALLBACK_MODEL_ID;
      return true;
    }

    // Non-iOS flow remains the same
    const selectedModelId = forceModelId || FALLBACK_MODEL_ID;

    // Try WebGPU if requested
    if (selectedModelId === WEBGPU_MODEL_ID) {
      const webGPUSuccess = await initializeWebGPU(onEvent);
      if (webGPUSuccess) {
        state.currentModelId = WEBGPU_MODEL_ID;
        return true;
      }
      // If WebGPU fails, fall through to fallback model without error
    }

    // Use fallback model
    if (env.backends?.onnx?.wasm) {
      env.backends.onnx.wasm.proxy = true;
    }

    state.model = await AutoModel.from_pretrained(FALLBACK_MODEL_ID, {
      progress_callback: forwardProgress(FALLBACK_MODEL_ID, onEvent)
    });

    state.processor = await AutoProcessor.from_pretrained(FALLBACK_MODEL_ID, {
      revision: "main",
      config: {
        do_normalize: true,
        do_pad: true,
        do_rescale: true,
        do_resize: true,
        image_mean: [0.5, 0.5, 0.5],
        feature_extractor_type: "ImageFeatureExtractor",
        image_std: [0.5, 0.5, 0.5],
        resample: 2,
        rescale_factor: 0.00392156862745098,
        size: { width: 1024, height: 1024 }
      }
    });

    state.currentModelId = FALLBACK_MODEL_ID;

    if (!state.model || !state.processor) {
      throw new Error("Failed to initialize model or processor");
    }

    return true;
  } catch (error) {
    console.error("Error initializing model:", error);
    if (forceModelId === WEBGPU_MODEL_ID) {
      console.log("Falling back to cross-browser model...");
      return initializeModel(FALLBACK_MODEL_ID, onEvent);
    }
    // A failed weight fetch surfaces from transformers.js as a `local_files_only` complaint,
    // which describes the mechanism, not the cause. The cause is the network.
    throw new Error(
      "The model could not be fetched. Check your connection and try again — your images are still queued."
    );
  }
}

// Get current model info
export function getModelInfo(): ModelInfo {
  return {
    currentModelId: state.currentModelId,
    isWebGPUSupported: Boolean((navigator as any).gpu),
    isIOS: state.isIOS
  };
}

export async function processImage(image: File): Promise<File> {
  if (!state.model || !state.processor) {
    throw new Error("Model not initialized. Call initializeModel() first.");
  }

  const sourceURL = URL.createObjectURL(image);

  try {
    const img = await RawImage.fromURL(sourceURL);

    // Pre-process image
    const { pixel_values } = await state.processor(img);

    // Predict alpha matte
    const { output } = await state.model({ input: pixel_values });

    // Resize mask back to original size
    const maskData = (
      await RawImage.fromTensor(output[0].mul(255).to("uint8")).resize(
        img.width,
        img.height,
      )
    ).data;

    // Create new canvas
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    if(!ctx) throw new Error("Could not get 2d context");

    // Draw original image output to canvas
    ctx.drawImage(img.toCanvas(), 0, 0);

    // Update alpha channel
    const pixelData = ctx.getImageData(0, 0, img.width, img.height);
    for (let i = 0; i < maskData.length; ++i) {
      pixelData.data[4 * i + 3] = maskData[i];
    }
    ctx.putImageData(pixelData, 0, 0);

    // Convert canvas to blob
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error("Failed to create blob")),
        "image/png"
      )
    );

    const [fileName] = image.name.split(".");
    return new File([blob], `${fileName}-no-background.png`, { type: "image/png" });
  } catch (error) {
    // The previous message was a bare "Failed to process image", which is what ends
    // up on the card, so keep whatever the runtime actually said.
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(detail || "Could not process this image");
  } finally {
    URL.revokeObjectURL(sourceURL);
  }
}
