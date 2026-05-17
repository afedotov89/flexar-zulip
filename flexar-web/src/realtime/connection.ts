// The realtime connection manager.
//
// `RealtimeConnection` owns a live Zulip event queue: it registers the
// queue, long-polls `GET /events` in a loop, and fans the events out to
// subscribers in order. It is the *pipe* — Phase 1.2. The *stores* that
// reduce these events into server state are Phase 1.3 and plug in via
// `subscribe()` (the event stream) and `onInitialState()` (the
// register-time state snapshot).
//
// Zulip's `register` call is atomic: a single request both allocates
// the queue *and* returns a consistent snapshot of the server state for
// the requested `fetch_event_types`. Phase 1.3 stores hydrate from that
// snapshot and then apply the event stream on top — no REST/event
// races. Crucially the snapshot is re-broadcast on every (re-)register,
// including recovery from `BAD_EVENT_QUEUE_ID`: a rebuilt queue comes
// with a fresh snapshot, and stores must re-hydrate because state may
// have changed during the gap.
//
// Responsibilities:
//   - Register: `apiClient.registerQueue(...)` for a chat client's
//     event types, also fetching initial state for them; capture
//     `queueId` + `lastEventId` and broadcast the snapshot.
//   - Long-poll loop: `apiClient.getEvents(...)`, advance
//     `lastEventId` to the highest id seen (heartbeats included), drop
//     heartbeats from downstream delivery, dispatch the rest, repeat
//     immediately (the call blocks server-side).
//   - Reconnect: transport failures (`NETWORK_ERROR` / `HTTP_ERROR` /
//     5xx) retry with exponential backoff + jitter; success resets it.
//   - Queue expiry: `BAD_EVENT_QUEUE_ID` means the queue is gone —
//     re-register from scratch and resume, distinctly from a transient
//     network error.
//   - Lifecycle: `start()` / `stop()`; `stop()` aborts the loop with no
//     dangling work; `start()` twice is a safe no-op.
//
// The loop is structured around a numeric generation token (`#runId`).
// `start()` bumps it and launches the loop bound to that value; every
// `await` boundary re-checks `isCurrent(runId)` and bails if `stop()`
// (or a later `start()`) has moved on — so no promise resolving late
// can dispatch events or schedule a retry after the connection stopped.

import {
  apiClient,
  isApiError,
  type ApiClient,
  type RegisterQueueResult,
} from "../api";
import type { ServerEvent } from "../domain";
import {
  backoffDelay,
  DEFAULT_BACKOFF,
  type BackoffOptions,
} from "./backoff";
import { dropHeartbeats, maxEventId } from "./events";

/**
 * Coarse connection state for an optional UI indicator.
 * - `"idle"` — not started, or stopped.
 * - `"connecting"` — first `registerQueue` in flight, no queue yet.
 * - `"connected"` — a queue is live and the poll loop is running.
 * - `"reconnecting"` — recovering from a transport failure or an
 *   expired queue (backing off and/or re-registering).
 */
export type ConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting";

/** A consumer of the ordered event stream. */
export type EventListener = (event: ServerEvent) => void;

/**
 * The register-time state snapshot: the full `register` response,
 * including the queue bootstrap fields and whatever initial-state /
 * `realm_*` keys the requested `fetch_event_types` produced. Phase 1.3
 * stores read the keys they own (`realm_users`, `subscriptions`,
 * `presences`, `unread_msgs`, …) off the index signature.
 */
export type InitialState = RegisterQueueResult;

/**
 * A consumer of the register-time state snapshot. Called once per
 * successful (re-)register — at startup and again after a
 * `BAD_EVENT_QUEUE_ID` recovery — *before* any events from the new
 * queue are dispatched. The contract is "hydrate (or re-hydrate) from
 * the snapshot, then apply the event stream on top".
 */
export type InitialStateListener = (state: InitialState) => void;

/** Notified whenever {@link RealtimeConnection.getStatus} would change. */
export type StatusListener = (status: ConnectionStatus) => void;

/** Removes a previously registered listener. Idempotent. */
export type Unsubscribe = () => void;

/**
 * Event types the queue subscribes to: the set a chat client acts on.
 *
 * This mirrors the precisely-modelled members of the domain
 * `ServerEvent` union — the long tail (`user_group`, `linkifiers`, …)
 * is deliberately omitted to keep register/`/events` bandwidth down, as
 * the Zulip API docs recommend for production clients. `heartbeat` is
 * always delivered by the server regardless of this list; it is named
 * here only for documentation. `realm` + `default_streams` (Phase 5.2
 * admin settings) keep the realm-store and default-streams list fresh
 * when an admin edits org settings.
 */
