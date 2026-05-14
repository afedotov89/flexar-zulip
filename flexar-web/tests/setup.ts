import "@testing-library/jest-dom/vitest";

// jsdom does not implement `window.matchMedia`. Provide a minimal stub
// so code that reads `prefers-color-scheme` (e.g. ThemeProvider's
// initial-theme resolution) runs under the test environment. Defaults
// to "not matched" — tests that need a specific preference override it.
if (typeof window.matchMedia !== "function") {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
