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

import { brandColors, scales } from "./tokens";

export type ThemeName = "light" | "dark";

// --- avatar palette derivation -------------------------------------
//
// The avatar background roles are Flexar's own `brandColors.avatarMarble`
// palette. That palette is stored as hex, but the generated theme CSS
// must stay hex-free (Stylelint `color-no-hex`), so each marble colour
// is converted to an `hsl()` string here. The conversion preserves
// each colour's hue and saturation but deepens its lightness just
// enough that white initials text (`textOnAccent`) clears WCAG AA
// contrast — two of the marble hues are very light cyans that white
// text would otherwise fail against. The palette is theme-independent:
// the same roles are used in both light and dark themes.

// WCAG AA contrast target for white initials text on an avatar.
const AVATAR_MIN_CONTRAST = 4.5;

function srgbChannelToLinear(channel: number): number {
  return channel <= 0.03928
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4;
}

// Relative luminance (WCAG) of an sRGB colour given as 0..1 channels.
function relativeLuminance(r: number, g: number, b: number): number {
  return (
    0.2126 * srgbChannelToLinear(r) +
    0.7152 * srgbChannelToLinear(g) +
    0.0722 * srgbChannelToLinear(b)
  );
}

// Contrast ratio of white (#fff) text on a colour given as 0..1 channels.
function contrastWithWhite(r: number, g: number, b: number): number {
  return 1.05 / (relativeLuminance(r, g, b) + 0.05);
}

// HSL (h in degrees, s/l in 0..1) -> sRGB 0..1 channels.
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (hp < 1) {
    [r, g, b] = [c, x, 0];
  } else if (hp < 2) {
    [r, g, b] = [x, c, 0];
  } else if (hp < 3) {
    [r, g, b] = [0, c, x];
  } else if (hp < 4) {
    [r, g, b] = [0, x, c];
  } else if (hp < 5) {
    [r, g, b] = [x, 0, c];
  } else {
    [r, g, b] = [c, 0, x];
  }
  const m = l - c / 2;
  return [r + m, g + m, b + m];
}

// Convert a marble hex colour to an `hsl()` string, lowering lightness
// (hue and saturation untouched) until white text clears WCAG AA.
function marbleHexToReadableHsl(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let lightness = (max + min) / 2;
  let saturation = 0;
  let hue = 0;
  if (delta !== 0) {
    saturation = delta / (1 - Math.abs(2 * lightness - 1));
    if (max === r) {
      hue = ((g - b) / delta) % 6;
    } else if (max === g) {
      hue = (b - r) / delta + 2;
    } else {
      hue = (r - g) / delta + 4;
    }
    hue *= 60;
    if (hue < 0) {
      hue += 360;
    }
  }
  while (lightness > 0.05) {
    const [lr, lg, lb] = hslToRgb(hue, saturation, lightness);
    if (contrastWithWhite(lr, lg, lb) >= AVATAR_MIN_CONTRAST) {
      break;
    }
    lightness -= 0.01;
  }
  return `hsl(${Math.round(hue)}deg ${Math.round(saturation * 100)}% ${Math.round(
    lightness * 100,
  )}%)`;
}

// `brandColors.avatarMarble` has 5 entries -> `avatar1..avatar5` roles.
const avatarColors = brandColors.avatarMarble.map(marbleHexToReadableHsl);
const [avatar1, avatar2, avatar3, avatar4, avatar5] = avatarColors;

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
  success: string;
  successHover: string;
  warning: string;
  warningHover: string;
  hover: string;
  active: string;
  focusRing: string;
  // Semi-transparent dark scrim behind modal dialogs.
  overlayScrim: string;
  // Stronger scrim for media-focused overlays (the image lightbox).
  // Modals carry their own surface chrome and read fine against the
  // weaker scrim; a full-bleed image overlay needs a darker backdrop
  // so the image is the unmistakable subject.
  overlayScrimStrong: string;
  // Per-user avatar background palette. These are theme-independent
  // Flexar brand colours (`brandColors.avatarMarble` in `tokens.ts`),
  // exposed as flat `avatar1..avatarN` roles so the existing flat-key
  // role machinery can thread them through unchanged. Lightness is
  // tuned down from the raw marble values so white initials text
  // (`textOnAccent`) clears WCAG AA on every entry.
  avatar1: string;
  avatar2: string;
  avatar3: string;
  avatar4: string;
  avatar5: string;
  // Syntax-highlighting palette for code blocks (Pygments token
  // classes — `k`, `nb`, `s2`, `nf`, `c1`, `mi`, …). The server
  // pre-tokenises code blocks and ships them as `<span class="…">`;
  // we map the Pygments class vocabulary onto these six semantic
  // roles in `MessageContent.module.css`. Light + dark palettes are
  // tuned to GitHub's syntax colours, which are familiar to most
  // developers and contrast-tested.
  syntaxKeyword: string;
  syntaxBuiltin: string;
  syntaxString: string;
  syntaxNumber: string;
  syntaxComment: string;
  syntaxFunction: string;
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
  success: "hsl(142deg 71% 38%)",
  successHover: "hsl(142deg 71% 45%)",
  warning: "hsl(38deg 92% 45%)",
  warningHover: "hsl(38deg 92% 52%)",
  hover: "hsl(240deg 7% 11% / 5%)",
  active: "hsl(240deg 7% 11% / 9%)",
  focusRing: "hsl(215deg 100% 54% / 45%)",
  overlayScrim: "hsl(0deg 0% 0% / 50%)",
  overlayScrimStrong: "hsl(0deg 0% 0% / 80%)",
  avatar1,
  avatar2,
  avatar3,
  avatar4,
  avatar5,
  // Light syntax palette (GitHub-light derived).
  syntaxKeyword: "hsl(355deg 65% 45%)",
  syntaxBuiltin: "hsl(210deg 100% 40%)",
  syntaxString: "hsl(140deg 50% 30%)",
  syntaxNumber: "hsl(34deg 90% 38%)",
  syntaxComment: "hsl(212deg 9% 50%)",
  syntaxFunction: "hsl(265deg 50% 45%)",
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
  success: "hsl(142deg 64% 48%)",
  successHover: "hsl(142deg 64% 55%)",
  warning: "hsl(38deg 95% 55%)",
  warningHover: "hsl(38deg 95% 62%)",
  hover: "hsl(0deg 0% 100% / 7%)",
  active: "hsl(0deg 0% 100% / 12%)",
  focusRing: "hsl(213deg 100% 62% / 55%)",
  overlayScrim: "hsl(0deg 0% 0% / 65%)",
  overlayScrimStrong: "hsl(0deg 0% 0% / 88%)",
  avatar1,
  avatar2,
  avatar3,
  avatar4,
  avatar5,
  // Dark syntax palette (GitHub-dark derived). All tuned for ≥4.5:1
  // contrast against `surface` so AA holds for code-block text.
  syntaxKeyword: "hsl(355deg 100% 75%)",
  syntaxBuiltin: "hsl(208deg 100% 75%)",
  syntaxString: "hsl(140deg 50% 65%)",
  syntaxNumber: "hsl(34deg 80% 65%)",
  syntaxComment: "hsl(212deg 9% 60%)",
  syntaxFunction: "hsl(265deg 80% 80%)",
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
