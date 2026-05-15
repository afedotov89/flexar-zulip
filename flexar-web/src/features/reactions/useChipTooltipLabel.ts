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
      return `${joinNames(names)} — реакция :${chip.emojiName}:`;
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
    return "Вы";
  }
  return getUser(id)?.full_name ?? `User ${id}`;
}

/**
 * Russian noun-pluralisation for "ещё N человек(а)". Russian has three
 * forms — singular, few, many — selected by the last digit(s) of the
 * count. The same rule covers any RU plural (the canonical example
 * lives here because the reactions UI is the only consumer for now).
 */
function pluralizeOthers(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) {
    return "ещё 1";
  }
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `ещё ${count}`;
  }
  return `ещё ${count}`;
}

function joinNames(names: readonly string[]): string {
  if (names.length === 0) {
    return "Никто";
  }
  if (names.length === 1) {
    return names[0];
  }
  if (names.length <= MAX_NAMES_LISTED) {
    return `${names.slice(0, -1).join(", ")} и ${names[names.length - 1]}`;
  }
  const head = names.slice(0, MAX_NAMES_LISTED).join(", ");
  const rest = names.length - MAX_NAMES_LISTED;
  return `${head} и ${pluralizeOthers(rest)}`;
}
