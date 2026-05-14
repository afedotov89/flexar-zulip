// Subscribe a component to the realtime connection status (Phase 1.5).
//
// The sidebar needs a "stores not hydrated yet" signal so it can show
// skeletons instead of a misleading empty state. The server-state
// stores hydrate from the register snapshot, which the realtime layer
// only delivers once it has a live queue — i.e. once its status leaves
// `"idle"` / `"connecting"`. So the connection status is the available,
// honest hydration signal.
//
// This reads the realtime layer's *public status surface*
// (`getStatus` / `onStatusChange`, documented in COMPONENT_REGISTRY) —
// it does not subscribe to the event stream itself, which remains the
// stores' job. The hook is a thin `useSyncExternalStore` binding.

import { useSyncExternalStore } from "react";
import { realtimeConnection, type ConnectionStatus } from "../../realtime";

/** The current realtime connection status, re-rendered on every change. */
export function useRealtimeStatus(): ConnectionStatus {
  return useSyncExternalStore(
    (onChange) => realtimeConnection.onStatusChange(onChange),
    () => realtimeConnection.getStatus(),
  );
}

/**
 * Whether the server-state stores have not yet had a chance to hydrate:
 * the realtime layer has no live queue, so no register snapshot has
 * been delivered. The sidebar shows skeletons while this is `true`.
 */
export function useStoresLoading(): boolean {
  const status = useRealtimeStatus();
  return status === "idle" || status === "connecting";
}
