// User accounts, custom profile data, presence, and status.

import type { ReactionType } from "./emoji";
import type { BotType, Role, UnixTimestamp, UserId } from "./primitives";

/**
 * One entry of a user's custom profile field data, keyed in
 * `User.profile_data` by the field's numeric ID.
 */
export interface ProfileFieldValue {
  /** The user's raw value for this custom profile field. */
  value: string;
  /**
   * `value` rendered to HTML. Present only for field types that
   * support Markdown; treat as untrusted message-grade HTML.
   */
  rendered_value?: string;
}

/** Map from custom-profile-field ID to the user's value for it. */
export type ProfileData = Record<number, ProfileFieldValue>;

/**
 * A Zulip user account — human or bot. This is the shape returned by
 * user-listing endpoints and carried in `realm_user` add events.
 */
export interface User {
  user_id: UserId;
  /**
   * The user's real email address, or `null` when the current user is
   * not permitted to see it. Always populated for bots.
   */
  delivery_email: string | null;
  /**
   * Zulip API email address. May be a non-routable placeholder when
   * the viewer lacks access to the real address.
   */
  email: string;
  /** Display name used everywhere in the UI. */
  full_name: string;
  /** ISO 8601 timestamp of when the account joined the organization. */
  date_joined: string;
  /** `false` once the account has been deactivated. */
  is_active: boolean;
  is_owner: boolean;
  is_admin: boolean;
  is_guest: boolean;
  is_bot: boolean;
  /** Bot kind, or `null` for human accounts. */
  bot_type: BotType | null;
  /** Owner of the bot, or `null` for humans and ownerless legacy bots. */
  bot_owner_id: UserId | null;
  role: Role;
  /** IANA time zone identifier of the user's configured profile zone. */
  timezone: string;
  /**
   * Avatar image URL, or `null` when the client opted into gravatar
   * fallback and the server is deferring to a computed gravatar URL.
   */
  avatar_url: string | null;
  /** Cache-busting version counter for the avatar image. */
  avatar_version: number;
  /** `true` for a not-yet-activated account imported from another app. */
  is_imported_stub: boolean;
  /** Present and `true` only for permanently deleted accounts. */
  is_deleted?: boolean;
  /** Custom profile fields; absent for bots. */
  profile_data?: ProfileData;
}

/**
 * A user's status line — an optional short text and/or emoji shown
 * next to their name. Every field is optional: a user may set just
 * text, just an emoji, or clear their status entirely.
 */
export interface UserStatus {
  /**
   * Legacy mirror of the user's `presence_enabled` setting
   * (`away === !presence_enabled`); retained for older clients.
   */
  away?: boolean;
  status_text?: string;
  emoji_name?: string;
  emoji_code?: string;
  /**
   * Emoji namespace. The wire form admits `""` as a "clear" signal —
   * both on `POST /users/me/status` requests and on the realtime
   * `user_status` event the server emits in response. The reducer
   * treats `""` (alongside `emoji_name === ""`) as a clear.
   */
  reaction_type?: ReactionType | "";
}

/**
 * Presence for a single user in the modern format: two timestamps the
 * client compares against the current time.
 * - `active_timestamp` — last confirmed active interaction; treat as
 *   fully present.
 * - `idle_timestamp` — last connected client of any kind; treat as
 *   potentially present when there is no recent `active_timestamp`.
 */
export interface Presence {
  active_timestamp?: UnixTimestamp;
  idle_timestamp?: UnixTimestamp;
}

/** Map from user ID to that user's modern-format presence. */
export type PresenceMap = Record<UserId, Presence>;
