// Flexar Hub Web — useTheme hook (Phase 0.2).
//
// Exposes the active theme plus setters. Must be called inside a
// <ThemeProvider>; throws otherwise so misuse fails loudly.

import { useContext } from "react";
import { ThemeContext } from "./themeContext";
import type { ThemeContextValue } from "./themeContext";

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (value === null) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return value;
}
