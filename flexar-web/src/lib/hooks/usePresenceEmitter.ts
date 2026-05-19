// Periodically post the signed-in user's presence so other clients
// see "active" instead of the row decaying to "idle" / "offline".
//
// Cadence and status follow what Zulip web does:
//   - while the tab is visible: `POST /users/me/presence` every 60s
//     with `status: "active"`.
//   - when the tab loses focus / is hidden: one ping with
//     `status: "idle"` so peers see the transition immediately
//     instead of waiting for the next interval.
//   - when the tab becomes visible again: one immediate `active`
//     ping, then the regular interval resumes.
//
// Each ping's response carries the canonical realm-wide presences
// snapshot, which we fold into `usePresenceStore`. That refresh is the
// only way the signed-in user's own dot stays current — the server
// does not echo a user's own presence event back to that user's queue.
// It also keeps every other user's dot fresh in case a legacy-format
// `presence` event was dropped or arrived garbled.
//
// Mounted once in `AppShell`; unmounts on logout. Errors are
// swallowed — a missed presence ping is not a failure worth
// surfacing to the user, and the next interval re-tries.

import { useEffect } from "react";
import { apiClient } from "../../api";
import { useAuthStore } from "../../stores/authStore";
import { usePresenceStore } from "../../stores/presenceStore";

const PRESENCE_INTERVAL_MS = 60_000;

function ping(status: "active" | "idle"): void {
  void apiClient
    .sendOwnPresence({ status })
    .then((response) => {
      usePresenceStore.getState().mergePresences(response.presences);
    })
    .catch(() => {
      // Intentionally ignored — see header comment.
    });
}

export function usePresenceEmitter(): void {
  const isAuthenticated = useAuthStore(
    (s) => s.session !== null && s.session !== undefined,
  );

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    // First ping right away so the freshly-mounted session shows up
    // as "active" without waiting for the first interval tick.
    const initial = document.visibilityState === "visible" ? "active" : "idle";
    ping(initial);

    const interval = window.setInterval(() => {
      const status =
        document.visibilityState === "visible" ? "active" : "idle";
      ping(status);
    }, PRESENCE_INTERVAL_MS);

    const handleVisibility = (): void => {
      const status =
        document.visibilityState === "visible" ? "active" : "idle";
      ping(status);
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [isAuthenticated]);
}
