// Flexar Hub Web — application root (Phase 0.5).
//
// Provider stack, outermost to innermost:
//   ThemeProvider        — token pipeline + theme switching (Phase 0.2)
//   QueryClientProvider  — shared TanStack Query client (server-state)
//   RouterProvider       — React Router route table (see routes.tsx)
//
// The QueryClient is a plain default instance; no network work happens
// in this phase.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { ThemeProvider } from "../theme";
import { router } from "./routes";

const queryClient = new QueryClient();

export function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
