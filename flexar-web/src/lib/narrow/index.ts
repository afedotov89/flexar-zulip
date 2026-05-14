// Flexar Hub Web — narrow ↔ URL module (Phase 1.4).
//
// Public surface for addressing narrows and built-in views via the
// browser URL. Phases 1.5 (sidebar) and 1.6 (message feed) consume
// this module; they should import from `../lib/narrow`, not the
// individual files.

export {
  NARROW_ROOT,
  narrowToPath,
  parseNarrowPath,
  type ChannelSlugResolver,
  type NarrowParseResult,
} from "./scheme";

export {
  BUILTIN_VIEWS,
  SPECIAL_VIEWS,
  getBuiltinView,
  type BuiltinView,
  type BuiltinViewId,
  type NarrowView,
  type SpecialView,
} from "./builtinViews";

export { useCurrentNarrow, useCurrentView } from "./useCurrentNarrow";

export { matchesNarrow, type MatchContext } from "./matchesNarrow";

export {
  useNarrowNavigation,
  type NarrowNavigation,
} from "./useNarrowNavigation";
