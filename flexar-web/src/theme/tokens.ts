// Design tokens for global UI theme
// These map directly to Ant Design v5 theme tokens via ConfigProvider.theme.token
// This file is the SINGLE SOURCE OF TRUTH for brand colors.
// CSS variables in tailwind.css are synced from here via app.tsx useEffect.

// 1) Project base tokens (previously defined as a separate block in app.tsx)
export const projectBaseTokens = {
  // Typography
  fontFamily: 'Inter',
} as const;

// 2) Brand colors - SINGLE SOURCE OF TRUTH
export const brandColors = {
  // Primary blue (original Flexar theme)
  primary: '#1677ff', // hsl(217, 91%, 55%)
  primaryHover: '#4096ff',
  primaryBg: '#e6f4ff',

  // Error/Danger color (for delete buttons, error states)
  error: '#ff4d4f',
  errorHover: '#ff7875',

  // Layout backgrounds (matching new-home-page design)
  // Page background - slightly gray (0 0% 97%)
  background: '#f7f7f7',
  // Sidebar background - white
  sidebarBackground: '#ffffff',
  // Card background - white
  cardBackground: '#ffffff',

  // Avatar palette (original multicolor)
  avatarGradient1: { from: '#4F6DEE', to: '#67BDF9' },
  avatarGradient2: { from: '#38A04D', to: '#93DCA2' },
  avatarGradient3: { from: '#C35F2B', to: '#EDB395' },
  avatarGradient4: { from: '#633897', to: '#CBA1FF' },
  avatarMarble: ['#42D7E7', '#478AF5', '#9B51E0', '#87CEEB', '#6B46C1'],
} as const;

// Dark mode brand color adjustments
export const brandColorsDark = {
  primary: '#4096ff', // slightly brighter for dark mode
  primaryHover: '#69b1ff',
  primaryBg: '#111a2c',

  // Error/Danger color (same for dark mode, can adjust if needed)
  error: '#ff4d4f',
  errorHover: '#ff7875',

  // Layout backgrounds for dark mode
  background: '#141414',
  sidebarBackground: '#1a1a1a',
  cardBackground: '#1f1f1f',

  avatarGradient1: { from: '#4F6DEE', to: '#67BDF9' },
  avatarGradient2: { from: '#38A04D', to: '#93DCA2' },
  avatarGradient3: { from: '#C35F2B', to: '#EDB395' },
  avatarGradient4: { from: '#633897', to: '#CBA1FF' },
  avatarMarble: ['#42D7E7', '#478AF5', '#9B51E0', '#87CEEB', '#6B46C1'],
} as const;

// 3) Safe shared tokens for both themes (do not break dark mode)
export const sharedTokens = {
  // Colors - use brandColors
  colorPrimary: brandColors.primary,
  colorLink: brandColors.primary,
  colorPrimaryHover: brandColors.primaryHover,
  colorPrimaryBg: brandColors.primaryBg,
  colorError: brandColors.error,
  colorErrorHover: brandColors.errorHover,

  // Typography scale
  fontSize: 14,
  fontSizeLG: 16,

  // Ant Design controls/shape
  borderRadiusLG: 8,
  controlHeightLG: 40,
  lineWidth: 1,
} as const;

// Light-only overrides (safe to apply only in light theme)
export const lightOverrides = {
  colorTextBase: '#18181d',
  colorTextTertiary: '#18181d73', // rgba(24,24,29,0.45)
  colorBorderSecondary: '#eaeaea',
  colorFillSecondary: '#18181d0f', // rgba(24,24,29,0.06)
} as const;

// Dark theme overrides
export const darkOverrides = {
  colorPrimary: brandColorsDark.primary,
  colorLink: brandColorsDark.primary,
  colorPrimaryHover: brandColorsDark.primaryHover,
  colorPrimaryBg: brandColorsDark.primaryBg,
  colorError: brandColorsDark.error,
  colorErrorHover: brandColorsDark.errorHover,
} as const;

export const designTokensLight = {
  ...projectBaseTokens,
  ...sharedTokens,
  ...lightOverrides,
} as const;

export const designTokensDark = {
  ...projectBaseTokens,
  ...sharedTokens,
  ...darkOverrides,
} as const;

// Back-compat default (light)
export const designTokens = designTokensLight;

