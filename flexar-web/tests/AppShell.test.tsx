import { render, screen, act } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { App } from "../src/app/App";
import { apiClient } from "../src/api";
import { useAuthStore } from "../src/stores/authStore";
import { useLocaleStore } from "../src/lib/i18n";

// The app-shell renders inside the full provider stack (ThemeProvider ->
// QueryClientProvider -> RouterProvider), so these tests drive the real
// `App` root. The router boots at "/", which is behind the RequireAuth
// guard (Phase 1.1) — so each test stages an authenticated session
// first, otherwise the guard would render its loading/redirect state
// instead of the AppShell.

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  document.getElementById("flexar-hub-theme-tokens")?.remove();
  window.history.pushState({}, "", "/");
  // The locale store uses `persist`; ensure each test starts from
  // RU regardless of what a previous test left in storage.
  useLocaleStore.setState({ locale: "ru" });
  // Stage a signed-in session so RequireAuth renders the AppShell. The
  // store is the live singleton; no component is mounted at this point
  // (RTL's auto-cleanup unmounted the previous test), so a bare
  // setState here does not need `act`.
  useAuthStore.setState({
    session: { email: "tester@flexar.example", apiKey: "test-key" },
    status: "authenticated",
    isLoggingIn: false,
    error: null,
  });
  // The index route renders the message feed (Phase 1.6), which fetches
  // history on mount. Stub it with an empty window so the feed reaches
  // a deterministic state instead of hitting the network.
  vi.spyOn(apiClient, "getMessages").mockResolvedValue({
    messages: [],
    anchor: 0,
    foundNewest: true,
    foundOldest: true,
    foundAnchor: false,
    historyLimited: false,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AppShell", () => {
  it("renders the navbar and three structural columns", () => {
    render(<App />);

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(
      screen.getByRole("complementary", { name: "Каналы и навигация" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("complementary", { name: "О беседе" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("renders the routed Outlet content in the center column", async () => {
    render(<App />);

    // The index route redirects to /inbox ("Новые") — the new
    // default home view. With no unread messages the Inbox screen
    // settles on its empty state.
    const main = screen.getByRole("main");
    expect(
      await screen.findByText("Всё прочитано"),
    ).toBeInTheDocument();
    expect(main).toContainElement(screen.getByText("Всё прочитано"));
  });

  it("switches the theme via the account-menu cycle row", () => {
    // The standalone navbar toggle was retired in favour of a
    // cycling row in the account dropdown (light → dark → system).
    // Three radio rows ate a third of the menu for a rarely-changed
    // setting; the cycle compresses it to one.
    render(<App />);

    // Default: no stored choice → mode "system" → resolved theme
    // tracks `prefers-color-scheme`. jsdom's matchMedia returns
    // matches=false, so the resolved theme is "light".
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");

    // First open + click: system → light. The row label is
    // "Тема: Системная" because it shows the CURRENT mode.
    act(() => {
      screen
        .getByRole("button", { name: "Меню аккаунта" })
        .click();
    });
    act(() => {
      screen
        .getByRole("menuitem", { name: /Тема:/ })
        .click();
    });
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(window.localStorage.getItem("flexar-hub:theme")).toBe("light");

    // Second cycle: light → dark.
    act(() => {
      screen
        .getByRole("button", { name: "Меню аккаунта" })
        .click();
    });
    act(() => {
      screen
        .getByRole("menuitem", { name: /Тема:/ })
        .click();
    });
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(window.localStorage.getItem("flexar-hub:theme")).toBe("dark");
  });
});
