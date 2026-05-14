// Shared scalar aliases and small enums used across the domain layer.
//
// These mirror the Zulip REST + events API contract. They exist so the
// rest of `src/domain` can speak in intent-revealing names rather than
// bare `number` / `string`, and so a single edit propagates everywhere.

/** Server-assigned identifier of a user account (human or bot). */
export type UserId = number;

/** Server-assigned identifier of a channel (historically "stream"). */
export type StreamId = number;

/** Server-assigned identifier of an individual message. */
export type MessageId = number;

/**
 * Unix timestamp in whole seconds (UTC). The Zulip API uses second
 * precision for most timestamps; presence `server_timestamp` is the
 * notable exception and is typed separately where it occurs.
 */
export type UnixTimestamp = number;

/**
 * Organization-level role of a user. The numeric gaps are intentional
 * and match the server so future roles can be slotted between them.
 */
export const Role = {
  Owner: 100,
  Administrator: 200,
  Moderator: 300,
  Member: 400,
  Guest: 600,
} as const;
export type Role = (typeof Role)[keyof typeof Role];

/**
 * Kind of bot account. Only meaningful when the user's `is_bot` flag is
 * set; `null` for human accounts.
 */
export const BotType = {
  Generic: 1,
  IncomingWebhook: 2,
  OutgoingWebhook: 3,
  Embedded: 4,
} as const;
export type BotType = (typeof BotType)[keyof typeof BotType];

/**
 * A permission setting whose value is either a single user-group ID or
 * an explicit collection of member users and subgroups. Zulip calls
 * this a "group-setting value"; it appears on every `can_*_group`
 * channel permission field.
 */
export type GroupSettingValue =
  | number
  | {
      /** IDs of individual users directly granted the permission. */
      direct_members: UserId[];
      /** IDs of user groups whose members are granted the permission. */
      direct_subgroups: number[];
    };
