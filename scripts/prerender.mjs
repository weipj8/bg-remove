import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServer } from "vite";

const root = resolve(import.meta.dirname, "..");
const target = resolve(root, "dist/index.html");

// A throwaway SSR server, not a second build: the tree is rendered once and thrown away.
const server = await createServer({ root, logLevel: "warn", appType: "custom", server: { middlewareMode: true } });
let markup;
try {
  ({ default: markup } = await server.ssrLoadModule("/src/ssr.jsx"));
  markup = markup();
} finally {
  await server.close();
}

const html = readFileSync(target, "utf8");
if (!html.includes('<div id="root"></div>')) {
  throw new Error("prerender: dist/index.html has no empty #root to fill");
}

writeFileSync(target, html.replace('<div id="root"></div>', `<div id="root">${markup}</div>`));
console.log(`prerender: filled #root with ${markup.length} characters of markup`);
