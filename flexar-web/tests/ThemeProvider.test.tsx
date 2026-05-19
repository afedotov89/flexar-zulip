import { render, screen, act } from "@testing-library/react";
import { ThemeProvider, useTheme } from "../src/theme";

function ThemeProbe() {
  const { mode, theme, setMode, toggleTheme } = useTheme();
  return (
    <div>
      <span data-testid="mode">{mode}</span>
      <span data-testid="theme">{theme}</span>
      <button type="button" onClick={toggleTheme}>
        toggle
      </button>
      <button type="button" onClick={() => setMode("dark")}>
        set-dark
      </button>
      <button type="button" onClick={() => setMode("system")}>
        set-system
      </button>
    </div>
  );
}

const STORAGE_KEY = "flexar-hub:theme";

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  document
    .getElementById("flexar-hub-theme-tokens")
    ?.remove();
});

describe("ThemeProvider", () => {
  it("injects the generated token stylesheet exactly once", () => {
    const { rerender } = render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );
    rerender(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );
    const styleNodes = document.querySelectorAll(
      "#flexar-hub-theme-tokens",
    );
    expect(styleNodes).toHaveLength(1);
    expect(styleNodes[0].textContent).toContain("--space-3: 12px;");
  });

  it("respects a stored mode on first load", () => {
    window.localStorage.setItem(STORAGE_KEY, "dark");
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("mode")).toHaveTextContent("dark");
    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("defaults to 'system' when no stored choice exists", () => {
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("mode")).toHaveTextContent("system");
  });

  it("toggleTheme flips the resolved theme and writes an explicit mode", () => {
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );
    // jsdom's default matchMedia returns matches=false, so initial
    // resolved theme under "system" is "light".
    expect(screen.getByTestId("theme")).toHaveTextContent("light");

    act(() => {
      screen.getByRole("button", { name: "toggle" }).click();
    });

    expect(screen.getByTestId("mode")).toHaveTextContent("dark");
    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("setMode applies and persists an explicit choice", () => {
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );
    act(() => {
      screen.getByRole("button", { name: "set-dark" }).click();
    });
    expect(screen.getByTestId("mode")).toHaveTextContent("dark");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("dark");
  });

  it("setMode('system') resolves theme via prefers-color-scheme", () => {
    window.localStorage.setItem(STORAGE_KEY, "dark");
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
    act(() => {
      screen.getByRole("button", { name: "set-system" }).click();
    });
    // jsdom's matchMedia returns matches=false by default; "system"
    // therefore resolves to "light".
    expect(screen.getByTestId("mode")).toHaveTextContent("system");
    expect(screen.getByTestId("theme")).toHaveTextContent("light");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("system");
  });

  it("throws when useTheme is used outside a provider", () => {
    function Orphan() {
      useTheme();
      return null;
    }
    // Silence the expected React error boundary console noise.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Orphan />)).toThrow(
      "useTheme must be used within a ThemeProvider",
    );
    spy.mockRestore();
  });
});
