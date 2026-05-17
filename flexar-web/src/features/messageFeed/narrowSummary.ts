// Pure helper: turn a `Narrow` into a (icon + primary + optional
// secondary) summary for display in the persistent narrow header.
//
// Priority order matches what a reader expects when glancing at the
// header:
//
//   1. Built-in views (combined, mentions, starred, reactions) —
//      labelled exactly as they appear in the left sidebar so the
//      header and the sidebar speak the same language.
//   2. A channel narrow (with optional topic) — the most common case.
//   3. A direct-message narrow — the participant names.
//   4. Search — the raw query, in quotes.
//   5. Anything else — a generic "Лента" fallback.
//
// Returns plain data; the JSX is the caller's job. Keeping this side-
// effect-free makes it cheap to unit-test if we add the header to a
// snapshot suite later.

import type { IconName } from "../../icons";
import type { Narrow, Stream, StreamId, User, UserId } from "../../domain";
import { BUILTIN_VIEWS } from "../../lib/narrow/builtinViews";
import { narrowToPath } from "../../lib/narrow";

export interface NarrowSummary {
  icon: IconName;
  primary: string;
  /** Second line / segment — currently a topic when one is present. */
  secondary?: string;
}

export interface NarrowSummaryHelpers {
  getStream: (streamId: StreamId) => Stream | undefined;
  getUser: (userId: UserId) => User | undefined;
}

export function summarizeNarrow(
  narrow: Narrow,
  helpers: NarrowSummaryHelpers,
): NarrowSummary {
  // Built-in views, identified by exact path equality with the
  // registry. Covers the empty narrow (combined feed) and the curated
  // filters in the sidebar — all sharing wording with the sidebar row.
  let targetPath: string | undefined;
  try {
    targetPath = narrowToPath(narrow);
  } catch {
    // A malformed narrow falls through to the generic fallback below.
  }
  if (targetPath !== undefined) {
    for (const view of BUILTIN_VIEWS) {
      if (view.kind === "narrow" && view.path === targetPath) {
        return { icon: view.icon, primary: view.label };
      }
    }
  }

  const channelTerm = narrow.find(
    (term) => term.operator === "channel" || term.operator === "stream",
  );
  const topicTerm = narrow.find((term) => term.operator === "topic");
  if (channelTerm !== undefined && typeof channelTerm.operand === "number") {
    const stream = helpers.getStream(channelTerm.operand);
    return {
      icon: "hash",
      primary: stream?.name ?? `Канал ${channelTerm.operand}`,
      secondary:
        typeof topicTerm?.operand === "string" && topicTerm.operand !== ""
          ? topicTerm.operand
          : undefined,
    };
  }

  const dmTerm = narrow.find(
    (term) => term.operator === "dm" || term.operator === "pm-with",
  );
  if (dmTerm !== undefined && Array.isArray(dmTerm.operand)) {
    const ids = dmTerm.operand as number[];
    const names = ids.map(
      (id) => helpers.getUser(id)?.full_name ?? `User ${id}`,
    );
    return {
      icon: "user",
      primary: names.length === 0 ? "Личная беседа" : names.join(", "),
    };
  }

  const searchTerm = narrow.find((term) => term.operator === "search");
  if (searchTerm !== undefined && typeof searchTerm.operand === "string") {
    return { icon: "search", primary: `Поиск: «${searchTerm.operand}»` };
  }

  return { icon: "inbox", primary: "Лента" };
}
