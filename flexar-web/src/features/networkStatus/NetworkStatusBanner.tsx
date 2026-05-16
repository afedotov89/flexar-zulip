// Network-status banner (Phase 6.8).
//
// A thin strip at the top of the app that surfaces three states the
// silent UI used to hide entirely from the user:
//
//   1. Browser is offline (`navigator.onLine === false`) — danger.
//   2. Realtime is `"reconnecting"` for noticeably long — warning.
//      `"reconnecting"` flickers on every transient blip, so we wait
//      for it to stick before showing UI to avoid distracting flashes.
//   3. The connection just came back from a real outage — success,
//      auto-dismissed after a few seconds.
//
// During normal `connected` operation the component renders nothing.
// Logout drops the realtime to `"idle"` which is also nothing-to-show.
//
// ── Design ─────────────────────────────────────────────────────────
//
// The visible banner is a *pure derivation* over two raw inputs
// (`isOnline`, `realtimeStatus`) and one piece of small state
// (`degradedRef`: whether we ever showed a degraded banner since the
// last healthy reset). The state machine reads top-to-bottom — no
// race between effects, no "wrong banner stuck on screen" if the two
// inputs settle in an unexpected order. The only time-based pieces
// are the reconnecting-grace timer and the success-auto-dismiss
// timer, both kept in tiny effects whose only job is to flip a
// boolean.
//
// We don't use a toast queue. Toasts disappear on their own and would
// let an outage scroll out of view; a persistent strip while degraded
// is the conventional pattern for messaging clients (Slack, Linear):
// visible the whole time the user might be sending into the void.

import { useEffect, useState } from "react";
import { Banner } from "../../components/Banner";
import type { ConnectionStatus } from "../../realtime";
import { useI18n } from "../../lib/i18n";
import { useRealtimeStatus } from "../../lib/hooks/useRealtimeStatus";
import { useNetworkOnline } from "../../lib/hooks/useNetworkOnline";
import styles from "./NetworkStatusBanner.module.css";

// How long the realtime layer must stay in `"reconnecting"` before we
// surface the banner. Short blips (a single failed long-poll that
// succeeds on the next try) shouldn't make UI flash.
const RECONNECTING_GRACE_MS = 2000;

// How long the "just reconnected" success banner stays before
// auto-dismissing. Long enough to notice, short enough to get out of
// the way.
const RECONNECTED_NOTICE_MS = 3000;

type Display = "none" | "offline" | "reconnecting" | "reconnected";

export function NetworkStatusBanner(): React.JSX.Element | null {
  const realtimeStatus = useRealtimeStatus();
  const isOnline = useNetworkOnline();
  const { m } = useI18n();
  const display = useDisplay(realtimeStatus, isOnline);

  if (display === "none") {
    return null;
  }

  return (
    <div className={styles.wrap}>
      {display === "offline" && <Banner tone="danger">{m.network.offline}</Banner>}
      {display === "reconnecting" && (
        <Banner tone="warning">{m.network.reconnecting}</Banner>
      )}
      {display === "reconnected" && (
        <Banner tone="success">{m.network.reconnected}</Banner>
      )}
    </div>
  );
}

function useDisplay(
  realtimeStatus: ConnectionStatus,
  isOnline: boolean,
): Display {
  // Has the realtime layer been in `"reconnecting"` long enough that
  // we should commit to showing the warning? Flips true after the
  // grace timer, back to false the moment realtime leaves reconnecting.
  const [reconnectingSticks, setReconnectingSticks] = useState(false);

  // Did we ever show a degraded banner since the last full recovery?
  // Used to gate the "just reconnected" success flash so it doesn't
  // fire on the initial healthy connect.
  const [degraded, setDegraded] = useState(false);

  // The success flash is a short-lived bit: when we transition from
  // degraded to healthy, set this true; auto-clear after a few seconds.
  const [showSuccess, setShowSuccess] = useState(false);

  // The "logical" degraded state — anything other than fully healthy.
  const isDegraded =
    !isOnline ||
    realtimeStatus === "reconnecting" ||
    realtimeStatus === "connecting";

  // Reconnecting-grace timer: start it on every entry to
  // `"reconnecting"`, cancel it whenever we leave. We don't gate it on
  // `isOnline` — the realtime status alone is the signal.
  useEffect(() => {
    if (realtimeStatus !== "reconnecting") {
      setReconnectingSticks(false);
      return undefined;
    }
    const timer = window.setTimeout(() => {
      setReconnectingSticks(true);
    }, RECONNECTING_GRACE_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [realtimeStatus]);

  // Track the "ever degraded" bit. Offline trips it immediately
  // (the user knows they're offline); reconnecting only after grace.
  useEffect(() => {
    if (!isOnline || reconnectingSticks) {
      setDegraded(true);
    }
  }, [isOnline, reconnectingSticks]);

  // Success flash. The first time we re-enter `healthy` after the
  // `degraded` bookkeeping was set, fire the flash and a timer that
  // clears both `showSuccess` and `degraded`. Subsequent healthy
  // re-renders (e.g. a registration that re-fires "connected") are
  // no-ops because `degraded` is now false.
  const healthy = isOnline && realtimeStatus === "connected";
  useEffect(() => {
    if (!healthy || !degraded) {
      return undefined;
    }
    setShowSuccess(true);
    const timer = window.setTimeout(() => {
      setShowSuccess(false);
      setDegraded(false);
    }, RECONNECTED_NOTICE_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [healthy, degraded]);

  // Logout / shutdown: drop everything. Realtime drops to `"idle"`
  // on `stop()`; nothing to show, and forget the degraded flag so a
  // re-login doesn't flash success.
  useEffect(() => {
    if (realtimeStatus === "idle") {
      setDegraded(false);
      setShowSuccess(false);
      setReconnectingSticks(false);
    }
  }, [realtimeStatus]);

  return derive(realtimeStatus, isOnline, {
    reconnectingSticks,
    showSuccess,
    isDegraded,
  });
}

interface DisplayInputs {
  reconnectingSticks: boolean;
  showSuccess: boolean;
  isDegraded: boolean;
}

function derive(
  realtimeStatus: ConnectionStatus,
  isOnline: boolean,
  { reconnectingSticks, showSuccess, isDegraded }: DisplayInputs,
): Display {
  // Logged-out / not started — never show anything.
  if (realtimeStatus === "idle") {
    return "none";
  }
  // Offline beats every realtime state — the user already knows.
  if (!isOnline) {
    return "offline";
  }
  // Realtime is trying to come back; show the warning once the grace
  // window has elapsed.
  if (realtimeStatus === "reconnecting" && reconnectingSticks) {
    return "reconnecting";
  }
  // The brief "back to healthy" notice after a real outage.
  if (showSuccess) {
    return "reconnected";
  }
  // Healthy + we were never degraded → silence.
  // Also: realtime is connecting / connected but the user is online
  // and we're not yet within the reconnecting-grace window → silence.
  void isDegraded; // intentionally consumed only by the effects above
  return "none";
}
