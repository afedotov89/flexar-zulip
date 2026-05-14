// Flexar Hub Web — theme context (Phase 0.2).
//
// Split from `ThemeProvider.tsx` so the provider file exports only
// components (keeps React Fast Refresh happy) and the `useTheme` hook
// can import the context without pulling in the provider.

import { createContext } from "react";
import type { ThemeName } from "./theme";

export interface ThemeContextValue {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  toggleTheme: () => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);
