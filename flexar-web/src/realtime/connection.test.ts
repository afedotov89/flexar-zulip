// Unit tests for the realtime connection manager.
//
// The connection is exercised against a hand-rolled fake `ApiClient`
// injected via `RealtimeConnectionOptions.client`, so the suite runs
// fully offline and never touches `fetch`. The fake hands out
// controllable promises for `registerQueue` / `getEvents` so each test
// drives the long-poll loop one step at a time.
//
// Backoff timing uses Vitest fake timers — no test waits real seconds.

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from "vitest";
import { ApiError } from "../api";
import type { ServerEvent } from "../domain";
import type {
  ApiClient,
  GetEventsResult,
  RegisterQueueResult,
} from "../api";
import { RealtimeConnection } from "./connection";

/** A deferred promise plus its resolve/reject handles. */
interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}

function defer<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/**
 * Minimal fake of the parts of `ApiClient` the connection uses.
 *
 * `registerQueue` / `getEvents` each pull from a shared pool of
 * deferreds so the loop and the test cooperate regardless of call
 * order: `nextRegister` / `nextGetEvents` return the same deferred the
 * loop's next call will receive — whether the test pre-stages it or the
 * loop reaches the call first. This means no orphaned, never-settled
 * promises (which Vitest would surface as unhandled rejections).
 */
class FakeApiClient {
  registerQueue: Mock;
  getEvents: Mock;
  /** Deferreds already handed to the loop but not yet claimed by a `next*`. */
  #pendingRegister: Array<Deferred<RegisterQueueResult>> = [];
  #pendingGetEvents: Array<Deferred<GetEventsResult>> = [];
  /** Deferreds staged by a `next*` call the loop has not yet consumed. */
  #stagedRegister: Array<Deferred<RegisterQueueResult>> = [];
  #stagedGetEvents: Array<Deferred<GetEventsResult>> = [];

  constructor() {
    this.registerQueue = vi.fn(() => {
      const staged = this.#stagedRegister.shift();
      if (staged !== undefined) {
        return staged.promise;
      }
      const fresh = defer<RegisterQueueResult>();
      this.#pendingRegister.push(fresh);
      return fresh.promise;
    });
    this.getEvents = vi.fn(() => {
      const staged = this.#stagedGetEvents.shift();
      if (staged !== undefined) {
        return staged.promise;
      }
      const fresh = defer<GetEventsResult>();
      this.#pendingGetEvents.push(fresh);
      return fresh.promise;
    });
  }

  /** The deferred for the loop's next (or current pending) `registerQueue`. */
  nextRegister(): Deferred<RegisterQueueResult> {
    const pending = this.#pendingRegister.shift();
    if (pending !== undefined) {
      return pending;
    }
    const d = defer<RegisterQueueResult>();
    this.#stagedRegister.push(d);
    return d;
  }

  /** The deferred for the loop's next (or current pending) `getEvents`. */
  nextGetEvents(): Deferred<GetEventsResult> {
    const pending = this.#pendingGetEvents.shift();
    if (pending !== undefined) {
      return pending;
    }
    const d = defer<GetEventsResult>();
    this.#stagedGetEvents.push(d);
    return d;
  }
}

/**
 * A successful `registerQueue` result with the given queue/cursor.
 * Extra initial-state keys (mirroring the register response's index
 * signature) can be supplied to exercise `onInitialState`.
 */
function registerResult(
  queueId: string | null,
  lastEventId: number,
  extra: Record<string, unknown> = {},
): RegisterQueueResult {
  return {
    queueId,
    lastEventId,
    zulipFeatureLevel: 0,
    zulipVersion: "test",
    ...extra,
  };
}

/** A non-heartbeat event (loosely typed; the loop only reads id/type). */
function someEvent(id: number): ServerEvent {
  return { id, type: "presence" } as ServerEvent;
}

/** A heartbeat event. */
function heartbeat(id: number): ServerEvent {
  return { id, type: "heartbeat" };
}

