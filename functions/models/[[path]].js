// Cloudflare caps any single static asset at 25 MiB, which is enough for MODNet
// (24.7 MiB) but not for RMBG-1.4's 42.3 MiB weight, so that one lives in R2 and
// is streamed same-origin. Same origin matters: the COEP header set in
// functions/_middleware.js would make a cross-origin model a blocked request.
export const onRequestGet = async ({ request, env }) => {
  const key = new URL(request.url).pathname.slice(1);

  const object = await env.MODELS.get(key);
  if (!object) {
    // The smaller model files ship as static assets, but a function mounted at
    // /models/* shadows them, so hand those paths back to the asset bundle.
    return env.ASSETS.fetch(request);
  }

  return new Response(object.body, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType ?? "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
};
