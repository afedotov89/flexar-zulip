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
