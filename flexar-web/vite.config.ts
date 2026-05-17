/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// Backend stand (Zulip server). Read from env, default to the deployed stand.
// See PRD §7.4: Vite dev-proxy removes CORS and self-signed TLS friction.
const DEFAULT_BACKEND = "https://95.84.162.15:8843";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backendTarget = env.VITE_ZULIP_BACKEND ?? DEFAULT_BACKEND;

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
        // Realm + user avatars, realm icon and logos. Backend's
        // `serve_local_avatar_unauthed` handler is intentionally
        // PUBLIC (no auth) — security comes from the AVATAR_SALT
        // hash baked into the URL, so a leaked path can't be
        // brute-forced. Without this proxy, every avatar / icon /
        // logo <img> in dev hits the SPA catch-all and gets
        // `index.html` (text/html), then fires onError and shows
        // "preview unavailable" — misleading the developer into
        // thinking the upload didn't take.
        //
        // Production runs same-origin behind nginx so this concern
        // only exists in dev.
        //
        // NOT proxied here: `/user_uploads/*`. That endpoint requires
        // auth (cookie OR Bearer); browser <img> can't send the
        // Bearer header we use, so a naive proxy just redirects to
        // /accounts/login. Inline message attachments stay broken
        // in dev until we wire a token-in-URL or blob-URL approach.
        "/user_avatars": {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    build: {
      // Push the big always-needed third-party deps into their own
      // long-lived chunks: they change rarely, so the browser can
      // cache them across releases. The runtime+app chunk shrinks
      // by the size of these deps. See PRD §6.6.
      rollupOptions: {
        output: {
          manualChunks: {
            // React core + routing + query — every page needs them.
            "vendor-react": [
              "react",
              "react-dom",
              "react-router-dom",
              "@tanstack/react-query",
            ],
            // Sanitiser pulled in only on the message-feed path but
            // big enough (~40kb) to deserve its own chunk so a code
            // change in our code doesn't bust its cache.
            "vendor-dompurify": ["dompurify"],
            // The virtualizer is its own moderate chunk.
            "vendor-virtual": ["@tanstack/react-virtual"],
          },
        },
      },
    },
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: ["./tests/setup.ts"],
      include: [
        "tests/**/*.{test,spec}.{ts,tsx}",
        "src/**/*.{test,spec}.{ts,tsx}",
      ],
    },
  };
});
