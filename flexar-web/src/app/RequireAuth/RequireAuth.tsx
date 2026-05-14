// Flexar Hub Web — authenticated-route guard (Phase 1.1).
//
// Wraps the routes that require a signed-in session. It reads the auth
// store's `status` state machine and renders accordingly:
//
//   "unknown"          — `persist` has not finished rehydrating; we do
//                        not yet know if a session exists. Render a
//                        neutral loading screen. Crucially we do NOT
//                        redirect here: bouncing to /login during this
//                        window would flash the login form at a user
//                        who is in fact signed in.
//   "unauthenticated"  — no session; redirect to /login, remembering the
//                        location the user was trying to reach so the
//                        login screen can send them back.
//   "authenticated"    — render the protected subtree via <Outlet />.

import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Spinner } from "../../components/Spinner";
import { useAuthStore } from "../../stores/authStore";
import styles from "./RequireAuth.module.css";

export function RequireAuth(): React.JSX.Element {
  const status = useAuthStore((s) => s.status);
  const location = useLocation();

  if (status === "unknown") {
    return (
      <div className={styles.loading}>
        <Spinner size="lg" />
        <p className={styles.loadingLabel}>Loading your workspace…</p>
      </div>
    );
  }

  if (status === "unauthenticated") {
    // `state.from` lets LoginPage return the user to where they were
    // headed once they sign in. `replace` keeps the guarded URL out of
    // history so Back does not bounce between guard and login.
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
