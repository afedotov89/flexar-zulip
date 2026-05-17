// Pure reducers for the users store (Phase 1.3).
//
// The users store holds the organization's user directory keyed by
// `user_id`. It is hydrated from the register snapshot's `realm_users`
// array and then folded forward by `realm_user` events:
//
//   - `op: "add"`    — a new user joined, or a guest gained access to
//                      one. `person` is a full `User`.
//   - `op: "remove"` — a user was deactivated, or a guest lost access.
//                      `person` carries only `user_id` + `full_name`.
//                      We drop the entry from the directory.
//   - `op: "update"` — a property of an existing user changed.
//                      `person` is a partial `User` with a required
//                      `user_id`; we shallow-merge it onto the entry.
//
// `UserDirectory` is a plain `Record` keyed by id — the natural shape
// for the read-path UI, which looks users up by id (message senders,
// subscriber lists, presence rows). Reducers are pure: they return a
// new record and never mutate the input, so the store's `setState`
// triggers re-renders correctly.
//
// Note on `realm_users` shape: the register response omits the
// `is_active` field from `realm_users` entries (the API guarantees
// every entry is an active account). The domain `User` type requires
// `is_active`, so `directoryFromInitialState` fills it in as `true`.
// This is flagged for the orchestrator — it is a genuine mismatch
// between the frozen `User` type and the register payload.

import type { RealmUserEvent, User, UserId } from "../domain";
import type { InitialState } from "../realtime";

/** The user directory: every known user, keyed by `user_id`. */
export type UserDirectory = Record<UserId, User>;

/**
 * Build the directory from a register snapshot's `realm_users` plus
 * `cross_realm_bots` arrays. Returns an empty directory when neither
 * key is present (the `fetch_event_types` did not request
 * `realm_user`).
 *
 * `realm_users` entries omit `is_active` — the API guarantees they are
 * all active accounts — so it is filled in as `true` to satisfy the
 * `User` shape.
 *
 * `cross_realm_bots` are system bots Zulip ships with (Welcome Bot,
 * Notification Bot, …). They are *not* in `realm_users` — that's the
 * audit's "they're invisible in the admin Bots tab" — but they post
 * messages and reply to direct messages, so the user directory and
 * the admin pages should know about them. Each is also marked
 * `is_active: true` and `is_bot: true`.
 */
export function directoryFromInitialState(state: InitialState): UserDirectory {
  const directory: UserDirectory = {};
  const rawUsers = state.realm_users;
  if (Array.isArray(rawUsers)) {
    for (const raw of rawUsers as Array<Partial<User> & { user_id: UserId }>) {
      directory[raw.user_id] = { is_active: true, ...raw } as User;
    }
  }
  const rawCrossRealmBots = state.cross_realm_bots;
  if (Array.isArray(rawCrossRealmBots)) {
    for (const raw of rawCrossRealmBots as Array<
      Partial<User> & { user_id: UserId }
    >) {
      // Don't overwrite a `realm_users` entry that already mentions
      // the bot (defensive — shouldn't happen in practice, but a
      // user-id collision would otherwise drop role info).
      if (raw.user_id in directory) {
        continue;
      }
      directory[raw.user_id] = {
        is_active: true,
        is_bot: true,
        ...raw,
      } as User;
    }
  }
  return directory;
}

/**
 * Fold one `realm_user` event into the directory. Returns a new
 * directory; the input is never mutated. Unknown ids on `update` /
 * `remove` are tolerated (no-op) — events can race ahead of a
 * directory that a narrower `fetch_event_types` left incomplete.
 */
export function applyRealmUserEvent(
  directory: UserDirectory,
  event: RealmUserEvent,
): UserDirectory {
  switch (event.op) {
    case "add": {
      // A full `User` for the joined / newly-visible account.
      return { ...directory, [event.person.user_id]: event.person };
    }
    case "remove": {
      const { user_id } = event.person;
      if (!(user_id in directory)) {
        return directory;
      }
      const next = { ...directory };
      delete next[user_id];
      return next;
    }
    case "update": {
      const existing = directory[event.person.user_id];
      if (existing === undefined) {
        // No entry to patch — the update raced ahead of an incomplete
        // directory. Dropping it is correct: a later `add` (or the
        // next register snapshot) carries the full record.
        return directory;
      }
      return {
        ...directory,
        [event.person.user_id]: { ...existing, ...event.person },
      };
    }
  }
}
