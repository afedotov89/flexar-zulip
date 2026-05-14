// Flexar Hub Web — built-in views registry (Phase 1.4).
//
// The left sidebar (Phase 1.5) lists a fixed set of top-level views.
// Some are *narrow views* — they are nothing more than a particular
// `Narrow`, and live under `/narrow/...` like any other narrow. Others
// are *special views* — Inbox, Recent, Drafts — which are their own
// screens with their own data shape, not a filter over the message
// feed. Forcing those into the `Narrow` type would be a lie, so the
// registry models the split explicitly.
//
// ── The views ───────────────────────────────────────────────────────
//
//   id          label (ru)          kind     path               narrow
//   ──────────  ──────────────────  ───────  ─────────────────  ───────────────────────────
//   inbox       Входящие            special  /inbox             —
//   recent      Последние           special  /recent            —
//   combined    Объединённая лента  narrow   /narrow            []  (the empty narrow)
//   mentions    Упоминания          narrow   /narrow/is/mentioned        [is:mentioned]
//   reactions   Реакции             narrow   /narrow/has/reaction/sender/me  [has:reaction, sender:me]
//   starred     Отмеченные          narrow   /narrow/is/starred          [is:starred]
//   drafts      Черновики           special  /drafts            —
//
// Note on Reactions: Zulip has no `is:reacted` operator. "My reactions"
// is expressed as `has:reaction` + `sender:me` (see Zulip's
// `web/src/left_sidebar_navigation_area.ts`), and both `has` and
// `sender` are in the domain `NarrowOperator` union — so Reactions is a
// genuine narrow view, not a special one.
//
// The `path` of a narrow view is exactly `narrowToPath(narrow)`; the
// registry stores it precomputed so the sidebar and router can use it
// without recomputing, and a unit test asserts the two agree.

import type { IconName } from "../../icons";
import type { Narrow } from "../../domain";
import { narrowToPath } from "./scheme";

/** Stable identifier for a built-in view. */
export type BuiltinViewId =
  | "inbox"
  | "recent"
  | "combined"
  | "mentions"
  | "reactions"
  | "starred"
  | "drafts";

/**
 * A built-in view that is just a narrow: navigating to it lands on a
 * `/narrow/...` URL and the message feed renders that narrow.
 */
export interface NarrowView {
  id: BuiltinViewId;
  kind: "narrow";
  /** ru-RU sidebar label. */
  label: string;
  /** Icon shown in the sidebar row, from the Flexar Hub icon set. */
  icon: IconName;
  /** The narrow this view shows. */
  narrow: Narrow;
  /** URL path for this view — equal to `narrowToPath(narrow)`. */
  path: string;
}

/**
 * A built-in view that is its own screen, not a filter over the
 * message feed (Inbox / Recent / Drafts). It has a route path but no
 * narrow.
 */
export interface SpecialView {
  id: BuiltinViewId;
  kind: "special";
  /** ru-RU sidebar label. */
  label: string;
  /** Icon shown in the sidebar row, from the Flexar Hub icon set. */
  icon: IconName;
  /** URL path for this view's dedicated screen. */
  path: string;
}

/** A built-in view: either a narrow view or a special screen. */
export type BuiltinView = NarrowView | SpecialView;

// Narrow definitions, kept as named constants so other modules can
// reference the exact narrow shapes without rebuilding them.
const COMBINED_FEED_NARROW: Narrow = [];
const MENTIONS_NARROW: Narrow = [{ operator: "is", operand: "mentioned" }];
const STARRED_NARROW: Narrow = [{ operator: "is", operand: "starred" }];
const REACTIONS_NARROW: Narrow = [
  { operator: "has", operand: "reaction" },
  { operator: "sender", operand: "me" },
];

/**
 * Every built-in view, in sidebar display order. The registry is the
 * single source of truth for view ids, labels, paths, and narrows.
 */
export const BUILTIN_VIEWS: readonly BuiltinView[] = [
  {
    id: "inbox",
    kind: "special",
    label: "Входящие",
    icon: "inbox",
    path: "/inbox",
  },
  {
    id: "recent",
    kind: "special",
    label: "Последние",
    icon: "recent",
    path: "/recent",
  },
  {
    id: "combined",
    kind: "narrow",
    label: "Объединённая лента",
    icon: "combined-feed",
    narrow: COMBINED_FEED_NARROW,
    path: narrowToPath(COMBINED_FEED_NARROW),
  },
  {
    id: "mentions",
    kind: "narrow",
    label: "Упоминания",
    icon: "mentions",
    narrow: MENTIONS_NARROW,
    path: narrowToPath(MENTIONS_NARROW),
  },
  {
    id: "reactions",
    kind: "narrow",
    label: "Реакции",
    icon: "smile",
    narrow: REACTIONS_NARROW,
    path: narrowToPath(REACTIONS_NARROW),
  },
  {
    id: "starred",
    kind: "narrow",
    label: "Отмеченные",
    icon: "star",
    narrow: STARRED_NARROW,
    path: narrowToPath(STARRED_NARROW),
  },
  {
    id: "drafts",
    kind: "special",
    label: "Черновики",
    icon: "drafts",
    path: "/drafts",
  },
];

// Lookup index, built once from the ordered list above.
const VIEWS_BY_ID = new Map<BuiltinViewId, BuiltinView>(
  BUILTIN_VIEWS.map((view) => [view.id, view]),
);

/** Look up a built-in view by its id. */
export function getBuiltinView(id: BuiltinViewId): BuiltinView {
  const view = VIEWS_BY_ID.get(id);
  if (view === undefined) {
    // Unreachable: `BuiltinViewId` is a closed union over `BUILTIN_VIEWS`.
    throw new Error(`unknown built-in view id "${id}"`);
  }
  return view;
}

/** The special (non-narrow) views, in display order. */
export const SPECIAL_VIEWS: readonly SpecialView[] = BUILTIN_VIEWS.filter(
  (view): view is SpecialView => view.kind === "special",
);
