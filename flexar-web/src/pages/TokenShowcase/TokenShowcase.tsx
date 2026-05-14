// Flexar Hub Web — token showcase page (Phase 0.2).
//
// Visually displays the token pipeline output: colour-role swatches,
// the spacing scale, radii, the type scale, font weights, shadows, plus
// a working theme toggle. Built with CSS Modules; consumes only the
// generated CSS variables (per-token variants via modifier classes —
// no hardcoded values, no inline styles). This is the orchestrator's
// browser-test surface for Phase 0.2.

import { useTheme } from "../../theme";
import { lightTheme, darkTheme } from "../../theme";
import type { ColorRoles } from "../../theme";
import styles from "./TokenShowcase.module.css";

// Colour roles, paired with the modifier class that paints the chip and
// a human label. Order matches `ColorRoles` for easy cross-checking.
const colorRoles: ReadonlyArray<{
  role: keyof ColorRoles;
  label: string;
  chipClass: string;
}> = [
  { role: "accent", label: "--color-accent", chipClass: styles.chipAccent },
  {
    role: "accentHover",
    label: "--color-accent-hover",
    chipClass: styles.chipAccentHover,
  },
  {
    role: "accentActive",
    label: "--color-accent-active",
    chipClass: styles.chipAccentActive,
  },
  { role: "bg", label: "--color-bg", chipClass: styles.chipBg },
  { role: "surface", label: "--color-surface", chipClass: styles.chipSurface },
  {
    role: "surfaceRaised",
    label: "--color-surface-raised",
    chipClass: styles.chipSurfaceRaised,
  },
  { role: "text", label: "--color-text", chipClass: styles.chipText },
  {
    role: "textMuted",
    label: "--color-text-muted",
    chipClass: styles.chipTextMuted,
  },
  {
    role: "textOnAccent",
    label: "--color-text-on-accent",
    chipClass: styles.chipTextOnAccent,
  },
  { role: "border", label: "--color-border", chipClass: styles.chipBorder },
  {
    role: "borderStrong",
    label: "--color-border-strong",
    chipClass: styles.chipBorderStrong,
  },
  { role: "danger", label: "--color-danger", chipClass: styles.chipDanger },
  {
    role: "dangerHover",
    label: "--color-danger-hover",
    chipClass: styles.chipDangerHover,
  },
  { role: "hover", label: "--color-hover", chipClass: styles.chipHover },
  { role: "active", label: "--color-active", chipClass: styles.chipActive },
  {
    role: "focusRing",
    label: "--color-focus-ring",
    chipClass: styles.chipFocusRing,
  },
];

// Spacing scale: token key, the bar-width modifier class, the value.
const spaceItems: ReadonlyArray<{
  key: string;
  barClass: string;
  value: string;
}> = [
  { key: "0", barClass: styles.space0, value: lightTheme.scales.space[0] },
  { key: "1", barClass: styles.space1, value: lightTheme.scales.space[1] },
  { key: "2", barClass: styles.space2, value: lightTheme.scales.space[2] },
  { key: "3", barClass: styles.space3, value: lightTheme.scales.space[3] },
  { key: "4", barClass: styles.space4, value: lightTheme.scales.space[4] },
  { key: "5", barClass: styles.space5, value: lightTheme.scales.space[5] },
  { key: "6", barClass: styles.space6, value: lightTheme.scales.space[6] },
  { key: "8", barClass: styles.space8, value: lightTheme.scales.space[8] },
  { key: "10", barClass: styles.space10, value: lightTheme.scales.space[10] },
  { key: "12", barClass: styles.space12, value: lightTheme.scales.space[12] },
];

const radiusItems: ReadonlyArray<{
  key: string;
  boxClass: string;
  value: string;
}> = [
  { key: "sm", boxClass: styles.radiusSm, value: lightTheme.scales.radius.sm },
  { key: "md", boxClass: styles.radiusMd, value: lightTheme.scales.radius.md },
  { key: "lg", boxClass: styles.radiusLg, value: lightTheme.scales.radius.lg },
  { key: "xl", boxClass: styles.radiusXl, value: lightTheme.scales.radius.xl },
  {
    key: "full",
    boxClass: styles.radiusFull,
    value: lightTheme.scales.radius.full,
  },
];

