// Organization ("realm") metadata.
//
// Zulip's API does not expose a single "realm object"; instead the
// register-queue response carries a large set of `realm_*` properties.
// `Realm` collects the subset a chat client needs to render the app
// (identity, branding, and a few behavioural limits). Fields are
// optional because which `realm_*` properties a queue receives depends
// on the `fetch_event_types` requested at registration time.

import type { UserId } from "./primitives";

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
  /** Whether the organization is configured to require message topics. */
  realm_mandatory_topics?: boolean;
  /**
   * Display name substituted for the empty-string topic when the
   * client has not opted into the `empty_topic_name` capability.
   */
  realm_empty_topic_display_name?: string;
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
