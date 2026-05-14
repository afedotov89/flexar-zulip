// Flexar Hub Web — ThemeProvider (Phase 0.2 token pipeline).
//
// Responsibilities:
//   - Inject the generated token stylesheet (`buildThemeStylesheet`)
//     into <head> exactly once.
//   - Resolve the initial theme: a stored choice wins; otherwise the
//     OS `prefers-color-scheme` is respected.
//   - Apply the active theme as `data-theme` on <html> and persist
//     explicit choices to `localStorage`.
//
// Components never read this directly — they consume the `--color-*`
// variables. They use `useTheme()` only to render a theme toggle.

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { buildThemeStylesheet } from "./cssVariables";
import type { ThemeName } from "./theme";
import { ThemeContext } from "./themeContext";

const STORAGE_KEY = "flexar-hub:theme";
const STYLE_ELEMENT_ID = "flexar-hub-theme-tokens";

function isThemeName(value: string | null): value is ThemeName {
  return value === "light" || value === "dark";
}

// Stored choice wins; fall back to the OS preference; default light.
function resolveInitialTheme(): ThemeName {
  if (typeof window === "undefined") {
    return "light";
  }
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (isThemeName(stored)) {
    return stored;
  }
  const prefersDark = window.matchMedia(
    "(prefers-color-scheme: dark)",
  ).matches;
  return prefersDark ? "dark" : "light";
}

// Inject the generated token declarations once. Idempotent so React
// StrictMode's double-invoke and hot reloads do not duplicate the node.
function ensureThemeStylesheet(): void {
  if (typeof document === "undefined") {
    return;
  }
  if (document.getElementById(STYLE_ELEMENT_ID) !== null) {
    return;
  }
  const style = document.createElement("style");
  style.id = STYLE_ELEMENT_ID;
  style.textContent = buildThemeStylesheet();
  document.head.appendChild(style);
}

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemeName>(resolveInitialTheme);

  // Inject the token stylesheet before first paint.
  useEffect(() => {
    ensureThemeStylesheet();
  }, []);

  // Reflect the active theme onto <html> for the CSS variable swap.
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const setTheme = useCallback((next: ThemeName) => {
    setThemeState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((current) => {
      const next: ThemeName = current === "light" ? "dark" : "light";
      window.localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}