export const DEFAULT_EVENT_TYPES: readonly string[] = [
  "message",
  "update_message",
  "delete_message",
  "reaction",
  "subscription",
  "stream",
  "realm",
  "realm_user",
  "realm_emoji",
  "default_streams",
  "presence",
  "typing",
  "update_message_flags",
  "user_status",
  "user_topic",
  "user_settings",
  "scheduled_messages",
  "submessage",
  "heartbeat",
];

/** Construction-time configuration for {@link RealtimeConnection}. */
export interface RealtimeConnectionOptions {
  /** API client to use. Defaults to the shared app singleton. */
  client?: ApiClient;
  /** Event types to register the queue for. Defaults to {@link DEFAULT_EVENT_TYPES}. */
  eventTypes?: readonly string[];
  /** Reconnect backoff schedule. Defaults to {@link DEFAULT_BACKOFF}. */
  backoff?: BackoffOptions;
  /**
   * Random source for backoff jitter, in `[0, 1)`. Injectable for
   * deterministic tests; defaults to `Math.random`.
   */
  random?: () => number;
}

/**
 * Live event-queue connection. Construct once, `start()` when
 * authenticated, `stop()` on logout. Subscribe with `subscribe()` to
 * receive the ordered event stream.
 */
export class RealtimeConnection {
  readonly #client: ApiClient;
  readonly #eventTypes: readonly string[];
  readonly #backoff: BackoffOptions;
  readonly #random: () => number;

  /** Event-stream subscribers, notified in insertion order per event. */
  readonly #eventListeners = new Set<EventListener>();
  /** Initial-state subscribers, notified on every (re-)register. */
  readonly #initialStateListeners = new Set<InitialStateListener>();
  /** Status subscribers, notified on every status transition. */
  readonly #statusListeners = new Set<StatusListener>();

  /**
   * Generation token. Bumped by `start()` and `stop()`; the running
   * loop is bound to the value it saw at launch and exits as soon as
   * `#runId` no longer matches. This is what makes `stop()` clean and
   * `start()`-while-running safe.
   */
  #runId = 0;
  /** Whether a loop is currently active (between `start()` and `stop()`). */
  #running = false;
  #status: ConnectionStatus = "idle";
  /**
   * Resolver of the in-flight backoff sleep, if the loop is currently
   * waiting to retry. `stop()` calls it to cut the wait short so the
   * loop exits promptly and no timer outlives the connection.
   */
  #wakeBackoff: (() => void) | null = null;
  /**
   * AbortController for the currently in-flight `getEvents` long-poll,
   * if one is open. `stop()` aborts it so the server-side hanging
   * request is actually cancelled — otherwise the server holds the
   * `queue_id` slot open until its own ~10-minute timeout, which
   * shows up as orphan pending `/events` requests in dev tools and
   * (in dev with frequent HMR) accumulates fast. Reset to `null`
   * before/after every poll.
   */
  #pollAbort: AbortController | null = null;

  constructor(options: RealtimeConnectionOptions = {}) {
    this.#client = options.client ?? apiClient;
    this.#eventTypes = options.eventTypes ?? DEFAULT_EVENT_TYPES;
    this.#backoff = options.backoff ?? DEFAULT_BACKOFF;
    this.#random = options.random ?? Math.random;
  }

  // --- Public lifecycle ---------------------------------------------

  /**
   * Begin registering a queue and long-polling for events. Safe to call
   * when already running — it is then a no-op (the existing loop keeps
   * going). The loop runs detached; failures are handled internally via
   * reconnect, so this returns synchronously.
   */
  start(): void {
    if (this.#running) {
      return;
    }
    this.#running = true;
    const runId = ++this.#runId;
    // Detached: the loop owns its own lifetime via the generation token.
    void this.#runLoop(runId);
  }

  /**
   * Stop the connection: abort the poll loop and reset to `"idle"`.
   * Any `getEvents` long-poll in flight is *actually* cancelled via
   * its AbortController, so the server releases the request and we
   * don't leak `queue_id` slots; the loop's generation check then
   * makes the rejected promise a no-op. `registerQueue` in flight is
   * not aborted (the request is short) and is dropped via the
   * generation check. Safe to call when already stopped.
   */
  stop(): void {
    if (!this.#running) {
      return;
    }
    this.#running = false;
    // Bump the generation so the in-flight loop iteration bails out.
    this.#runId++;
    // Cut short a pending backoff sleep so its timer does not outlive
    // the connection and the loop exits without waiting out the delay.
    if (this.#wakeBackoff !== null) {
      this.#wakeBackoff();
    }
    // Abort the hanging long-poll, if any — see `#pollAbort`.
    if (this.#pollAbort !== null) {
      this.#pollAbort.abort();
      this.#pollAbort = null;
    }
    this.#setStatus("idle");
  }

