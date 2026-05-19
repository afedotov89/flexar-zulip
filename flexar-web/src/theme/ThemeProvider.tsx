// Flexar Hub Web — ThemeProvider (Phase 0.2 token pipeline;
// 3-mode auto/light/dark).
//
// Responsibilities:
//   - Inject the generated token stylesheet (`buildThemeStylesheet`)
//     into <head> exactly once.
//   - Resolve the initial mode from localStorage (default "system").
//   - Track `prefers-color-scheme` live so an OS-level theme change
//     propagates immediately when mode === "system".
//   - Apply the resolved theme as `data-theme` on <html> and persist
//     mode changes to localStorage.
//
// Components never read this directly — they consume the `--color-*`
// variables. They use `useTheme()` for the theme picker UI.

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { buildThemeStylesheet } from "./cssVariables";
import type { ThemeName } from "./theme";
import { ThemeContext, type ThemeMode } from "./themeContext";

const STORAGE_KEY = "flexar-hub:theme";
const STYLE_ELEMENT_ID = "flexar-hub-theme-tokens";
const SYSTEM_QUERY = "(prefers-color-scheme: dark)";

function isThemeMode(value: string | null): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system";
}

// Stored choice wins; otherwise default to "system" — modern OS
// theming is sophisticated enough that following it is the right
// out-of-box behaviour. The old default ("light") meant users on
// dark-mode systems hit a light flash on first visit.
function resolveInitialMode(): ThemeMode {
  if (typeof window === "undefined") {
    return "system";
  }
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (isThemeMode(stored)) {
    return stored;
  }
  return "system";
}

function systemPrefersDark(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.matchMedia(SYSTEM_QUERY).matches;
}

function resolveTheme(mode: ThemeMode, systemDark: boolean): ThemeName {
  if (mode === "system") {
    return systemDark ? "dark" : "light";
  }
  return mode;
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
  const [mode, setModeState] = useState<ThemeMode>(resolveInitialMode);
  const [systemDark, setSystemDark] = useState<boolean>(systemPrefersDark);

  // Watch the OS theme preference. The listener stays attached
  // regardless of `mode` — its cost is negligible and it means
  // switching FROM explicit to "system" picks up the current OS
  // state without a re-mount.
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const mql = window.matchMedia(SYSTEM_QUERY);
    const handler = (e: MediaQueryListEvent): void => {
      setSystemDark(e.matches);
    };
    // Safari < 14 only supports the deprecated addListener API.
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", handler);
      return () => mql.removeEventListener("change", handler);
    }
    mql.addListener(handler);
    return () => mql.removeListener(handler);
  }, []);

  const theme = resolveTheme(mode, systemDark);

  // Inject the token stylesheet before first paint.
  useEffect(() => {
    ensureThemeStylesheet();
  }, []);

  // Reflect the active theme onto <html> for the CSS variable swap.
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const toggleTheme = useCallback(() => {
    setModeState((current) => {
      const currentResolved =
        current === "system"
          ? systemPrefersDark()
            ? "dark"
            : "light"
          : current;
      const next: ThemeMode =
        currentResolved === "light" ? "dark" : "light";
      window.localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ mode, theme, setMode, toggleTheme }),
    [mode, theme, setMode, toggleTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}