/** Build a connection with no jitter so backoff delays are exact. */
function makeConnection(client: FakeApiClient): RealtimeConnection {
  return new RealtimeConnection({
    // The fake stands in for the real ApiClient; the connection only
    // calls `registerQueue` / `getEvents` on it.
    client: client as unknown as ApiClient,
    backoff: { baseMs: 1_000, maxMs: 30_000, jitter: 0 },
    random: () => 0.5,
  });
}

/** Let all currently-resolved microtasks run. */
async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("RealtimeConnection — register and poll", () => {
  it("registers a queue, then dispatches polled events in order", async () => {
    const client = new FakeApiClient();
    const reg = client.nextRegister();
    const poll1 = client.nextGetEvents();
    const conn = makeConnection(client);

    const received: number[] = [];
    conn.subscribe((event) => received.push(event.id));

    conn.start();
    expect(conn.getStatus()).toBe("connecting");
    expect(client.registerQueue).toHaveBeenCalledTimes(1);

    reg.resolve(registerResult("q1", 5));
    await flush();

    // After register, the loop long-polls with the bootstrap cursor.
    expect(client.getEvents).toHaveBeenCalledWith("q1", 5);

    poll1.resolve({ events: [someEvent(6), someEvent(7)] });
    const poll2 = client.nextGetEvents();
    await flush();

    expect(received).toEqual([6, 7]);
    expect(conn.getStatus()).toBe("connected");
    // The cursor advanced to the highest id seen.
    expect(client.getEvents).toHaveBeenLastCalledWith("q1", 7);

    poll2.resolve({ events: [] });
    await flush();
    conn.stop();
  });

  it("advances last_event_id past heartbeats but does not dispatch them", async () => {
    const client = new FakeApiClient();
    const reg = client.nextRegister();
    const poll1 = client.nextGetEvents();
    const conn = makeConnection(client);

    const received: number[] = [];
    conn.subscribe((event) => received.push(event.id));

    conn.start();
    reg.resolve(registerResult("q1", 0));
    await flush();

    poll1.resolve({ events: [heartbeat(1), someEvent(2), heartbeat(3)] });
    client.nextGetEvents();
    await flush();

    // Only the non-heartbeat reached the subscriber...
    expect(received).toEqual([2]);
    // ...but the cursor advanced past the trailing heartbeat (id 3).
    expect(client.getEvents).toHaveBeenLastCalledWith("q1", 3);

    conn.stop();
  });

  it("starting twice does not register a second queue", async () => {
    const client = new FakeApiClient();
    client.nextRegister();
    const conn = makeConnection(client);

    conn.start();
    conn.start();
    await flush();

    expect(client.registerQueue).toHaveBeenCalledTimes(1);
    conn.stop();
  });
});

describe("RealtimeConnection — BAD_EVENT_QUEUE_ID recovery", () => {
  it("re-registers from scratch when the queue expires", async () => {
    const client = new FakeApiClient();
    const reg1 = client.nextRegister();
    const poll1 = client.nextGetEvents();
    const conn = makeConnection(client);

    const received: number[] = [];
    conn.subscribe((event) => received.push(event.id));

    conn.start();
    reg1.resolve(registerResult("q1", 10));
    await flush();

    // The queue was garbage-collected.
    const reg2 = client.nextRegister();
    poll1.reject(
      new ApiError("Bad event queue id", "BAD_EVENT_QUEUE_ID", 400),
    );
    await flush();

    // A fresh register (status "connecting"), not a backoff retry of
    // the dead queue.
    expect(conn.getStatus()).toBe("connecting");
    expect(client.registerQueue).toHaveBeenCalledTimes(2);

    const poll2 = client.nextGetEvents();
    reg2.resolve(registerResult("q2", 0));
    await flush();

    // Polls the *new* queue with its fresh cursor.
    expect(client.getEvents).toHaveBeenLastCalledWith("q2", 0);

    poll2.resolve({ events: [someEvent(1)] });
    client.nextGetEvents();
    await flush();
    expect(received).toEqual([1]);

    conn.stop();
  });

  it("does not back off on queue expiry — re-register is immediate", async () => {
    const client = new FakeApiClient();
    const reg1 = client.nextRegister();
    const poll1 = client.nextGetEvents();
    const conn = makeConnection(client);

    conn.start();
    reg1.resolve(registerResult("q1", 0));
    await flush();

    client.nextRegister();
    poll1.reject(
      new ApiError("Bad event queue id", "BAD_EVENT_QUEUE_ID", 400),
    );
    await flush();

    // Re-register happened without any timer needing to fire.
    expect(client.registerQueue).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);

    conn.stop();
  });
});

