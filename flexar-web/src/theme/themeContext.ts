// Flexar Hub Web — theme context (Phase 0.2; 3-mode auto/light/dark).
//
// Split from `ThemeProvider.tsx` so the provider file exports only
// components (keeps React Fast Refresh happy) and the `useTheme` hook
// can import the context without pulling in the provider.
//
// The context exposes two facts:
//   - `mode` — the user's PREFERENCE: explicit "light", explicit
//     "dark", or "system" (follow the OS).
//   - `theme` — the RESOLVED theme actually applied to the DOM
//     ("light" or "dark"). When `mode === "system"` this tracks the
//     OS `prefers-color-scheme` media query live.
//
// The Navbar reads `mode` to drive the picker's selected indicator
// and writes through `setMode`. The few consumers that just want
// "what theme is showing right now" (PrimitivesShowcase, etc.) read
// `theme`. `toggleTheme` is kept for backwards compatibility — it
// flips to the opposite of the resolved theme, leaving `mode` set
// explicitly (light or dark).

import { createContext } from "react";
import type { ThemeName } from "./theme";

export type ThemeMode = ThemeName | "system";

export interface ThemeContextValue {
  /** The user's explicit preference, including "system". */
  mode: ThemeMode;
  /** The currently-applied theme (resolves "system" → matchMedia). */
  theme: ThemeName;
  /** Set the explicit preference and persist it. */
  setMode: (mode: ThemeMode) => void;
  /** Flip between resolved light/dark; sets `mode` explicitly. */
  toggleTheme: () => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);
