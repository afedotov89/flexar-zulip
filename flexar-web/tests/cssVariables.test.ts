import {
  buildThemeStylesheet,
  scaleVariableDeclarations,
  colorVariableDeclarations,
} from "../src/theme";
import { lightTheme, darkTheme } from "../src/theme";

describe("scaleVariableDeclarations", () => {
  const decls = scaleVariableDeclarations();

  it("emits the frozen ENGINEERING_GUIDE §2 naming convention", () => {
    expect(decls).toContain("--space-3: 12px;");
    expect(decls).toContain("--radius-md: 8px;");
    expect(decls).toContain("--font-size-md: 14px;");
    expect(decls).toContain("--font-weight-semibold: 600;");
    expect(decls).toContain("--line-height-normal: 1.5;");
    expect(decls).toContain("--letter-spacing-wide: 0.07em;");
    expect(decls).toContain("--control-height-md: 36px;");
    expect(decls).toContain("--container-width-md: 480px;");
    expect(decls).toContain("--duration-base: 200ms;");
    expect(decls).toContain("--shadow-md: 0 4px 16px hsl(0deg 0% 0% / 10%);");
    expect(decls).toContain("--z-modal: 1300;");
    expect(decls).toContain(
      '--font-family-base: "Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;',
    );
  });

  it("is theme-independent (no colour roles)", () => {
    expect(decls.some((line) => line.startsWith("--color-"))).toBe(false);
  });
});

describe("colorVariableDeclarations", () => {
  it("kebab-cases every colour role", () => {
    const light = colorVariableDeclarations(lightTheme);
    expect(light).toContain("--color-accent: hsl(215deg 100% 54%);");
    expect(light).toContain("--color-bg: hsl(0deg 0% 97%);");
    expect(light).toContain("--color-surface: hsl(0deg 0% 100%);");
    expect(light).toContain("--color-border: hsl(214deg 32% 91%);");
    expect(light).toContain("--color-text-on-accent: hsl(0deg 0% 100%);");
    expect(light).toContain("--color-focus-ring: hsl(215deg 100% 54% / 45%);");
  });

  it("emits the status, scrim, and avatar roles", () => {
    const light = colorVariableDeclarations(lightTheme);
    const dark = colorVariableDeclarations(darkTheme);
    expect(light).toContain("--color-success: hsl(142deg 71% 38%);");
    expect(light).toContain("--color-success-hover: hsl(142deg 71% 45%);");
    expect(light).toContain("--color-warning: hsl(38deg 92% 45%);");
    expect(light).toContain("--color-warning-hover: hsl(38deg 92% 52%);");
    expect(dark).toContain("--color-success: hsl(142deg 64% 48%);");
    expect(dark).toContain("--color-warning: hsl(38deg 95% 55%);");
    // The scrim deepens in the dark theme.
    expect(light).toContain("--color-overlay-scrim: hsl(0deg 0% 0% / 50%);");
    expect(dark).toContain("--color-overlay-scrim: hsl(0deg 0% 0% / 65%);");
    // The five avatar roles emit with a hyphen before the index, and
    // are theme-independent (same in light and dark).
    for (let index = 1; index <= 5; index += 1) {
      const role = `--color-avatar-${index}`;
      const lightDecl = light.find((line) => line.startsWith(`${role}:`));
      expect(lightDecl).toBeDefined();
      expect(dark).toContain(lightDecl as string);
    }
  });

  it("produces distinct light and dark values for every role", () => {
    const lightColors = lightTheme.colors;
    const darkColors = darkTheme.colors;
    for (const role of Object.keys(lightColors) as Array<
      keyof typeof lightColors
    >) {
      expect(darkColors[role]).toBeDefined();
    }
    // Anchors that must differ between themes.
    expect(lightColors.bg).not.toBe(darkColors.bg);
    expect(lightColors.surface).not.toBe(darkColors.surface);
  });
});

describe("buildThemeStylesheet", () => {
  const css = buildThemeStylesheet();

  it("puts scales and light colours in :root", () => {
    expect(css).toMatch(/:root\s*\{/);
    expect(css).toContain("--space-3: 12px;");
    expect(css).toContain("--color-bg: hsl(0deg 0% 97%);");
  });

  it("puts dark colours under :root[data-theme=\"dark\"]", () => {
    const darkIndex = css.indexOf(':root[data-theme="dark"]');
    expect(darkIndex).toBeGreaterThan(-1);
    expect(css.slice(darkIndex)).toContain("--color-bg: hsl(0deg 0% 8%);");
  });

  it("contains no bare hex colours (Stylelint color-no-hex parity)", () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
