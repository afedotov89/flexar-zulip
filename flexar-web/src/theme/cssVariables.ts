// Flexar Hub Web — CSS custom property generation (Phase 0.2).
//
// Turns the typed theme object into the `--token` declarations injected
// into the document. `tokens.ts` stays the single source of truth: the
// scale variables are emitted straight from `scales`, and the colour
// roles from each theme's `colors` map. Nothing here hardcodes a value
// that is not already in `tokens.ts` / `theme.ts`.
//
// Naming convention is the one frozen in ENGINEERING_GUIDE.md §2:
//   --space-3, --radius-md, --font-size-md, --font-weight-semibold,
//   --line-height-normal, --letter-spacing-wide, --control-height-md,
//   --duration-base, --shadow-md, --z-modal, --font-family-base,
//   --color-<role>.

import { scales } from "./tokens";
import type { ColorRoles, Theme } from "./theme";
import { darkTheme, lightTheme } from "./theme";

// Maps a `scales` group to `--<prefix>-<key>` declaration lines.
function scaleVars(
  prefix: string,
  group: Record<string, string | number>,
): string[] {
  return Object.entries(group).map(
    ([key, value]) => `--${prefix}-${key}: ${value};`,
  );
}

// camelCase role name -> kebab-case CSS variable suffix. A trailing
// digit run is also split off with a hyphen, so the numbered avatar
// roles (`avatar1`..`avatarN`) emit as `--color-avatar-1`..`-N`.
function kebab(name: string): string {
  return name
    .replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
    .replace(/(\d+)$/, "-$1");
}

function colorVars(colors: ColorRoles): string[] {
  return Object.entries(colors).map(
    ([role, value]) => `--color-${kebab(role)}: ${value};`,
  );
}

// Theme-independent scale variables. Emitted once, in `:root`.
export function scaleVariableDeclarations(): string[] {
  return [
    ...scaleVars("space", scales.space),
    ...scaleVars("radius", scales.radius),
    ...scaleVars("font-size", scales.fontSize),
    ...scaleVars("emoji-size", scales.emojiSize),
    ...scaleVars("font-weight", scales.fontWeight),
    ...scaleVars("line-height", scales.lineHeight),
    ...scaleVars("letter-spacing", scales.letterSpacing),
    ...scaleVars("control-height", scales.controlHeight),
    ...scaleVars("container-width", scales.containerWidth),
    ...scaleVars("duration", scales.duration),
    ...scaleVars("shadow", scales.shadow),
    ...scaleVars("z", scales.zIndex),
    ...scaleVars("font-family", scales.fontFamily),
  ];
}

// Per-theme colour-role variables.
export function colorVariableDeclarations(theme: Theme): string[] {
  return colorVars(theme.colors);
}

function block(selector: string, declarations: string[]): string {
  const body = declarations.map((line) => `  ${line}`).join("\n");
  return `${selector} {\n${body}\n}`;
}

// The complete stylesheet text: scale + light colours in `:root`, dark
// colours under `:root[data-theme="dark"]`. Injected once at startup by
// ThemeProvider; the active theme is selected via the `data-theme`
// attribute on <html>, so both colour sets are always present.
export function buildThemeStylesheet(): string {
  return [
    block(":root", [
      ...scaleVariableDeclarations(),
      ...colorVariableDeclarations(lightTheme),
    ]),
    block(':root[data-theme="dark"]', colorVariableDeclarations(darkTheme)),
  ].join("\n\n");
}