const typeItems: ReadonlyArray<{
  key: string;
  sizeClass: string;
  value: string;
}> = [
  { key: "xs", sizeClass: styles.fontSizeXs, value: lightTheme.scales.fontSize.xs },
  { key: "sm", sizeClass: styles.fontSizeSm, value: lightTheme.scales.fontSize.sm },
  { key: "md", sizeClass: styles.fontSizeMd, value: lightTheme.scales.fontSize.md },
  { key: "lg", sizeClass: styles.fontSizeLg, value: lightTheme.scales.fontSize.lg },
  { key: "xl", sizeClass: styles.fontSizeXl, value: lightTheme.scales.fontSize.xl },
  {
    key: "2xl",
    sizeClass: styles.fontSize2xl,
    value: lightTheme.scales.fontSize["2xl"],
  },
];

const weightItems: ReadonlyArray<{
  key: string;
  weightClass: string;
  value: number;
}> = [
  {
    key: "regular",
    weightClass: styles.weightRegular,
    value: lightTheme.scales.fontWeight.regular,
  },
  {
    key: "medium",
    weightClass: styles.weightMedium,
    value: lightTheme.scales.fontWeight.medium,
  },
  {
    key: "semibold",
    weightClass: styles.weightSemibold,
    value: lightTheme.scales.fontWeight.semibold,
  },
  {
    key: "bold",
    weightClass: styles.weightBold,
    value: lightTheme.scales.fontWeight.bold,
  },
];

const shadowItems: ReadonlyArray<{
  key: string;
  boxClass: string;
}> = [
  { key: "sm", boxClass: styles.shadowSm },
  { key: "md", boxClass: styles.shadowMd },
  { key: "lg", boxClass: styles.shadowLg },
];

export function TokenShowcase() {
  const { theme, toggleTheme } = useTheme();

  // The active theme's resolved colour values, for the swatch captions.
  const activeColors = theme === "dark" ? darkTheme.colors : lightTheme.colors;

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.headerText}>
            <h1 className={styles.title}>Flexar Hub — Design Tokens</h1>
            <p className={styles.subtitle}>
              Phase 0.2 token pipeline. Active theme: {theme}.
            </p>
          </div>
          <button
            type="button"
            className={styles.themeToggle}
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          >
            Toggle theme
          </button>
        </header>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Colour roles</h2>
          <div className={styles.swatchGrid}>
            {colorRoles.map(({ role, label, chipClass }) => (
              <div key={role} className={styles.swatch}>
                <div className={`${styles.swatchChip} ${chipClass}`} />
                <span className={styles.swatchName}>{label}</span>
                <span className={styles.swatchValue}>
                  {activeColors[role]}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Spacing scale</h2>
          <div className={styles.spaceList}>
            {spaceItems.map(({ key, barClass, value }) => (
              <div key={key} className={styles.spaceRow}>
                <span className={styles.spaceLabel}>--space-{key}</span>
                <span className={`${styles.spaceBar} ${barClass}`} />
                <span className={styles.spaceValue}>{value}</span>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Radii</h2>
          <div className={styles.radiusGrid}>
            {radiusItems.map(({ key, boxClass, value }) => (
              <div key={key} className={styles.radiusItem}>
                <div className={`${styles.radiusBox} ${boxClass}`} />
                <span className={styles.radiusLabel}>
                  --radius-{key} · {value}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Type scale</h2>
          <div className={styles.typeList}>
            {typeItems.map(({ key, sizeClass, value }) => (
              <div key={key} className={styles.typeRow}>
                <span className={styles.typeLabel}>--font-size-{key}</span>
                <span className={`${styles.typeSample} ${sizeClass}`}>
                  The quick brown fox ({value})
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Font weights</h2>
          <div className={styles.weightList}>
            {weightItems.map(({ key, weightClass, value }) => (
              <div key={key} className={styles.weightItem}>
                <span className={`${styles.weightSample} ${weightClass}`}>
                  Flexar Hub
                </span>
                <span className={styles.weightLabel}>
                  --font-weight-{key} · {value}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Shadows</h2>
          <div className={styles.shadowGrid}>
            {shadowItems.map(({ key, boxClass }) => (
              <div key={key} className={styles.shadowItem}>
                <div className={`${styles.shadowBox} ${boxClass}`} />
                <span className={styles.shadowLabel}>--shadow-{key}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
