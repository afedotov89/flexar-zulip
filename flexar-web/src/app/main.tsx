import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../theme/global.css";
// KaTeX font CSS — Zulip's server renders math expressions to KaTeX
// HTML (`.katex` subtrees). Without the package's stylesheet the
// glyphs fall back to the system math font, which doesn't ship the
// special operators and integrals correctly. Bundled once at the app
// root because every chat surface can contain math.
import "katex/dist/katex.min.css";
import { App } from "./App";

const rootElement = document.getElementById("root");
if (rootElement === null) {
  throw new Error("Root element #root not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
