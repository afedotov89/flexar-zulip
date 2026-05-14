import { render, screen, act } from "@testing-library/react";
import { App } from "../src/app/App";

// The app-shell renders inside the full provider stack (ThemeProvider ->
// QueryClientProvider -> RouterProvider), so these tests drive the real
// `App` root. The router boots at "/", which renders the AppShell layout
// with the Feed placeholder in the center <Outlet />.

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  document.getElementById("flexar-hub-theme-tokens")?.remove();
  window.history.pushState({}, "", "/");
});

describe("AppShell", () => {
  it("renders the navbar and three structural columns", () => {
    render(<App />);

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(
      screen.getByRole("complementary", { name: "Channels and navigation" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("complementary", { name: "Conversation details" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("renders the routed Outlet content in the center column", () => {
    render(<App />);

    const main = screen.getByRole("main");
    expect(main).toHaveTextContent("Message feed");
  });

  it("toggles the theme via the navbar toggle button", () => {
    render(<App />);

    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    const toggle = screen.getByRole("button", { name: "Switch to dark theme" });

    act(() => {
      toggle.click();
    });

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(
      screen.getByRole("button", { name: "Switch to light theme" }),
    ).toBeInTheDocument();
  });
});
