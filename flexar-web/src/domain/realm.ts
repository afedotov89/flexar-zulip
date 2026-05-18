// Organization ("realm") metadata.
//
// Zulip's API does not expose a single "realm object"; instead the
// register-queue response carries a large set of `realm_*` properties.
// `Realm` collects the subset a chat client needs to render the app
// (identity, branding, and a few behavioural limits). Fields are
// optional because which `realm_*` properties a queue receives depends
// on the `fetch_event_types` requested at registration time.

import type { GroupSettingValue, UserId } from "./primitives";

/** A channel folder: a named grouping of channels in the sidebar. */
export interface ChannelFolder {
  id: number;
  name: string;
  /** Folder description in Markdown source form. */
  description: string;
  /** `description` rendered to HTML. */
  rendered_description: string;
  /** Whether the folder has been archived. */
  is_archived: boolean;
  /** Creator's user ID, or `null` when unknown. */
  creator_id: UserId | null;
  /** Unix timestamp (seconds) of when the folder was created. */
  date_created: number;
}

/**
 * Organization-level identity and configuration relevant to the
 * client UI.
 */
export interface Realm {
  /** Display name of the organization. */
  realm_name?: string;
  /** Base URL of the organization's Zulip server. */
  realm_url?: string;
  /** Short subdomain identifier of the organization. */
  realm_string_id?: string;
  /** Organization description in Markdown source form. */
  realm_description?: string;
  /** URL of the organization's icon image. */
  realm_icon_url?: string;
  /** URL of the organization's wide logo (light theme). */
  realm_logo_url?: string;
  /** URL of the organization's wide logo (dark theme). */
  realm_night_logo_url?: string;
  /** Maximum allowed message length, in characters. */
  max_message_length?: number;
  /** Maximum allowed topic length, in characters. */
  max_topic_length?: number;
  /** Maximum allowed channel name length, in characters. */
  max_stream_name_length?: number;
  /** Maximum allowed channel description length, in characters. */
  max_stream_description_length?: number;
  /** Whether the organization permits message editing. */
  realm_allow_message_editing?: boolean;
  /** Edit-time limit in seconds; `0` means unlimited. */
  realm_message_content_edit_limit_seconds?: number;
  /** Delete-time limit in seconds; `0` means unlimited. */
  realm_message_content_delete_limit_seconds?: number;
  /** Realm-wide message retention in days; `-1` means forever. */
  realm_message_retention_days?: number;
  /** Server enum naming who can see message edit history. */
  realm_message_edit_history_visibility_policy?: string;
  /** Whether invitations are required to join the organization. */
  realm_invite_required?: boolean;
  /** Days a new account waits before having full-member permissions. */
  realm_waiting_period_threshold?: number;
  /** Whether the organization is configured to require message topics. */
  realm_mandatory_topics?: boolean;
  /**
   * Whether plain image URLs (`.jpg` / `.png` / `.gif` / `.webp`) are
   * unfurled into inline thumbnails under the message that contains
   * them. Self-hosted Zulip ships this on by default; turning it off
   * here suppresses every `.message_inline_image` card.
   */
  realm_inline_image_preview?: boolean;
  /**
   * Whether arbitrary links are unfurled into Open Graph preview cards
   * (title + description + thumbnail). Self-hosted Zulip ships this
   * off by default because rendering it requires the `embed_links`
   * queue worker plus outbound network access.
   */
  realm_inline_url_embed_preview?: boolean;
  /**
   * Display name substituted for the empty-string topic when the
   * client has not opted into the `empty_topic_name` capability.
   */
  realm_empty_topic_display_name?: string;

  // Realm-level group-setting permissions. Each is a Zulip
  // group-setting value — either a user-group id or an explicit
  // collection of users and subgroups. The UI uses these to mirror
  // the server's permission gates: who may create bots, who may
  // create groups, who may invite users, who may administer every
  // group in the realm. Membership is resolved against
  // `useUserGroupsStore` by `useAdminCapabilities`.

  /** Who may create bot users of every supported type. */
  realm_can_create_bots_group?: GroupSettingValue;
  /** Who may create incoming-webhook bots only. */
  realm_can_create_write_only_bots_group?: GroupSettingValue;
  /** Who may create new user groups. */
  realm_can_create_groups?: GroupSettingValue;
  /** Who may administer any user group in the realm. */
  realm_can_manage_all_groups?: GroupSettingValue;
  /** Who may issue email invitations to new users. */
  realm_can_invite_users_group?: GroupSettingValue;
}

/**
 * Identity of the account the client authenticated as, as returned by
 * the register-queue response. Distinct from a full `User` object: it
 * is the "who am I" envelope rather than a directory entry.
 */
export interface OwnUser {
  user_id: UserId;
  email: string;
  delivery_email?: string;
  full_name: string;
  /** Avatar URL for the logged-in user. */
  avatar_url?: string | null;
  /** Whether the account is an organization administrator. */
  is_admin?: boolean;
  /** Whether the account is an organization owner. */
  is_owner?: boolean;
  /** Whether the account is a guest. */
  is_guest?: boolean;
}
