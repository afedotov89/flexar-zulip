import { render, screen } from "@testing-library/react";
import { App } from "../src/app/App";
import { useAuthStore } from "../src/stores/authStore";

// Phase 0.5: `App` now mounts the provider stack (ThemeProvider ->
// QueryClientProvider -> RouterProvider). At "/" the router renders the
// app-shell — behind the RequireAuth guard since Phase 1.1, so the
// smoke test stages a session first. Detailed shell behaviour is
// covered in AppShell.test.tsx; this just confirms the root boots
// without crashing.

describe("App", () => {
  it("boots the app-shell inside the provider stack", () => {
    window.localStorage.clear();
    window.history.pushState({}, "", "/");
    useAuthStore.setState({
      session: { email: "tester@flexar.example", apiKey: "test-key" },
      status: "authenticated",
      isLoggingIn: false,
      error: null,
    });
    render(<App />);
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
  });
});