  // --- Subscriptions -------------------------------------------------

  /**
   * Subscribe to the ordered event stream. The listener is called once
   * per non-heartbeat event, in the order events arrive. Returns an
   * unsubscribe function; calling it more than once is harmless.
   */
  subscribe(listener: EventListener): Unsubscribe {
    this.#eventListeners.add(listener);
    return () => {
      this.#eventListeners.delete(listener);
    };
  }

  /**
   * Subscribe to the register-time state snapshot. The listener is
   * called once per successful (re-)register — at startup and again
   * after a `BAD_EVENT_QUEUE_ID` recovery — before any events from the
   * new queue are dispatched. Returns an unsubscribe function; calling
   * it more than once is harmless.
   *
   * The listener is not replayed with the most recent snapshot on
   * subscribe: like `subscribe()`, consumers are expected to register
   * at module load, before `start()` runs.
   */
  onInitialState(listener: InitialStateListener): Unsubscribe {
    this.#initialStateListeners.add(listener);
    return () => {
      this.#initialStateListeners.delete(listener);
    };
  }

  /**
   * Subscribe to connection-status changes. Returns an unsubscribe
   * function. The listener is not called with the current status on
   * subscribe — read {@link getStatus} for that.
   */
  onStatusChange(listener: StatusListener): Unsubscribe {
    this.#statusListeners.add(listener);
    return () => {
      this.#statusListeners.delete(listener);
    };
  }

  /** The current coarse connection status. */
  getStatus(): ConnectionStatus {
    return this.#status;
  }

  // --- Internals -----------------------------------------------------