describe("RealtimeConnection — transport failure backoff", () => {
  it("backs off and retries the same queue on a network error", async () => {
    const client = new FakeApiClient();
    const reg = client.nextRegister();
    const poll1 = client.nextGetEvents();
    const conn = makeConnection(client);

    conn.start();
    reg.resolve(registerResult("q1", 3));
    await flush();

    // Transport failure: not a bad queue id.
    poll1.reject(new ApiError("Network request failed", "NETWORK_ERROR", 0));
    await flush();

    expect(conn.getStatus()).toBe("reconnecting");
    // No immediate retry — it is waiting out the backoff.
    expect(client.getEvents).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(1);

    // First failure → baseMs (1000), jitter disabled.
    const poll2 = client.nextGetEvents();
    await vi.advanceTimersByTimeAsync(1_000);
    await flush();

    // Retried the *same* queue with the *same* cursor.
    expect(client.getEvents).toHaveBeenCalledTimes(2);
    expect(client.getEvents).toHaveBeenLastCalledWith("q1", 3);
    expect(client.registerQueue).toHaveBeenCalledTimes(1);

    poll2.resolve({ events: [] });
    await flush();
    conn.stop();
  });

  it("grows the backoff delay on consecutive failures and resets on success", async () => {
    const client = new FakeApiClient();
    const reg = client.nextRegister();
    const conn = makeConnection(client);

    conn.start();
    reg.resolve(registerResult("q1", 0));
    await flush();

    // Fail twice in a row: delays should be 1000 then 2000.
    const poll1 = client.nextGetEvents();
    poll1.reject(new ApiError("net", "NETWORK_ERROR", 0));
    await flush();

    const poll2 = client.nextGetEvents();
    await vi.advanceTimersByTimeAsync(1_000);
    await flush();
    expect(client.getEvents).toHaveBeenCalledTimes(2);

    poll2.reject(new ApiError("net", "NETWORK_ERROR", 0));
    await flush();

    // Second consecutive failure: 1000ms is not yet enough.
    const poll3 = client.nextGetEvents();
    await vi.advanceTimersByTimeAsync(1_000);
    await flush();
    expect(client.getEvents).toHaveBeenCalledTimes(2);
    // ...but 2000ms total is.
    await vi.advanceTimersByTimeAsync(1_000);
    await flush();
    expect(client.getEvents).toHaveBeenCalledTimes(3);

    // A success resets the counter: the next failure waits only 1000ms.
    poll3.resolve({ events: [] });
    const poll4 = client.nextGetEvents();
    await flush();
    poll4.reject(new ApiError("net", "NETWORK_ERROR", 0));
    await flush();

    client.nextGetEvents();
    await vi.advanceTimersByTimeAsync(1_000);
    await flush();
    expect(client.getEvents).toHaveBeenCalledTimes(5);

    conn.stop();
  });

  it("backs off when registerQueue itself fails", async () => {
    const client = new FakeApiClient();
    const reg1 = client.nextRegister();
    const conn = makeConnection(client);

    conn.start();
    reg1.reject(new ApiError("net", "NETWORK_ERROR", 0));
    await flush();

    // No queue to keep — but it backs off rather than spinning.
    expect(client.registerQueue).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(1);

    const reg2 = client.nextRegister();
    await vi.advanceTimersByTimeAsync(1_000);
    await flush();
    expect(client.registerQueue).toHaveBeenCalledTimes(2);

    reg2.resolve(registerResult("q1", 0));
    client.nextGetEvents();
    await flush();
    conn.stop();
  });

  it("treats a null queue id from register as a transport failure", async () => {
    const client = new FakeApiClient();
    const reg1 = client.nextRegister();
    const conn = makeConnection(client);

    conn.start();
    reg1.resolve(registerResult(null, 0));
    await flush();

    // Did not proceed to poll; backed off to re-register instead.
    expect(client.getEvents).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(1);

    const reg2 = client.nextRegister();
    await vi.advanceTimersByTimeAsync(1_000);
    await flush();
    expect(client.registerQueue).toHaveBeenCalledTimes(2);

    reg2.resolve(registerResult("q1", 0));
    client.nextGetEvents();
    await flush();
    conn.stop();
  });
});

