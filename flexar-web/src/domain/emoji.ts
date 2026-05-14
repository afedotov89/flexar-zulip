// Emoji and reaction shapes.
//
// Zulip has three independent emoji namespaces, each with its own way
// of encoding `emoji_code`. The same triple (`emoji_name`,
// `emoji_code`, `reaction_type`) identifies an emoji whether it is used
// as a message reaction, a status emoji, or a picker entry.

import type { UnixTimestamp, UserId } from "./primitives";

/**
 * Which emoji namespace an `emoji_code` belongs to:
 * - `unicode_emoji` — `emoji_code` is a dash-separated hex codepoint
 *   sequence from the Unicode spec.
 * - `realm_emoji` — `emoji_code` is the ID of a custom uploaded emoji.
 * - `zulip_extra_emoji` — `emoji_code` is the name of a Zulip-bundled
 *   special emoji (e.g. `zulip`).
 */
export type ReactionType = "unicode_emoji" | "realm_emoji" | "zulip_extra_emoji";

/** The minimal triple that uniquely identifies any emoji. */
export interface EmojiIdentity {
  emoji_name: string;
  /** Identifier of the emoji within the namespace of `reaction_type`. */
  emoji_code: string;
  reaction_type: ReactionType;
}

/** A single reaction attached to a message, as carried on `Message`. */
export interface Reaction extends EmojiIdentity {
  /** The user who added this reaction. */
  user_id: UserId;
}

/**
 * A custom emoji uploaded to the organization. The `id` is also the key
 * under which the server returns this object in the realm emoji map.
 */
export interface RealmEmoji {
  id: string;
  /** Name typed between colons to use the emoji (`:name:`). */
  name: string;
  /** Path, relative to the realm URL, of the emoji image. */
  source_url: string;
  /**
   * Path of a still frame for animated emoji, relative to the realm
   * URL. `null` when the emoji is not animated.
   */
  still_url: string | null;
  /** Whether the emoji has been removed from active use. */
  deactivated: boolean;
  /** Uploader's user ID, or `null` when unknown. */
  author_id: UserId | null;
}

/**
 * A draft message stored server-side. `id` is assigned by the server
 * and is absent on a draft that has not yet been persisted.
 */
export interface Draft {
  id?: number;
  /** `""` for an unaddressed draft, otherwise the recipient kind. */
  type: "" | "stream" | "private";
  /**
   * Tentative recipients: exactly one channel ID for `stream` drafts,
   * a list of user IDs for `private` drafts, empty for unaddressed.
   */
  to: number[];
  /** Tentative topic for channel drafts; ignored for other kinds. */
  topic: string;
  /** Draft body, in Zulip-flavored Markdown source form. */
  content: string;
  /** When the draft was last edited; filled in by the server. */
  timestamp?: UnixTimestamp;
}