  /** Whether `runId` is still the live generation (no `stop`/`start` since). */
  #isCurrent(runId: number): boolean {
    return this.#running && this.#runId === runId;
  }

  /** Update status and notify status listeners, if it actually changed. */
  #setStatus(status: ConnectionStatus): void {
    if (this.#status === status) {
      return;
    }
    this.#status = status;
    for (const listener of this.#statusListeners) {
      listener(status);
    }
  }

  /** Deliver one event to every subscriber, in subscription order. */
  #dispatch(event: ServerEvent): void {
    for (const listener of this.#eventListeners) {
      listener(event);
    }
  }

  /**
   * Deliver the register-time snapshot to every initial-state
   * subscriber, in subscription order. Called after each successful
   * (re-)register, before the loop polls the new queue — so stores
   * hydrate from the snapshot before any event is applied on top.
   */
  #broadcastInitialState(state: InitialState): void {
    for (const listener of this.#initialStateListeners) {
      listener(state);
    }
  }

  /**
   * The connection's whole lifetime: register a queue, then poll until
   * something goes wrong, recovering as appropriate. Bound to `runId`;
   * every `await` boundary is followed by an `#isCurrent` check so a
   * `stop()` during any pending request ends the loop cleanly.
   *
   * `failureCount` drives the backoff schedule: it counts *consecutive*
   * transport failures and resets to `0` after any successful poll.
   */
  async #runLoop(runId: number): Promise<void> {
    let queueId: string | null = null;
    let lastEventId = -1;
    let failureCount = 0;

    while (this.#isCurrent(runId)) {
      // (Re)register whenever we have no live queue: at startup, and
      // after the queue expires (`BAD_EVENT_QUEUE_ID`).
      if (queueId === null) {
        this.#setStatus(failureCount === 0 ? "connecting" : "reconnecting");
        try {
          // `fetchEventTypes` mirrors `eventTypes`, so the response
          // carries an initial-state snapshot for exactly the event
          // types the queue subscribes to. `slimPresence` asks for the
          // modern keyed-by-id presence format the domain types model.
          const result = await this.#client.registerQueue({
            eventTypes: [...this.#eventTypes],
            fetchEventTypes: [...this.#eventTypes],
            slimPresence: true,
            // Ask the server to deliver realtime `message` events with
            // rendered HTML in `message.content` (Phase 1.7 + 4.x
            // optimistic-echo fix). The register-queue endpoint defaults
            // this to `false`, which would mean every event delivered
            // raw Markdown — `MessageContent` would then render `code`
            // and `**bold**` as literal text. Explicit `true` aligns the
            // event stream with `getMessages` (which we also call with
            // applyMarkdown=true) and with the documented Zulip-web
            // client behaviour.
            applyMarkdown: true,
            // Have the snapshot include the full subscriber list for
            // every subscribed channel — the right sidebar's
            // "В этом канале" reads `Subscription.subscribers`. Without
            // this, the snapshot omits the array entirely and that pane
            // renders "Нет данных" until the user re-registers.
            // `peer_add` / `peer_remove` events keep the list current
            // after the initial snapshot (see `streamsReducer`).
            includeSubscribers: true,
          });
          if (!this.#isCurrent(runId)) {
            return;
          }
          if (result.queueId === null) {
            // No queue id means the server would not allocate a queue
            // (e.g. uncredentialed). Treat as a transport failure and
            // back off rather than spinning.
            throw new Error("register returned no queue id");
          }
          queueId = result.queueId;
          lastEventId = result.lastEventId;
          failureCount = 0;
          // Broadcast the snapshot before polling the new queue: stores
          // hydrate (or, on re-register, re-hydrate) from it, then the
          // event stream below applies on top. This runs on every
          // successful register, including `BAD_EVENT_QUEUE_ID`
          // recovery.
          this.#broadcastInitialState(result);
          // We have a live queue and snapshot — the connection is
          // *functionally* connected, even though the first long-poll
          // below may not return for a minute (Zulip's heartbeat
          // interval). Marking "connected" only after the first
          // getEvents return left UI in "connecting" for that full
          // interval, which the NetworkStatusBanner could then mis-
          // interpret as a real outage. The next iteration polls and
          // promotes status idempotently on success / demotes to
          // "reconnecting" on failure (see the catch below).
          this.#setStatus("connected");
        } catch {
          // `registerQueue` failed (transport error, or no queue id).
          // There is no queue to keep, so every failure here is
          // transient: back off and try registering again.
          if (!this.#isCurrent(runId)) {
            return;
          }
          failureCount++;
          await this.#waitBackoff(runId, failureCount);
          continue;
        }
      }

      // Long-poll for the next batch of events. Allocate a fresh
      // AbortController per poll so `stop()` can actually cancel the
      // hanging request — see `#pollAbort`.
      this.#pollAbort = new AbortController();
      try {
        const { events } = await this.#client.getEvents(
          queueId,
          lastEventId,
          { signal: this.#pollAbort.signal },
        );
        if (!this.#isCurrent(runId)) {
          return;
        }
        // Heartbeats still advance the id; only non-heartbeats dispatch.
        lastEventId = maxEventId(events, lastEventId);
        for (const event of dropHeartbeats(events)) {
          this.#dispatch(event);
        }
        failureCount = 0;
        this.#setStatus("connected");
      } catch (cause) {
        if (!this.#isCurrent(runId)) {
          return;
        }
        // ABORTED is our own `stop()` cancelling the request — exit
        // silently, the generation check above would normally catch
        // it anyway but being explicit avoids a phantom failure
        // bump.
        if (isApiError(cause) && cause.code === "ABORTED") {
          return;
        }
        if (isApiError(cause) && cause.code === "BAD_EVENT_QUEUE_ID") {
          // The queue was garbage-collected. Re-register from scratch:
          // drop the queue id, reset the cursor, and loop. This is a
          // recovery, not a transport failure — it does not back off,
          // and `failureCount` stays at 0, so the next iteration's
          // register reports `"connecting"`, not `"reconnecting"`.
          queueId = null;
          lastEventId = -1;
          continue;
        }
        // Any other failure (NETWORK_ERROR, HTTP_ERROR, 5xx, …) is
        // transient: back off and retry the same queue.
        failureCount++;
        this.#setStatus("reconnecting");
        await this.#waitBackoff(runId, failureCount);
      } finally {
        this.#pollAbort = null;
      }
    }
  }

  /**
   * Sleep for the backoff delay of `failureCount`, unless `stop()`
   * intervenes — `stop()` calls `#wakeBackoff` to clear the timer and
   * resolve early so the loop exits promptly with no timer left
   * pending. Resolves either way; the caller re-checks `#isCurrent` on
   * the next loop iteration.
   */
  #waitBackoff(runId: number, failureCount: number): Promise<void> {
    // If the generation has already moved on, don't even wait.
    if (!this.#isCurrent(runId)) {
      return Promise.resolve();
    }
    const delay = backoffDelay(failureCount, this.#backoff, this.#random);
    return new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        this.#wakeBackoff = null;
        resolve();
      }, delay);
      this.#wakeBackoff = () => {
        clearTimeout(timer);
        this.#wakeBackoff = null;
        resolve();
      };
    });
  }
}