describe("RealtimeConnection — stop()", () => {
  it("dispatches nothing from a poll that resolves after stop()", async () => {
    const client = new FakeApiClient();
    const reg = client.nextRegister();
    const poll1 = client.nextGetEvents();
    const conn = makeConnection(client);

    const received: number[] = [];
    conn.subscribe((event) => received.push(event.id));

    conn.start();
    reg.resolve(registerResult("q1", 0));
    await flush();

    // Stop while the long-poll is in flight, then let it resolve late.
    conn.stop();
    expect(conn.getStatus()).toBe("idle");

    poll1.resolve({ events: [someEvent(1), someEvent(2)] });
    await flush();

    // The late events were dropped, and no further poll was scheduled.
    expect(received).toEqual([]);
    expect(client.getEvents).toHaveBeenCalledTimes(1);
  });

  it("cancels a pending backoff timer so nothing fires after stop()", async () => {
    const client = new FakeApiClient();
    const reg = client.nextRegister();
    const poll1 = client.nextGetEvents();
    const conn = makeConnection(client);

    conn.start();
    reg.resolve(registerResult("q1", 0));
    await flush();

    poll1.reject(new ApiError("net", "NETWORK_ERROR", 0));
    await flush();
    expect(vi.getTimerCount()).toBe(1);

    // Stopping must clear the backoff timer.
    conn.stop();
    expect(vi.getTimerCount()).toBe(0);

    // Advancing time triggers no retry.
    await vi.advanceTimersByTimeAsync(60_000);
    await flush();
    expect(client.getEvents).toHaveBeenCalledTimes(1);
    expect(client.registerQueue).toHaveBeenCalledTimes(1);
  });

  it("can be restarted after a stop()", async () => {
    const client = new FakeApiClient();
    const reg1 = client.nextRegister();
    const conn = makeConnection(client);

    conn.start();
    conn.stop();

    // A fresh start registers a new queue.
    const reg2 = client.nextRegister();
    conn.start();
    await flush();
    expect(conn.getStatus()).toBe("connecting");

    reg2.resolve(registerResult("q2", 0));
    client.nextGetEvents();
    await flush();
    expect(client.getEvents).toHaveBeenLastCalledWith("q2", 0);

    // The original register promise resolving late changes nothing.
    reg1.resolve(registerResult("q1", 99));
    await flush();
    expect(client.getEvents).toHaveBeenLastCalledWith("q2", 0);

    conn.stop();
  });

  it("stop() before start() is a harmless no-op", () => {
    const client = new FakeApiClient();
    const conn = makeConnection(client);
    expect(() => conn.stop()).not.toThrow();
    expect(conn.getStatus()).toBe("idle");
  });
});

