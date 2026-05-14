// Unit tests for the right sidebar's user ordering and filtering.
//
// `orderUsers` / `filterUsers` are pure: ordering takes a presence
// resolver so no clock is involved, and filtering is a plain string
// match. The fixtures below are minimal `User` objects — only the
// fields the logic reads (`user_id`, `full_name`, `is_active`,
// `is_bot`) are set meaningfully.

import { describe, expect, it } from "vitest";
import type { User } from "../../domain";
import type { PresenceStatus } from "../../lib/presence";
import { filterUsers, orderUsers } from "./userList";

/** A minimal valid-enough `User` for ordering/filtering tests. */
function makeUser(overrides: Partial<User> & { user_id: number }): User {
  return {
    delivery_email: null,
    email: `user${overrides.user_id}@example.com`,
    full_name: `User ${overrides.user_id}`,
    date_joined: "2024-01-01T00:00:00Z",
    is_active: true,
    is_owner: false,
    is_admin: false,
    is_guest: false,
    is_bot: false,
    bot_type: null,
    bot_owner_id: null,
    role: 400,
    timezone: "",
    avatar_url: null,
    avatar_version: 1,
    is_imported_stub: false,
    ...overrides,
  };
}

/** Build a presence resolver from an explicit id → status map. */
function statusMap(
  map: Record<number, PresenceStatus>,
): (userId: number) => PresenceStatus {
  return (userId) => map[userId] ?? "offline";
}

describe("orderUsers", () => {
  it("groups by presence: active, then idle, then offline", () => {
    const users = [
      makeUser({ user_id: 1, full_name: "Offline One" }),
      makeUser({ user_id: 2, full_name: "Active One" }),
      makeUser({ user_id: 3, full_name: "Idle One" }),
    ];
    const ordered = orderUsers(
      users,
      statusMap({ 1: "offline", 2: "active", 3: "idle" }),
    );
    expect(ordered.map((e) => e.user.user_id)).toEqual([2, 3, 1]);
  });

  it("sorts alphabetically within a presence group, case-insensitively", () => {
    const users = [
      makeUser({ user_id: 1, full_name: "zoe" }),
      makeUser({ user_id: 2, full_name: "Adam" }),
      makeUser({ user_id: 3, full_name: "bob" }),
    ];
    const ordered = orderUsers(
      users,
      statusMap({ 1: "active", 2: "active", 3: "active" }),
    );
    expect(ordered.map((e) => e.user.full_name)).toEqual([
      "Adam",
      "bob",
      "zoe",
    ]);
  });

  it("places bots after all humans, regardless of presence", () => {
    const users = [
      makeUser({ user_id: 1, full_name: "Active Bot", is_bot: true }),
      makeUser({ user_id: 2, full_name: "Offline Human" }),
    ];
    const ordered = orderUsers(
      users,
      statusMap({ 1: "active", 2: "offline" }),
    );
    expect(ordered.map((e) => e.user.user_id)).toEqual([2, 1]);
  });

  it("places deactivated accounts last, after bots", () => {
    const users = [
      makeUser({ user_id: 1, full_name: "Deactivated", is_active: false }),
      makeUser({ user_id: 2, full_name: "A Bot", is_bot: true }),
      makeUser({ user_id: 3, full_name: "Human" }),
    ];
    const ordered = orderUsers(
      users,
      statusMap({ 1: "active", 2: "active", 3: "offline" }),
    );
    expect(ordered.map((e) => e.user.user_id)).toEqual([3, 2, 1]);
  });

  it("counts a deactivated bot as deactivated", () => {
    const users = [
      makeUser({
        user_id: 1,
        full_name: "Dead Bot",
        is_bot: true,
        is_active: false,
      }),
      makeUser({ user_id: 2, full_name: "Live Bot", is_bot: true }),
    ];
    const ordered = orderUsers(
      users,
      statusMap({ 1: "active", 2: "offline" }),
    );
    // The live bot (group 3) sorts before the deactivated bot (group 4).
    expect(ordered.map((e) => e.user.user_id)).toEqual([2, 1]);
  });

  it("carries the resolved presence status on each entry", () => {
    const users = [makeUser({ user_id: 1 })];
    const ordered = orderUsers(users, statusMap({ 1: "idle" }));
    expect(ordered[0].status).toBe("idle");
  });
});

describe("filterUsers", () => {
  const entries = orderUsers(
    [
      makeUser({ user_id: 1, full_name: "Ada Lovelace" }),
      makeUser({ user_id: 2, full_name: "Grace Hopper" }),
      makeUser({ user_id: 3, full_name: "Alan Turing" }),
    ],
    () => "active",
  );

  it("returns every entry for an empty query", () => {
    expect(filterUsers(entries, "")).toHaveLength(3);
  });

  it("returns every entry for a whitespace-only query", () => {
    expect(filterUsers(entries, "   ")).toHaveLength(3);
  });

  it("matches a case-insensitive substring of the full name", () => {
    const matched = filterUsers(entries, "a");
    expect(matched.map((e) => e.user.full_name)).toEqual([
      "Ada Lovelace",
      "Alan Turing",
      "Grace Hopper",
    ]);
  });

  it("matches nothing when no name contains the query", () => {
    expect(filterUsers(entries, "zzz")).toEqual([]);
  });

  it("preserves the input order", () => {
    const matched = filterUsers(entries, "a");
    // Input is already ordered (Ada, Alan, Grace) — order is kept.
    expect(matched.map((e) => e.user.user_id)).toEqual([1, 3, 2]);
  });
});
