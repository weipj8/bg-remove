import { renderToStaticMarkup } from "react-dom/server";
import App from "./App.tsx";

/**
 * The page is prerendered at build time so crawlers and link previews get real prose
 * instead of an empty `#root`. It is `renderToStaticMarkup`, not hydration, on purpose:
 * almost every fact on the page (WebGPU support, cache state, `crossOriginIsolated`) is
 * only knowable in the browser, so a hydrated tree would mismatch on nearly every visit.
 * The client renders over this with `createRoot`.
 */
export default function render() {
  return renderToStaticMarkup(<App />);
}
