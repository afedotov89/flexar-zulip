// Shared module-load wiring for the Phase 1.3 server-state stores.
//
// Every server-state store follows the same lifecycle contract with the
// realtime layer:
//
//   1. Hydrate from the register-time snapshot (`onInitialState`), and
//      re-hydrate on every re-register — including `BAD_EVENT_QUEUE_ID`
//      recovery, where the rebuilt queue comes with a fresh snapshot.
//   2. Apply the ordered `ServerEvent` stream on top (`subscribe`).
//
// Both subscriptions must be established at *module load*, before the
// connection's `start()` runs: Phase 1.2's realtime layer does no event
// buffering or replay, so a store that subscribes late silently misses
// everything that arrived first. `wireStore` is the one place that
// encodes "subscribe at load time" so each store does not re-implement
// (and risk diverging from) that contract.
//
// The wiring is a fire-and-forget side effect: stores call `wireStore`
// at the bottom of their module and never need the returned teardown in
// the app (the connection lives as long as the session). The teardown
// is returned purely so tests can wire a fake connection, exercise it,
// and tear down cleanly between cases.

import type { ServerEvent } from "../domain";
import { realtimeConnection } from "../realtime";
import type { InitialState, Unsubscribe } from "../realtime";

/** What a store hands `wireStore`: how to (re-)hydrate and how to reduce. */
export interface StoreWiring {
  /**
   * Replace the store's state from a register snapshot. Called once per
   * (re-)register, before any event from the new queue is applied.
   */
  hydrate: (state: InitialState) => void;
  /** Fold one realtime event into the store's state. */
  applyEvent: (event: ServerEvent) => void;
}

/**
 * The realtime surface `wireStore` depends on. The app passes the
 * shared `realtimeConnection`; tests pass a fake exposing the same two
 * methods, so the suite runs fully offline.
 */
export interface WireableConnection {
  onInitialState: (listener: (state: InitialState) => void) => Unsubscribe;
  subscribe: (listener: (event: ServerEvent) => void) => Unsubscribe;
}

/**
 * Bind a store's `hydrate` / `applyEvent` to a realtime connection.
 * Call once at module load. Returns a teardown that removes both
 * subscriptions (used by tests; unused in the app).
 *
 * `connection` defaults to the app-wide `realtimeConnection`; tests
 * inject a fake.
 */
export function wireStore(
  wiring: StoreWiring,
  connection: WireableConnection = realtimeConnection,
): Unsubscribe {
  const unsubscribeInitialState = connection.onInitialState(wiring.hydrate);
  const unsubscribeEvents = connection.subscribe(wiring.applyEvent);
  return () => {
    unsubscribeInitialState();
    unsubscribeEvents();
  };
}
