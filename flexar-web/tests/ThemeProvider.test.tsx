import { render, screen, act } from "@testing-library/react";
import { ThemeProvider, useTheme } from "../src/theme";

function ThemeProbe() {
  const { theme, setTheme, toggleTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <button type="button" onClick={toggleTheme}>
        toggle
      </button>
      <button type="button" onClick={() => setTheme("dark")}>
        set-dark
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

  it("respects a stored theme choice on first load", () => {
    window.localStorage.setItem(STORAGE_KEY, "dark");
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("toggleTheme flips the theme and persists it", () => {
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("theme")).toHaveTextContent("light");

    act(() => {
      screen.getByRole("button", { name: "toggle" }).click();
    });

    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("setTheme applies and persists an explicit choice", () => {
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );
    act(() => {
      screen.getByRole("button", { name: "set-dark" }).click();
    });
    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("dark");
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
