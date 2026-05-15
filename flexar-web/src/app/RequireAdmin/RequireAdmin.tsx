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
// "Settled" is judged by `useStoresLoading()` going false: that hook
// already gates the rest of the app on the realtime layer being
// "connected" (i.e. register has delivered the directory).

import { Navigate, Outlet } from "react-router-dom";
import { Spinner } from "../../components/Spinner";
import { useStoresLoading } from "../../lib/hooks/useRealtimeStatus";
import { useIsAdmin } from "../../lib/hooks/useIsAdmin";
import styles from "./RequireAdmin.module.css";

export function RequireAdmin(): React.JSX.Element {
  const isAdmin = useIsAdmin();
  const storesLoading = useStoresLoading();

  if (storesLoading) {
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

  return <Outlet />;
}
