import { render, screen } from "@testing-library/react";
import { App } from "../src/app/App";

// Phase 0.5: `App` now mounts the provider stack (ThemeProvider ->
// QueryClientProvider -> RouterProvider). At "/" the router renders the
// app-shell. Detailed shell behaviour is covered in AppShell.test.tsx;
// this smoke test just confirms the root boots without crashing.

describe("App", () => {
  it("boots the app-shell inside the provider stack", () => {
    window.history.pushState({}, "", "/");
    render(<App />);
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
  });
});
