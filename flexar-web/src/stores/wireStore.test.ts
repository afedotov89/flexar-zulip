// Unit tests for `wireStore` (`src/stores/wireStore`).
//
// `wireStore` encodes the Phase 1.3 store/realtime contract: subscribe
// to both the initial-state snapshot and the event stream *at module
// load*, hydrate on every (re-)register, and apply events on top. The
// suite drives it against a fake connection — no real realtime layer,
// fully offline.

import { describe, expect, it, vi } from "vitest";
import type { ServerEvent } from "../domain";
import type { InitialState } from "../realtime";
import { wireStore, type WireableConnection } from "./wireStore";

/**
 * A fake realtime connection: captures the listeners `wireStore`
 * registers and lets the test fire snapshots and events at them, the
 * way the real connection would.
 */
function makeFakeConnection(): WireableConnection & {
  emitInitialState: (state: InitialState) => void;
  emitEvent: (event: ServerEvent) => void;
  initialStateListenerCount: () => number;
  eventListenerCount: () => number;
} {
  const initialStateListeners = new Set<(state: InitialState) => void>();
  const eventListeners = new Set<(event: ServerEvent) => void>();
  return {
    onInitialState(listener) {
      initialStateListeners.add(listener);
      return () => initialStateListeners.delete(listener);
    },
    subscribe(listener) {
      eventListeners.add(listener);
      return () => eventListeners.delete(listener);
    },
    emitInitialState(state) {
      for (const listener of initialStateListeners) {
        listener(state);
      }
    },
    emitEvent(event) {
      for (const listener of eventListeners) {
        listener(event);
      }
    },
    initialStateListenerCount: () => initialStateListeners.size,
    eventListenerCount: () => eventListeners.size,
  };
}

/** A minimal register snapshot. */
function snapshot(extra: Record<string, unknown> = {}): InitialState {
  return {
    queueId: "q1",
    lastEventId: 0,
    zulipFeatureLevel: 0,
    zulipVersion: "test",
    ...extra,
  };
}

describe("wireStore", () => {
  it("subscribes to both channels immediately", () => {
    const connection = makeFakeConnection();
    wireStore(
      { hydrate: vi.fn(), applyEvent: vi.fn() },
      connection,
    );
    expect(connection.initialStateListenerCount()).toBe(1);
    expect(connection.eventListenerCount()).toBe(1);
  });

  it("calls hydrate on every initial-state broadcast (re-hydrate on re-register)", () => {
    const connection = makeFakeConnection();
    const hydrate = vi.fn();
    wireStore({ hydrate, applyEvent: vi.fn() }, connection);

    const first = snapshot({ realm_users: [{ user_id: 1 }] });
    const second = snapshot({ realm_users: [{ user_id: 2 }] });
    connection.emitInitialState(first);
    connection.emitInitialState(second);

    expect(hydrate).toHaveBeenCalledTimes(2);
    expect(hydrate).toHaveBeenNthCalledWith(1, first);
    expect(hydrate).toHaveBeenNthCalledWith(2, second);
  });

  it("calls applyEvent for each event in the stream", () => {
    const connection = makeFakeConnection();
    const applyEvent = vi.fn();
    wireStore({ hydrate: vi.fn(), applyEvent }, connection);

    const event = { id: 1, type: "heartbeat" } as ServerEvent;
    connection.emitEvent(event);

    expect(applyEvent).toHaveBeenCalledTimes(1);
    expect(applyEvent).toHaveBeenCalledWith(event);
  });

  it("teardown removes both subscriptions", () => {
    const connection = makeFakeConnection();
    const hydrate = vi.fn();
    const applyEvent = vi.fn();
    const teardown = wireStore({ hydrate, applyEvent }, connection);

    teardown();
    expect(connection.initialStateListenerCount()).toBe(0);
    expect(connection.eventListenerCount()).toBe(0);

    // Post-teardown broadcasts reach nobody.
    connection.emitInitialState(snapshot());
    connection.emitEvent({ id: 1, type: "heartbeat" } as ServerEvent);
    expect(hydrate).not.toHaveBeenCalled();
    expect(applyEvent).not.toHaveBeenCalled();
  });
});
