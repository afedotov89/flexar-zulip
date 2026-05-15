// Flexar Hub Web — chip tooltip / aria-label helper (Phase 3.2).
//
// Resolves a chip's reactor list to a human label like "Alice, Bob and
// 3 others reacted with :tada:". The hook reads the users directory
// directly so the label updates if a user's name changes (rare, but
// the wiring is one selector and there is no caching to stale-ify).
//
// "You" is used in place of the viewer's name when the viewer is among
// the reactors — matching Zulip's existing convention. Unknown users
// (id not in the directory; common for ephemeral cross-realm bots)
// fall back to `User <id>`.

import { useCallback } from "react";
import type { UserId } from "../../domain";
import { useUsersStore } from "../../stores/usersStore";
import type { ReactionChipModel } from "./groupReactions";

const MAX_NAMES_LISTED = 3;

/**
 * Returns a function that builds the tooltip / `aria-label` text for a
 * chip. The function is stable for a given `viewerId` + users-store
 * snapshot and so is safe to use as a memo dependency.
 */
export function useChipTooltipLabel(
  viewerId: UserId | undefined,
): (chip: ReactionChipModel) => string {
  const getUser = useUsersStore((state) => state.getUser);
  return useCallback(
    (chip) => {
      const names = chip.userIds.map((id) => nameOf(id, viewerId, getUser));
      return `${joinNames(names)} reacted with :${chip.emojiName}:`;
    },
    [getUser, viewerId],
  );
}

function nameOf(
  id: UserId,
  viewerId: UserId | undefined,
  getUser: (id: UserId) => { full_name: string } | undefined,
): string {
  if (id === viewerId) {
    return "You";
  }
  return getUser(id)?.full_name ?? `User ${id}`;
}

function joinNames(names: readonly string[]): string {
  if (names.length === 0) {
    return "Nobody";
  }
  if (names.length === 1) {
    return names[0];
  }
  if (names.length <= MAX_NAMES_LISTED) {
    return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  }
  const head = names.slice(0, MAX_NAMES_LISTED).join(", ");
  const rest = names.length - MAX_NAMES_LISTED;
  return `${head} and ${rest} ${rest === 1 ? "other" : "others"}`;
}
