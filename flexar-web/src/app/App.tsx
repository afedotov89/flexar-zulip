// Flexar Hub Web — application root (Phase 0.5).
//
// Provider stack, outermost to innermost:
//   ThemeProvider        — token pipeline + theme switching (Phase 0.2)
//   QueryClientProvider  — shared TanStack Query client (server-state)
//   RouterProvider       — React Router route table (see routes.tsx)
//
// The QueryClient is a plain default instance; no network work happens
// in this phase.
//
// On mount we call the auth store's `initialize()` once. `persist` has
// already synchronously hydrated the session from `localStorage` by
// then, so `initialize()` resolves the auth `status` out of its
// `"unknown"` startup state — see `stores/authStore` for why this lives
// in a mount effect rather than `onRehydrateStorage`.

import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { ThemeProvider } from "../theme";
import { useAuthStore } from "../stores/authStore";
import { router } from "./routes";

const queryClient = new QueryClient();

export function App() {
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
