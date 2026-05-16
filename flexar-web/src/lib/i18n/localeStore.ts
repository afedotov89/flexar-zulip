// Locale selection store (Phase 6.3).
//
// One bit of user-level preference: which catalogue `useI18n()` reads
// from. Persisted to `localStorage` (key `flexar-hub-locale`) so the
// next session opens in the language the user picked. On first visit
// we fall back to the browser's `navigator.language` prefix if it
// matches a known locale, else `DEFAULT_LOCALE` (ru).
//
// Why a separate store rather than a React provider: pickers, the
// navbar, and any future feature can read or write the locale without
// being a descendant of a provider, the same way the theme works
// (`useTheme`). The catalogue itself is module-load constant, so
// switching is just a re-render via the subscription.

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_LOCALE, type Locale } from "./locales";

function detectBrowserLocale(): Locale {
  if (typeof navigator === "undefined") {
    return DEFAULT_LOCALE;
  }
  const tag = (navigator.language ?? "").toLowerCase();
  if (tag.startsWith("ru")) {
    return "ru";
  }
  if (tag.startsWith("en")) {
    return "en";
  }
  return DEFAULT_LOCALE;
}

export interface LocaleState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      locale: detectBrowserLocale(),
      setLocale: (locale) => set({ locale }),
    }),
    {
      name: "flexar-hub-locale",
      partialize: (state) => ({ locale: state.locale }),
    },
  ),
);
