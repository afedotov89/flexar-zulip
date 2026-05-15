// Flexar Hub Web — reaction grouping (Phase 3.2).
//
// A `Message` carries `reactions: Reaction[]`, one entry per
// (user, emoji) pair. The chip row collapses identical-emoji entries
// into a single chip with a count and the list of reactor ids.
//
// Identity for grouping is `(reactionType, emojiCode)`. Two namespaces
// can theoretically share an `emoji_code` value (different `id` types in
// the wire format collide as strings), so the reaction_type is part of
// the key. Within a group, `emoji_name` may differ between users (a
// realm emoji can be renamed); we keep the *first reactor's* name for
// display purposes — the same convention Zulip's web client uses.
//
// Order: chips appear in the order the first reaction of each emoji
// arrived (stable, predictable, matches what the user has been seeing
// as new reactions land). The viewer's own active reactions get a
// `viewerReacted: true` flag so the chip can render with the accent
// treatment.
//
// Pure: no React, no store reads, no I/O.

import type { Reaction, ReactionType, UserId } from "../../domain";

/** A single chip the row will render. */
export interface ReactionChipModel {
  /** Compound key, stable within the message: `<type>:<code>`. */
  key: string;
  reactionType: ReactionType;
  emojiCode: string;
  emojiName: string;
  /** All users who reacted with this emoji, in arrival order. */
  userIds: readonly UserId[];
  /** Convenience: `userIds.length`. */
  count: number;
  /** Whether the viewer is one of the reactors. */
  viewerReacted: boolean;
}

/**
 * Group a message's `reactions` array into one chip per emoji,
 * preserving the order in which each emoji first appeared. `viewerId`
 * decides which chip is "the viewer's" — pass `undefined` for older
 * sessions where the user id is not available; `viewerReacted` is then
 * always `false`.
 */
export function groupReactions(
  reactions: readonly Reaction[],
  viewerId: UserId | undefined,
): ReactionChipModel[] {
  const order: string[] = [];
  const groups = new Map<
    string,
    {
      key: string;
      reactionType: ReactionType;
      emojiCode: string;
      emojiName: string;
      userIds: UserId[];
    }
  >();
  for (const reaction of reactions) {
    const key = `${reaction.reaction_type}:${reaction.emoji_code}`;
    const existing = groups.get(key);
    if (existing === undefined) {
      groups.set(key, {
        key,
        reactionType: reaction.reaction_type,
        emojiCode: reaction.emoji_code,
        emojiName: reaction.emoji_name,
        userIds: [reaction.user_id],
      });
      order.push(key);
    } else {
      existing.userIds.push(reaction.user_id);
    }
  }
  return order.map((key) => {
    // Each `key` came from `groups.set` immediately above, so the
    // lookup is guaranteed to hit; the non-null assertion just narrows
    // away `undefined` for the type checker.
    const group = groups.get(key);
    if (group === undefined) {
      throw new Error(`groupReactions: missing group for key ${key}`);
    }
    return {
      key: group.key,
      reactionType: group.reactionType,
      emojiCode: group.emojiCode,
      emojiName: group.emojiName,
      userIds: group.userIds,
      count: group.userIds.length,
      viewerReacted:
        viewerId !== undefined && group.userIds.includes(viewerId),
    };
  });
}
