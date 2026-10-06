import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// `dist/index.html` ships prerendered prose for crawlers; this replaces it with the
// live tool. Deliberately `createRoot`, not `hydrateRoot` — see src/ssr.jsx.
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
