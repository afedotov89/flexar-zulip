// Unit tests for the realm reducer (`src/stores/realmReducer`).
//
// Two things to cover:
//   - `realmFromInitialState` — projects the register snapshot's
//     `realm_*` (and a few unprefixed) keys onto a `Realm`, ignoring
//     everything else.
//   - `applyRealmEvent` — folds `realm` `update` / `update_dict` events
//     onto the current `Realm` (Phase 5.2 admin edits arriving live).

import { describe, expect, it } from "vitest";
import type { Realm, RealmEvent } from "../domain";
import type { InitialState } from "../realtime";
import { applyRealmEvent, realmFromInitialState } from "./realmReducer";

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

  it("projects the Phase 5.2 admin-settings keys", () => {
    const realm = realmFromInitialState(
      snapshot({
        realm_message_content_edit_limit_seconds: 300,
        realm_message_content_delete_limit_seconds: 0,
        realm_message_retention_days: -1,
        realm_invite_required: true,
        realm_waiting_period_threshold: 7,
      }),
    );
    expect(realm).toEqual({
      realm_message_content_edit_limit_seconds: 300,
      realm_message_content_delete_limit_seconds: 0,
      realm_message_retention_days: -1,
      realm_invite_required: true,
      realm_waiting_period_threshold: 7,
    });
  });
});

/** Build a `RealmEvent` with sensible default `id` for the suite. */
function realmUpdate(property: string, value: unknown): RealmEvent {
  return { id: 1, type: "realm", op: "update", property, value };
}

function realmUpdateDict(data: Record<string, unknown>): RealmEvent {
  return { id: 1, type: "realm", op: "update_dict", property: "default", data };
}

describe("applyRealmEvent — op: update", () => {
  it("sets a single property on the realm, prefixing with `realm_`", () => {
    const start: Realm = { realm_name: "Old" };
    const next = applyRealmEvent(start, realmUpdate("name", "Flexar"));
    expect(next).toEqual({ realm_name: "Flexar" });
    // Pure: original untouched.
    expect(start).toEqual({ realm_name: "Old" });
  });

  it("preserves other modelled keys when updating one", () => {
    const start: Realm = {
      realm_name: "Flexar",
      realm_allow_message_editing: false,
    };
    const next = applyRealmEvent(
      start,
      realmUpdate("allow_message_editing", true),
    );
    expect(next).toEqual({
      realm_name: "Flexar",
      realm_allow_message_editing: true,
    });
  });

  it("falls back to the bare property name for unprefixed snapshot keys", () => {
    const start: Realm = { max_message_length: 10000 };
    const next = applyRealmEvent(
      start,
      realmUpdate("max_message_length", 20000),
    );
    expect(next).toEqual({ max_message_length: 20000 });
  });

  it("ignores update events for properties the Realm shape doesn't model", () => {
    const start: Realm = { realm_name: "Flexar" };
    const next = applyRealmEvent(
      start,
      realmUpdate("some_unmodelled_property", "x"),
    );
    expect(next).toBe(start);
  });

  it("starts from an empty realm without throwing", () => {
    const next = applyRealmEvent({}, realmUpdate("description", "Hello."));
    expect(next).toEqual({ realm_description: "Hello." });
  });
});

describe("applyRealmEvent — op: update_dict", () => {
  it("merges several modelled properties atomically", () => {
    const start: Realm = { realm_name: "Old", realm_invite_required: false };
    const next = applyRealmEvent(
      start,
      realmUpdateDict({
        name: "Flexar",
        description: "Hello.",
        invite_required: true,
      }),
    );
    expect(next).toEqual({
      realm_name: "Flexar",
      realm_description: "Hello.",
      realm_invite_required: true,
    });
  });

  it("ignores unmodelled keys but keeps the modelled ones", () => {
    const start: Realm = {};
    const next = applyRealmEvent(
      start,
      realmUpdateDict({ name: "Flexar", unknown_thing: 42 }),
    );
    expect(next).toEqual({ realm_name: "Flexar" });
  });

  it("returns the same object reference when no key is modelled", () => {
    const start: Realm = { realm_name: "Flexar" };
    const next = applyRealmEvent(start, realmUpdateDict({ unknown: "x" }));
    expect(next).toBe(start);
  });
});
