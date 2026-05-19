// Flexar Hub Web — theme module public surface (Phase 0.2).
//
// The token pipeline: `tokens.ts` -> typed theme object -> generated
// CSS custom properties + ThemeProvider/useTheme. `tokens.ts` itself is
// intentionally NOT re-exported — components consume tokens via CSS
// variables or this typed surface, never the raw source.

export { ThemeProvider } from "./ThemeProvider";
export { useTheme } from "./useTheme";
export type { ThemeContextValue, ThemeMode } from "./themeContext";
export {
  lightTheme,
  darkTheme,
  themes,
} from "./theme";
export type { Theme, ThemeName, ColorRoles } from "./theme";
export {
  buildThemeStylesheet,
  scaleVariableDeclarations,
  colorVariableDeclarations,
} from "./cssVariables";
