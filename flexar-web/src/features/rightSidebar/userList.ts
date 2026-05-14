// User-list ordering and filtering for the right sidebar (1.8).
//
// The right sidebar renders people in two places — the full
// organization directory and the contextual section (channel
// subscribers / DM participants). Both want the same ordering and the
// same client-side name filter, so the logic lives here as pure
// functions of `(users, presenceStatusOf)` and is unit-tested directly.
//
// ── Ordering ────────────────────────────────────────────────────────
//
// A real chat right-sidebar leads with who you can talk to *now*, so
// humans are grouped by presence — active, then idle, then offline —
// and sorted alphabetically within each group. Bots and deactivated
// accounts are not "people you chat with": they are deprioritized into
// their own trailing groups (bots, then deactivated), each alphabetical.
// A deactivated bot counts as deactivated — deactivation is the
// stronger signal.
//
// Name comparison is locale-aware and case-insensitive so the order
// reads naturally across Latin and Cyrillic names alike.

import type { User } from "../../domain";
import type { PresenceStatus } from "../../lib/presence";

/** A user paired with the presence status used to order/badge them. */
export interface UserListEntry {
  user: User;
  status: PresenceStatus;
}

// Lower rank sorts first. Humans by presence, then bots, then
// deactivated accounts.
function groupRank(entry: UserListEntry): number {
  if (!entry.user.is_active) {
    return 4;
  }
  if (entry.user.is_bot) {
    return 3;
  }
  switch (entry.status) {
    case "active":
      return 0;
    case "idle":
      return 1;
    case "offline":
      return 2;
  }
}

function compareNames(a: User, b: User): number {
  return a.full_name.localeCompare(b.full_name, undefined, {
    sensitivity: "base",
  });
}

/**
 * Order users for display: grouped by presence (active → idle →
 * offline), then bots, then deactivated accounts; alphabetical within
 * each group. `presenceStatusOf` resolves a user id to its coarse
 * presence status — passed in so this stays a pure function.
 */
export function orderUsers(
  users: readonly User[],
  presenceStatusOf: (userId: number) => PresenceStatus,
): UserListEntry[] {
  return users
    .map((user) => ({ user, status: presenceStatusOf(user.user_id) }))
    .sort((a, b) => {
      const rankDiff = groupRank(a) - groupRank(b);
      return rankDiff !== 0 ? rankDiff : compareNames(a.user, b.user);
    });
}

/**
 * Filter ordered entries by a name query. An empty (or whitespace-only)
 * query matches everything; otherwise the match is a case-insensitive
 * substring of `full_name`. Order is preserved.
 */
export function filterUsers(
  entries: readonly UserListEntry[],
  query: string,
): UserListEntry[] {
  const normalized = query.trim().toLowerCase();
  if (normalized === "") {
    return [...entries];
  }
  return entries.filter((entry) =>
    entry.user.full_name.toLowerCase().includes(normalized),
  );
}
