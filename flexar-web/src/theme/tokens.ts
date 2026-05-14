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
