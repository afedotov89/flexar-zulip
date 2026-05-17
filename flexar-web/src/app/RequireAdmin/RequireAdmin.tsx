// Flexar Hub Web — admin-route guard (Phase 5.2/5.3/5.4).
//
// Wraps `/admin/*` routes. Sits INSIDE `RequireAuth` (so authentication
// is already settled by the time this runs) and adds the role check:
//
//   - users directory has the signed-in user AND `is_admin`/`is_owner`
//     → render the protected subtree via <Outlet />.
//   - directory hasn't hydrated yet (cold-start race between login and
//     the register-snapshot landing) → render a neutral spinner so we
//     don't bounce a real admin out of admin URLs.
//   - directory has settled and the user is not admin → redirect to `/`
//     with a `replace` so the admin URL doesn't sit in history.
//
// "Settled" is judged by the *user directory itself* being non-empty —
// previously we gated on `useStoresLoading()` (realtime status), but
// that hook returns true while realtime is `"connecting"` or
// `"reconnecting"`, which on a flaky WAN can hold the admin page on
// a spinner indefinitely even though the user directory was hydrated
// minutes ago from the persisted `usersStore`. The directory itself
// is the right gate: if we have a session user and the directory has
// an entry for them, we have everything we need to make the admin-vs-
// member call.

import { Navigate, Outlet } from "react-router-dom";
import { Spinner } from "../../components/Spinner";
import { AdminNav } from "../../features/adminNav";
import { useAuthStore } from "../../stores/authStore";
import { useUsersStore } from "../../stores/usersStore";
import { useIsAdmin } from "../../lib/hooks/useIsAdmin";
import styles from "./RequireAdmin.module.css";

export function RequireAdmin(): React.JSX.Element {
  const isAdmin = useIsAdmin();
  const sessionUserId = useAuthStore((s) => s.session?.userId);
  const directoryHasViewer = useUsersStore(
    (s) => sessionUserId !== undefined && sessionUserId in s.users,
  );
  // Show the loading spinner only while the directory genuinely
  // doesn't know about the viewer yet — once it does, we can verdict.
  const directoryReady = directoryHasViewer;

  if (!directoryReady) {
    // Directory still hydrating; verdict on admin-ness is premature.
    return (
      <div className={styles.loading}>
        <Spinner size="lg" />
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  // Admins see a sub-nav tab strip above every admin page so they can
  // jump between organization / users / invites without going through
  // the navbar's account dropdown each time. The strip is rendered
  // here (above <Outlet />) so it stays on screen across route
  // transitions within /admin/*.
  return (
    <>
      <AdminNav />
      <Outlet />
    </>
  );
}
