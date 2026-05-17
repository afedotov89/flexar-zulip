/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type ProxyOptions } from "vite";
import react from "@vitejs/plugin-react";

// Backend stand (Zulip server). Read from env, default to the deployed stand.
// See PRD §7.4: Vite dev-proxy removes CORS and self-signed TLS friction.
const DEFAULT_BACKEND = "https://95.84.162.15:8843";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backendTarget = env.VITE_ZULIP_BACKEND ?? DEFAULT_BACKEND;

  // Optional dev credentials for proxying auth'ed media endpoints
  // (/user_uploads, /thumbnail, /avatar). The browser's <img>/<video>
  // can't send custom Authorization headers across an origin split,
  // so Vite-dev plays the role nginx plays in production: forwarding
  // the request while attaching the dev session's HTTP Basic header.
  //
  // To enable, add these to `.env.local`:
  //   VITE_DEV_API_EMAIL=you@example.com
  //   VITE_DEV_API_KEY=<your zulip api_key>
  //
  // When unset, the auth'ed proxies still forward but the backend
  // redirects to /accounts/login — inline message media stays broken
  // until creds are set. The warning below makes that visible.
  const devEmail = env.VITE_DEV_API_EMAIL;
  const devApiKey = env.VITE_DEV_API_KEY;
  const devBasicAuth =
    devEmail !== undefined && devEmail !== "" && devApiKey !== undefined && devApiKey !== ""
      ? `Basic ${Buffer.from(`${devEmail}:${devApiKey}`).toString("base64")}`
      : undefined;
  if (devBasicAuth === undefined) {
    console.warn(
      "[vite] VITE_DEV_API_EMAIL / VITE_DEV_API_KEY not set — inline\n" +
        "       message media (/user_uploads, /thumbnail) will not load in\n" +
        "       dev. See vite.config.ts header for setup.",
    );
  }

  // Builder for an auth'ed media proxy entry. Injects the dev session's
  // HTTP Basic header onto every outbound request, mimicking the
  // same-origin auth flow Zulip's bundled web client gets in production
  // (where the browser sends a session cookie automatically).
  const authedMediaProxy = (path: string): ProxyOptions => ({
    target: backendTarget,
    changeOrigin: true,
    secure: false,
    configure: (proxy) => {
      proxy.on("proxyReq", (proxyReq) => {
        if (devBasicAuth !== undefined) {
          proxyReq.setHeader("Authorization", devBasicAuth);
        }
      });
      void path; // path passed for future per-route logic, currently uniform
    },
  });

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
        "/user_avatars": {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
        // Auth'ed media: inline attachments (/user_uploads) and
        // server-generated previews (/thumbnail). These are the
        // endpoints that, in production, work because <img> sends
        // the session cookie same-origin. In our SPA-on-:5173 split
        // there's no cookie, so Vite-dev injects an HTTP Basic
        // header from VITE_DEV_API_EMAIL/VITE_DEV_API_KEY — see
        // the warning block above for setup.
        "/user_uploads": authedMediaProxy("/user_uploads"),
        "/thumbnail": authedMediaProxy("/thumbnail"),
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