describe("RealtimeConnection — subscriptions", () => {
  it("stops delivering to a listener after it unsubscribes", async () => {
    const client = new FakeApiClient();
    const reg = client.nextRegister();
    const poll1 = client.nextGetEvents();
    const conn = makeConnection(client);

    const received: number[] = [];
    const unsubscribe = conn.subscribe((event) => received.push(event.id));

    conn.start();
    reg.resolve(registerResult("q1", 0));
    await flush();

    poll1.resolve({ events: [someEvent(1)] });
    const poll2 = client.nextGetEvents();
    await flush();
    expect(received).toEqual([1]);

    unsubscribe();
    poll2.resolve({ events: [someEvent(2)] });
    client.nextGetEvents();
    await flush();

    // No id 2 — the listener was removed.
    expect(received).toEqual([1]);
    conn.stop();
  });

  it("notifies initial-state listeners with the register snapshot", async () => {
    const client = new FakeApiClient();
    const reg = client.nextRegister();
    const poll1 = client.nextGetEvents();
    const conn = makeConnection(client);

    const snapshots: RegisterQueueResult[] = [];
    conn.onInitialState((state) => snapshots.push(state));

    conn.start();
    // The register call fetches initial state for the queue's event
    // types and asks for the modern presence format.
    expect(client.registerQueue).toHaveBeenCalledWith(
      expect.objectContaining({
        fetchEventTypes: expect.arrayContaining(["message", "presence"]),
        slimPresence: true,
      }),
    );

    // Nothing broadcast until register resolves.
    expect(snapshots).toEqual([]);

    reg.resolve(registerResult("q1", 5, { realm_users: [{ user_id: 1 }] }));
    await flush();

    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]).toMatchObject({
      queueId: "q1",
      lastEventId: 5,
      realm_users: [{ user_id: 1 }],
    });

    poll1.resolve({ events: [] });
    await flush();
    conn.stop();
  });

  it("re-broadcasts a fresh snapshot on BAD_EVENT_QUEUE_ID re-register", async () => {
    const client = new FakeApiClient();
    const reg1 = client.nextRegister();
    const poll1 = client.nextGetEvents();
    const conn = makeConnection(client);

    const snapshots: RegisterQueueResult[] = [];
    conn.onInitialState((state) => snapshots.push(state));

    conn.start();
    reg1.resolve(registerResult("q1", 10, { realm_users: [{ user_id: 1 }] }));
    await flush();
    expect(snapshots).toHaveLength(1);

    // The queue expires; the connection re-registers from scratch and
    // must re-broadcast the new snapshot so stores re-hydrate.
    const reg2 = client.nextRegister();
    poll1.reject(
      new ApiError("Bad event queue id", "BAD_EVENT_QUEUE_ID", 400),
    );
    await flush();

    reg2.resolve(registerResult("q2", 0, { realm_users: [{ user_id: 2 }] }));
    client.nextGetEvents();
    await flush();

    expect(snapshots).toHaveLength(2);
    expect(snapshots[1]).toMatchObject({
      queueId: "q2",
      realm_users: [{ user_id: 2 }],
    });

    conn.stop();
  });

  it("does not broadcast initial state when register fails", async () => {
    const client = new FakeApiClient();
    const reg1 = client.nextRegister();
    const conn = makeConnection(client);

    const snapshots: RegisterQueueResult[] = [];
    conn.onInitialState((state) => snapshots.push(state));

    conn.start();
    reg1.reject(new ApiError("net", "NETWORK_ERROR", 0));
    await flush();

    // A failed register has no snapshot to broadcast.
    expect(snapshots).toEqual([]);

    conn.stop();
  });

  it("stops delivering to an initial-state listener after it unsubscribes", async () => {
    const client = new FakeApiClient();
    const reg1 = client.nextRegister();
    const poll1 = client.nextGetEvents();
    const conn = makeConnection(client);

    const snapshots: RegisterQueueResult[] = [];
    const unsubscribe = conn.onInitialState((state) => snapshots.push(state));

    conn.start();
    reg1.resolve(registerResult("q1", 0));
    await flush();
    expect(snapshots).toHaveLength(1);

    unsubscribe();

    // Force a re-register; the unsubscribed listener must not be called.
    const reg2 = client.nextRegister();
    poll1.reject(
      new ApiError("Bad event queue id", "BAD_EVENT_QUEUE_ID", 400),
    );
    await flush();
    reg2.resolve(registerResult("q2", 0));
    client.nextGetEvents();
    await flush();

    expect(snapshots).toHaveLength(1);
    conn.stop();
  });

  it("notifies status listeners on transitions", async () => {
    const client = new FakeApiClient();
    const reg = client.nextRegister();
    const poll1 = client.nextGetEvents();
    const conn = makeConnection(client);

    const statuses: string[] = [];
    conn.onStatusChange((status) => statuses.push(status));

    conn.start();
    expect(statuses).toEqual(["connecting"]);

    reg.resolve(registerResult("q1", 0));
    poll1.resolve({ events: [] });
    await flush();
    expect(statuses).toEqual(["connecting", "connected"]);

    conn.stop();
    expect(statuses).toEqual(["connecting", "connected", "idle"]);
  });
});
