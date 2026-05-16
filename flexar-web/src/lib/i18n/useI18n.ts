// React-side i18n accessors (Phase 6.3).
//
// `useI18n()` returns the active `Messages` catalogue plus a `t()`
// helper that interpolates `{name}` placeholders into a template. The
// catalogue is read straight from `messages[locale]` — no async
// loading, no Suspense; the cost is negligible (a few kb per locale)
// and it sidesteps a thicket of boundary issues.
//
// `t(template, params)` is a simple positional formatter:
//
//   t("Hello, {name}", { name: "Alex" }) → "Hello, Alex"
//
// We avoid pulling in `react-intl` / `intl-messageformat` for a Phase
// 6 scope; if richer pluralization / date formatting is later needed,
// this is the seam to swap.

import { useLocaleStore } from "./localeStore";
import { messages, type Messages } from "./locales";

export interface I18n {
  /** The active catalogue. Use as `m.navbar.brand`, etc. */
  m: Messages;
  /** Format `template` by substituting `{key}` with `params[key]`. */
  t: (template: string, params?: Record<string, string | number>) => string;
}

export function useI18n(): I18n {
  const locale = useLocaleStore((state) => state.locale);
  const m = messages[locale];
  return { m, t: interpolate };
}

function interpolate(
  template: string,
  params?: Record<string, string | number>,
): string {
  if (params === undefined) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = params[key];
    return value === undefined ? match : String(value);
  });
}
