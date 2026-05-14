// Unit tests for the realm reducer (`src/stores/realmReducer`).
//
// Realm is hydration-only: there is no event reducer, so the suite
// covers `realmFromInitialState` projecting the register snapshot's
// `realm_*` keys onto a `Realm`, and ignoring everything else.

import { describe, expect, it } from "vitest";
import type { InitialState } from "../realtime";
import { realmFromInitialState } from "./realmReducer";

/** Build a register snapshot with the given extra initial-state keys. */
function snapshot(extra: Record<string, unknown> = {}): InitialState {
  return {
    queueId: "q1",
    lastEventId: 0,
    zulipFeatureLevel: 0,
    zulipVersion: "test",
    ...extra,
  };
}

describe("realmFromInitialState", () => {
  it("projects the modelled realm_* keys off the snapshot", () => {
    const realm = realmFromInitialState(
      snapshot({
        realm_name: "Flexar",
        realm_url: "https://flexar.example",
        max_message_length: 10000,
        realm_allow_message_editing: true,
        realm_mandatory_topics: false,
      }),
    );
    expect(realm).toEqual({
      realm_name: "Flexar",
      realm_url: "https://flexar.example",
      max_message_length: 10000,
      realm_allow_message_editing: true,
      realm_mandatory_topics: false,
    });
  });

  it("returns an empty realm when no realm_* keys are present", () => {
    expect(realmFromInitialState(snapshot())).toEqual({});
  });

  it("ignores snapshot keys that are not modelled Realm fields", () => {
    const realm = realmFromInitialState(
      snapshot({
        realm_name: "Flexar",
        realm_users: [{ user_id: 1 }],
        unread_msgs: { count: 3 },
        some_unknown_key: "ignored",
      }),
    );
    expect(realm).toEqual({ realm_name: "Flexar" });
  });

  it("omits keys whose value is undefined rather than storing them", () => {
    const realm = realmFromInitialState(
      snapshot({ realm_name: "Flexar", realm_url: undefined }),
    );
    expect(realm).toEqual({ realm_name: "Flexar" });
    expect("realm_url" in realm).toBe(false);
  });
});
