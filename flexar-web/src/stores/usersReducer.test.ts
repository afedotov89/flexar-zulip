// Unit tests for the users reducers (`src/stores/usersReducer`).
//
// Covers hydration from `realm_users` and each `realm_user` event op
// (add / remove / update), including the edge cases the reducer must
// tolerate: events for unknown user ids, and `realm_users` entries
// that omit the `is_active` field.

import { describe, expect, it } from "vitest";
import type { RealmUserEvent } from "../domain";
import { makeInitialState, makeUser } from "./testFixtures";
import {
  applyRealmUserEvent,
  directoryFromInitialState,
} from "./usersReducer";

describe("directoryFromInitialState", () => {
  it("indexes realm_users by user_id", () => {
    const directory = directoryFromInitialState(
      makeInitialState({
        realm_users: [makeUser({ user_id: 1 }), makeUser({ user_id: 2 })],
      }),
    );
    expect(Object.keys(directory)).toEqual(["1", "2"]);
    expect(directory[1].user_id).toBe(1);
  });

  it("returns an empty directory when realm_users is absent", () => {
    expect(directoryFromInitialState(makeInitialState())).toEqual({});
  });

  it("fills in is_active for realm_users entries that omit it", () => {
    // The register response omits `is_active` from `realm_users`.
    const rawUser = makeUser({ user_id: 7 });
    delete (rawUser as Partial<typeof rawUser>).is_active;
    const directory = directoryFromInitialState(
      makeInitialState({ realm_users: [rawUser] }),
    );
    expect(directory[7].is_active).toBe(true);
  });

  it("merges cross_realm_bots into the directory (Welcome Bot et al.)", () => {
    const directory = directoryFromInitialState(
      makeInitialState({
        realm_users: [makeUser({ user_id: 1 })],
        cross_realm_bots: [
          makeUser({
            user_id: 100,
            full_name: "Welcome Bot",
            email: "welcome-bot@zulip.com",
            is_bot: true,
          }),
        ],
      }),
    );
    expect(directory[100]?.full_name).toBe("Welcome Bot");
    expect(directory[100]?.is_bot).toBe(true);
    expect(directory[100]?.is_active).toBe(true);
    // The realm user is still there.
    expect(directory[1]?.user_id).toBe(1);
  });

  it("does not let a cross_realm_bots entry overwrite a realm_users entry", () => {
    // Defensive — shouldn't happen in practice, but a collision must
    // not drop the realm-user's role/mention metadata.
    const directory = directoryFromInitialState(
      makeInitialState({
        realm_users: [makeUser({ user_id: 5, full_name: "Real User" })],
        cross_realm_bots: [
          makeUser({ user_id: 5, full_name: "Bot Imposter", is_bot: true }),
        ],
      }),
    );
    expect(directory[5]?.full_name).toBe("Real User");
    expect(directory[5]?.is_bot).toBe(false);
  });
});

describe("applyRealmUserEvent — add", () => {
  it("inserts the new user", () => {
    const event: RealmUserEvent = {
      id: 1,
      type: "realm_user",
      op: "add",
      person: makeUser({ user_id: 3, full_name: "New User" }),
    };
    const next = applyRealmUserEvent({}, event);
    expect(next[3].full_name).toBe("New User");
  });

  it("does not mutate the input directory", () => {
    const directory = {};
    applyRealmUserEvent(directory, {
      id: 1,
      type: "realm_user",
      op: "add",
      person: makeUser({ user_id: 3 }),
    });
    expect(directory).toEqual({});
  });
});

describe("applyRealmUserEvent — remove", () => {
  it("drops the user from the directory", () => {
    const directory = { 5: makeUser({ user_id: 5 }) };
    const next = applyRealmUserEvent(directory, {
      id: 1,
      type: "realm_user",
      op: "remove",
      person: { user_id: 5, full_name: "User 5" },
    });
    expect(5 in next).toBe(false);
  });

  it("is a no-op for an unknown user id", () => {
    const directory = { 5: makeUser({ user_id: 5 }) };
    const next = applyRealmUserEvent(directory, {
      id: 1,
      type: "realm_user",
      op: "remove",
      person: { user_id: 99, full_name: "Ghost" },
    });
    // Same reference back — nothing changed.
    expect(next).toBe(directory);
  });
});

describe("applyRealmUserEvent — update", () => {
  it("shallow-merges the changed fields onto the existing user", () => {
    const directory = {
      5: makeUser({ user_id: 5, full_name: "Old Name", role: 400 }),
    };
    const next = applyRealmUserEvent(directory, {
      id: 1,
      type: "realm_user",
      op: "update",
      person: { user_id: 5, full_name: "New Name" },
    });
    expect(next[5].full_name).toBe("New Name");
    // Untouched fields are preserved.
    expect(next[5].role).toBe(400);
  });

  it("is a no-op for an update to an unknown user id", () => {
    const directory = { 5: makeUser({ user_id: 5 }) };
    const next = applyRealmUserEvent(directory, {
      id: 1,
      type: "realm_user",
      op: "update",
      person: { user_id: 99, full_name: "Ghost" },
    });
    expect(next).toBe(directory);
  });

  it("does not mutate the input directory", () => {
    const original = makeUser({ user_id: 5, full_name: "Old Name" });
    const directory = { 5: original };
    applyRealmUserEvent(directory, {
      id: 1,
      type: "realm_user",
      op: "update",
      person: { user_id: 5, full_name: "New Name" },
    });
    expect(original.full_name).toBe("Old Name");
  });
});