export const componentTokens = {
  Menu: {
    light: {
      itemSelectedColor: '#ffffff',
    },
    dark: {
      itemSelectedColor: '#ffffff',
    },
  },
} as const;

// ============================================================
// Flexar Hub semantic scale layer.
//
// The imported Flexar tokens above are Ant-Design-shaped and thin —
// they carry brand colours but no spacing / radius / typography
// scales. Per the PRD (§1.4, owner decision option 1) the scales
// below are established here as the Flexar Hub design-system scale
// layer; the token pipeline (Phase 0.2) emits CSS custom properties
// from them. Values are derived from the live Flexar app's measured
// design language; they may later be reconciled with Flexar's own
// scales without changing variable names.
// ============================================================

export const scales = {
  // Spacing — 4px base. Key ≈ px / 4.
  space: {
    0: '0',
    1: '4px',
    2: '8px',
    3: '12px',
    4: '16px',
    5: '20px',
    6: '24px',
    8: '32px',
    10: '40px',
    12: '48px',
  },

  // Corner radii — controls 8, popovers 10, cards/modals 12.
  radius: {
    sm: '6px',
    md: '8px',
    lg: '10px',
    xl: '12px',
    full: '9999px',
  },

  // Type scale. Base UI size 14; xs 11 is the micro-label size.
  fontSize: {
    xs: '11px',
    sm: '13px',
    md: '14px',
    lg: '16px',
    xl: '20px',
    '2xl': '24px',
  },

  // Emoji glyph sizes. Emoji are intentionally NOT tied to the text
  // `fontSize` scale — they live in their own visual register, and
  // their natural sort order is by CONTEXT, not by size (the picker
  // wants the largest glyphs so the user can recognise + tap them,
  // while reaction chips want the smallest to fit the pill). So
  // tokens are named after their use site, not `sm`/`md`/`lg`.
  //
  //   `picker` — selection grids. Big enough to pick by sight on a
  //              touch / quick scan; users compare many at once.
  //   `inline` — applied/used emoji: inline in message content,
  //              status rows, navbar identity. Slightly larger than
  //              text so a single glyph in a paragraph reads.
  //   `chip`   — reaction chips. The chip is a small pill (height
  //              ~28px) and the emoji's NATIVE render is taller
  //              than the CSS `font-size` (~+25%), so 16px CSS
  //              still visually reads at ~20px — anything larger
  //              packs the chip with no breathing room.
  emojiSize: {
    picker: '24px',
    inline: '20px',
    //   `compact` — dense list rows (right-sidebar user list) where
    //              `inline` reads as oversized against the xs status
    //              line. Two pixels shy of `inline`; still bigger
    //              than text so a single glyph reads clearly.
    compact: '18px',
    chip: '16px',
  },

  fontWeight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },

  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.7,
  },

  // Letter spacing — `wide` is for tracked uppercase micro-labels.
  letterSpacing: {
    normal: '0',
    wide: '0.07em',
  },

  // Control heights — inputs, buttons, etc.
  controlHeight: {
    sm: '28px',
    md: '36px',
    lg: '40px',
  },

  // Container / dialog widths — max-width tiers for modals and other
  // bounded containers. `xs` ≈ 240px suits tooltips; `md` ≈ 480px is a
  // comfortable modal width.
  containerWidth: {
    xs: '240px',
    sm: '360px',
    md: '480px',
    lg: '640px',
  },

  // Transition durations.
  duration: {
    fast: '120ms',
    base: '200ms',
    slow: '320ms',
  },

  // Elevation. Soft shadows, never hard 1px lines.
  shadow: {
    sm: '0 1px 3px hsl(0deg 0% 0% / 6%)',
    md: '0 4px 16px hsl(0deg 0% 0% / 10%)',
    lg: '0 12px 48px hsl(0deg 0% 0% / 16%), 0 2px 8px hsl(0deg 0% 0% / 10%)',
  },

  // Stacking order.
  zIndex: {
    base: 0,
    dropdown: 1000,
    sticky: 1100,
    overlay: 1200,
    modal: 1300,
    popover: 1400,
    tooltip: 1500,
    toast: 1600,
  },

  // Font stack — Inter is the brand face; bundle it, with fallbacks.
  fontFamily: {
    base: '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    mono: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
  },
} as const;
