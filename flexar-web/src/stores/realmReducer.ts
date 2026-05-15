// Pure hydration logic for the realm store (Phase 1.3, extended in 5.2).
//
// "Realm" is the organization-level metadata a chat client renders:
// name, branding URLs, behavioural limits. Zulip's `register` response
// carries this as a flat set of `realm_*` keys (plus a few unprefixed
// limits like `max_message_length`) whose presence depends on the
// `fetch_event_types` requested — the domain `Realm` type models them
// all as optional for exactly this reason.
//
// Phase 5.2 added `applyRealmEvent` to fold realm-update events on top
// of the hydrated snapshot, so admin edits in the org-settings page
// (and from any other admin's session) appear live without waiting for
// a re-register.

import type { Realm, RealmEvent } from "../domain";
import type { InitialState } from "../realtime";

/**
 * The `Realm` keys we project out of the register snapshot. Listed
 * explicitly (rather than spreading the whole snapshot) so the store
 * holds only modelled `Realm` fields and nothing leaks in from the
 * snapshot's open index signature.
 */
const REALM_KEYS = [
  "realm_name",
  "realm_url",
  "realm_string_id",
  "realm_description",
  "realm_icon_url",
  "realm_logo_url",
  "realm_night_logo_url",
  "max_message_length",
  "max_topic_length",
  "max_stream_name_length",
  "max_stream_description_length",
  "realm_allow_message_editing",
  "realm_message_content_edit_limit_seconds",
  "realm_message_content_delete_limit_seconds",
  "realm_message_retention_days",
  "realm_message_edit_history_visibility_policy",
  "realm_invite_required",
  "realm_waiting_period_threshold",
  "realm_mandatory_topics",
  "realm_empty_topic_display_name",
] as const satisfies readonly (keyof Realm)[];

/**
 * Set of modelled `Realm` keys, used by `applyRealmEvent` to pick the
 * right storage key for an event's `property`. Derived from the same
 * `REALM_KEYS` list to keep the two in sync.
 */
const REALM_KEY_SET: ReadonlySet<string> = new Set(REALM_KEYS);

/**
 * Project the `realm_*` / limit keys of a register snapshot onto a
 * `Realm`. Keys the snapshot did not include (because their
 * `fetch_event_types` was not requested, or the server version predates
 * them) are simply left absent — every `Realm` field is optional.
 *
 * Re-hydration is a full replace: on a re-register the snapshot is the
 * fresh source of truth, so callers overwrite rather than merge.
 */
export function realmFromInitialState(state: InitialState): Realm {
  const realm: Realm = {};
  for (const key of REALM_KEYS) {
    const value = state[key];
    if (value !== undefined) {
      // The snapshot's index signature types every key as `unknown`;
      // the register API guarantees these keys match the `Realm`
      // field types when present.
      (realm as Record<string, unknown>)[key] = value;
    }
  }
  return realm;
}

/**
 * Pick the `Realm` storage key for an event's `property` name. The
 * server emits `realm` events with bare property names matching the
 * REST API (e.g. `name`, `description`, `allow_message_editing`); the
 * snapshot — and therefore our `Realm` shape — stores most of the same
 * fields with a `realm_` prefix. A few snapshot keys (the `max_*`
 * limits) are unprefixed in both places, hence the two-step lookup:
 * try the prefixed key first, then the bare name.
 *
 * Returns `undefined` for properties the `Realm` shape does not model;
 * callers ignore those rather than letting unmodelled keys leak into
 * the store.
 */
export function realmKeyForProperty(property: string): keyof Realm | undefined {
  const prefixed = `realm_${property}`;
  if (REALM_KEY_SET.has(prefixed)) {
    return prefixed as keyof Realm;
  }
  if (REALM_KEY_SET.has(property)) {
    return property as keyof Realm;
  }
  return undefined;
}

/**
 * Fold one `realm` event onto the current realm state. Pure and
 * immutable: returns the same object when the event touches no
 * modelled key, or a new object with the changed keys merged.
 *
 *   - `op: "update"` carries a single `property` + `value`.
 *   - `op: "update_dict"` carries a `data` map of several properties
 *     applied atomically.
 *
 * Properties the `Realm` shape does not model are silently ignored —
 * the server's realm-event surface is wider than what this client
 * renders, and a re-register catches anything we missed.
 */
export function applyRealmEvent(realm: Realm, event: RealmEvent): Realm {
  if (event.op === "update") {
    const key = realmKeyForProperty(event.property);
    if (key === undefined) {
      return realm;
    }
    return { ...realm, [key]: event.value };
  }
  // op === "update_dict": merge each modelled key from `data`.
  let next: Realm | null = null;
  for (const [property, value] of Object.entries(event.data)) {
    const key = realmKeyForProperty(property);
    if (key === undefined) {
      continue;
    }
    if (next === null) {
      next = { ...realm };
    }
    (next as Record<string, unknown>)[key] = value;
  }
  return next ?? realm;
}
