// Flexar Hub Web — typed theme object (Phase 0.2 token pipeline).
//
// This module is the typed bridge between the frozen `tokens.ts` source
// and the CSS custom properties emitted into the document. It does two
// things:
//   1. Re-exposes the `scales` layer as a typed object.
//   2. Derives a semantic `--color-*` role set (light + dark) from the
//      Flexar brand-colour layer in `tokens.ts`.
//
// Most consumption happens via CSS variables (see `cssVariables.ts` and
// `global.css`); this object exists so TS code can read token values
// directly when CSS variables are not reachable (e.g. canvas, tests).
//
// Colours are expressed as `hsl()` strings so the generated global CSS
// passes Stylelint's `color-no-hex` rule. Values reference the live
// Flexar app's measured design language (see `tokens.ts` header).

import { scales } from "./tokens";

export type ThemeName = "light" | "dark";

// Semantic colour roles. The full list is mirrored in
// COMPONENT_REGISTRY.md by the orchestrator.
export interface ColorRoles {
  accent: string;
  accentHover: string;
  accentActive: string;
  bg: string;
  surface: string;
  surfaceRaised: string;
  text: string;
  textMuted: string;
  textOnAccent: string;
  border: string;
  borderStrong: string;
  danger: string;
  dangerHover: string;
  hover: string;
  active: string;
  focusRing: string;
}

// Light role values. Accent and the page/surface/border anchors use the
// measured Flexar values called out in the Phase 0.2 spec.
const lightColors: ColorRoles = {
  accent: "hsl(215deg 100% 54%)",
  accentHover: "hsl(215deg 100% 62%)",
  accentActive: "hsl(215deg 100% 46%)",
  bg: "hsl(0deg 0% 97%)",
  surface: "hsl(0deg 0% 100%)",
  surfaceRaised: "hsl(0deg 0% 100%)",
  text: "hsl(240deg 7% 11%)",
  textMuted: "hsl(240deg 4% 45%)",
  textOnAccent: "hsl(0deg 0% 100%)",
  border: "hsl(214deg 32% 91%)",
  borderStrong: "hsl(214deg 20% 78%)",
  danger: "hsl(359deg 100% 65%)",
  dangerHover: "hsl(359deg 100% 72%)",
  hover: "hsl(240deg 7% 11% / 5%)",
  active: "hsl(240deg 7% 11% / 9%)",
  focusRing: "hsl(215deg 100% 54% / 45%)",
};

// Dark role values. Accent brightens slightly for contrast on dark
// surfaces, mirroring `brandColorsDark` in `tokens.ts`.
const darkColors: ColorRoles = {
  accent: "hsl(213deg 100% 62%)",
  accentHover: "hsl(213deg 100% 70%)",
  accentActive: "hsl(213deg 100% 54%)",
  bg: "hsl(0deg 0% 8%)",
  surface: "hsl(0deg 0% 12%)",
  surfaceRaised: "hsl(0deg 0% 16%)",
  text: "hsl(0deg 0% 92%)",
  textMuted: "hsl(0deg 0% 60%)",
  textOnAccent: "hsl(0deg 0% 100%)",
  border: "hsl(216deg 34% 17%)",
  borderStrong: "hsl(216deg 20% 32%)",
  danger: "hsl(359deg 100% 68%)",
  dangerHover: "hsl(359deg 100% 75%)",
  hover: "hsl(0deg 0% 100% / 7%)",
  active: "hsl(0deg 0% 100% / 12%)",
  focusRing: "hsl(213deg 100% 62% / 55%)",
};

// The full typed theme: the shared `scales` plus a per-theme colour set.
export interface Theme {
  name: ThemeName;
  colors: ColorRoles;
  scales: typeof scales;
}

export const lightTheme: Theme = {
  name: "light",
  colors: lightColors,
  scales,
};

export const darkTheme: Theme = {
  name: "dark",
  colors: darkColors,
  scales,
};

export const themes: Record<ThemeName, Theme> = {
  light: lightTheme,
  dark: darkTheme,
};
