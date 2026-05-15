// Selector hook: is the signed-in user an organization admin?
//
// Resolves the current session's user-id (`authStore.session.userId`) to
// the entry in `usersStore.users` and returns `true` for owners and
// administrators alike — both have the admin-tier permissions the UI
// gates on (everything an admin can do, an owner can also do; the
// owner-only operations the API enforces server-side anyway).
//
// Returns `false` when the session has no user-id yet (cold start), the
// user isn't in the directory yet (initial-state hydration race), or
// the role is below admin. Components that gate UI on admin-ness should
// branch on this directly — never imply admin from `is_owner` alone.
//
// `RequireAdmin` (`src/app/RequireAdmin/`) wraps this for route-level
// gating; this hook is for finer-grained UI (the navbar dropdown's
// "Administration" entry, per-row admin actions, etc.).
//
// The hook is intentionally a pure read — no realtime subscription wiring
// of its own. Both source stores already publish on changes, so this
// re-runs whenever the session or the users directory updates.

import { useAuthStore } from "../../stores/authStore";
import { useUsersStore } from "../../stores/usersStore";

export function useIsAdmin(): boolean {
  const userId = useAuthStore((s) => s.session?.userId);
  const user = useUsersStore((s) =>
    userId !== undefined ? s.users[userId] : undefined,
  );
  return user?.is_admin === true || user?.is_owner === true;
}
