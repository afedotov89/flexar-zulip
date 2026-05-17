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

// HMR handling (dev only). Without this, every Vite hot-reload of any
// module in this layer's import graph re-evaluates the singleton — a
// *new* `RealtimeConnection` is created while the previous one keeps
// long-polling its own `queue_id` in the background. After a handful
// of edits the tab is running half a dozen parallel `/events`
// long-polls (visible in DevTools' Network panel as multiple pending
// requests with different `queue_id`s). One of those orphans flapping
// into `"reconnecting"` is exactly the source of the stuck warning
// banner on a fully-working app.
//
// A clean partial HMR would require all subscribers (stores, hooks)
// to re-bind to the new singleton — the wiring is not set up for
// that, and `wireRealtimeToAuth()` is only called from `App`'s
// mount effect (which does *not* re-run on HMR). So we take the
// simplest correct path: `dispose` cancels the old connection (which
// `stop()` now also aborts the in-flight long-poll for), then we
// force a full page reload so the new singleton boots cleanly with
// all subscribers freshly attached. Dev-only cost — zero in
// production, because `import.meta.hot` is undefined and the whole
// block is dead-code-eliminated from the shipped bundle.
if (import.meta.hot !== undefined) {
  import.meta.hot.dispose(() => {
    realtimeConnection.stop();
  });
  import.meta.hot.accept(() => {
    window.location.reload();
  });
}

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
