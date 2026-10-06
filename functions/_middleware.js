// Required for `crossOriginIsolated`, which is what lets onnxruntime-web run the
// WASM backend with more than one thread (see backends/onnx.js in @huggingface/transformers).
export const onRequest = async (context) => {
  const response = await context.next();
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  response.headers.set("Cross-Origin-Embedder-Policy", "require-corp");
  return response;
};
