// Whether the browser believes it currently has a network connection.
//
// Thin `useSyncExternalStore` binding over `navigator.onLine` and the
// `online` / `offline` window events. The signal is the browser's best
// guess (it may say "online" while a captive portal is intercepting all
// traffic), so we pair it with the realtime layer's own connection
// status in the UI — `online === false` is reliable for "obviously
// offline"; the realtime status fills in the "trying again" picture.

import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

function getSnapshot(): boolean {
  if (typeof navigator === "undefined") {
    return true;
  }
  return navigator.onLine;
}

// Server snapshot for SSR — we don't SSR, but the hook is set up to
// satisfy `useSyncExternalStore`'s contract regardless.
function getServerSnapshot(): boolean {
  return true;
}

/** True when the browser says it has a network connection. */
export function useNetworkOnline(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
