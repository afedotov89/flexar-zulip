// Pure hydration logic for the realm store (Phase 1.3).
//
// "Realm" is the organization-level metadata a chat client renders:
// name, branding URLs, behavioural limits. Zulip's `register` response
// carries this as a flat set of `realm_*` keys (plus a few unprefixed
// limits like `max_message_length`) whose presence depends on the
// `fetch_event_types` requested — the domain `Realm` type models them
// all as optional for exactly this reason.
//
// Unlike the other server-state areas, realm has no precisely-modelled
// realm-update event: the `realm`/`realm_user`-settings long tail is
// absorbed by `UnknownEvent` and not yet typed in `src/domain`. So this
// reducer is hydration-only — it projects the register snapshot's
// `realm_*` keys onto the `Realm` shape — and the store carries no
// event reducer. When realm-update events are modelled (through the
// orchestrator), an `applyRealmEvent` reducer would join this file.

import type { Realm } from "../domain";
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
  "realm_mandatory_topics",
  "realm_empty_topic_display_name",
] as const satisfies readonly (keyof Realm)[];

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
