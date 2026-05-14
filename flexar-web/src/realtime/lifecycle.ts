// Wires the realtime connection to the authentication lifecycle.
//
// The event queue must only run while the API client is credentialed:
// `registerQueue` / `getEvents` are authenticated calls. So the
// connection's `start()` / `stop()` is driven off `authStore.status`
// rather than from a UI component — keeping the wiring out of the
// render tree and in lock-step with the session, the same discipline
// `authStore` itself follows for credential side effects.
//
// `realtimeConnection` is the one app-wide connection instance — the
// analogue of the `apiClient` singleton. Phase 1.3 stores import it and
// `subscribe()` to the event stream.

import { useAuthStore } from "../stores/authStore";
import { RealtimeConnection } from "./connection";

/**
 * The one shared, app-wide realtime connection. Created idle; the auth
 * wiring (see {@link wireRealtimeToAuth}) starts and stops it. Phase
 * 1.3 stores subscribe to this instance.
 */
export const realtimeConnection = new RealtimeConnection();

/**
 * Bind {@link realtimeConnection} to the auth store: start the queue
 * once `status` is `"authenticated"`, stop it on any other status
 * (logout, or the `"unknown"` startup state). The connection's own
 * `start()` / `stop()` are idempotent, so reacting to every status
 * change — including no-op transitions — is safe.
 *
 * Returns the store's unsubscribe function. Called once from `App` on
 * mount; the connection also gets its initial kick here in case the
 * store is already `"authenticated"` (a rehydrated session) by the
 * time this runs.
 */
export function wireRealtimeToAuth(): () => void {
  const sync = (status: string): void => {
    if (status === "authenticated") {
      realtimeConnection.start();
    } else {
      realtimeConnection.stop();
    }
  };

  // Kick off from the current status: a persisted session may already
  // have resolved the store to `"authenticated"` before this runs.
  sync(useAuthStore.getState().status);

  return useAuthStore.subscribe((state) => {
    sync(state.status);
  });
}
