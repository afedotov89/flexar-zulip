// Flexar Hub Web — admin-route gate (Phase 5.2/5.3/5.4; relaxed in
// the bot/group/invite capability sweep).
//
// Wraps `/admin/*` routes. Sits INSIDE `RequireAuth` (so authentication
// is already settled by the time this runs) and asks the broader
// permission-aware question:
//
//   "Does the signed-in user hold any admin-adjacent capability?"
//
// not just the historical "is_admin" flag. Zulip lets regular members
// create their own bots, administer groups they were appointed to
// manage, and send invitations through per-setting group memberships —
// the previous strict admin-only gate was silently redirecting those
// users to `/` and hiding capabilities the server would have allowed.
//
// Outcomes:
//   - users directory has the signed-in user AND any admin capability
//     (`useAdminCapabilities().hasAnyAdminAccess`) → render the
//     protected subtree via <Outlet />.
//   - directory hasn't hydrated yet (cold-start race between login and
//     the register-snapshot landing) → render a neutral spinner so we
//     don't bounce a permitted user out of admin URLs.
//   - directory has settled and the user has no admin capability →
//     redirect to `/` with a `replace` so the admin URL doesn't sit in
//     history.
//
// "Settled" is judged by the *user directory itself* being non-empty —
// previously we gated on `useStoresLoading()` (realtime status), but
// that hook returns true while realtime is `"connecting"` or
// `"reconnecting"`, which on a flaky WAN can hold the admin page on
// a spinner indefinitely even though the user directory was hydrated
// minutes ago from the persisted `usersStore`. The directory itself
// is the right gate: if we have a session user and the directory has
// an entry for them, we have everything we need to make the
// capability call.

import { Navigate, Outlet } from "react-router-dom";
import { Spinner } from "../../components/Spinner";
import { AdminNav } from "../../features/adminNav";
import { useAuthStore } from "../../stores/authStore";
import { useUsersStore } from "../../stores/usersStore";
import { useAdminCapabilities } from "../../lib/hooks/useAdminCapabilities";
import styles from "./RequireAdmin.module.css";

/**
 * Admin route gate. Renamed from `RequireAdmin` to reflect the
 * broader capability check; the old name is still re-exported from
 * `./index.ts` so a future grep finds the deprecated alias.
 */
export function RequireAdminAccess(): React.JSX.Element {
  const caps = useAdminCapabilities();
  const sessionUserId = useAuthStore((s) => s.session?.userId);
  const directoryHasViewer = useUsersStore(
    (s) => sessionUserId !== undefined && sessionUserId in s.users,
  );
  // Show the loading spinner only while the directory genuinely
  // doesn't know about the viewer yet — once it does, we can verdict.
  const directoryReady = directoryHasViewer;

  if (!directoryReady) {
    return (
      <div className={styles.loading}>
        <Spinner size="lg" />
      </div>
    );
  }

  if (!caps.hasAnyAdminAccess) {
    return <Navigate to="/" replace />;
  }

  // Permitted users see a sub-nav tab strip above every admin page so
  // they can jump between organization / users / groups / invites
  // without going through the navbar's account dropdown each time. The
  // strip is rendered here (above <Outlet />) so it stays on screen
  // across route transitions within /admin/*. AdminNav filters its
  // tabs by the same capabilities, so a member with only bot-creation
  // rights sees just the Users tab.
  return (
    <>
      <AdminNav />
      <Outlet />
    </>
  );
}
