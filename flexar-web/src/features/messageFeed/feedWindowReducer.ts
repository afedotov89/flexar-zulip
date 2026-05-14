// Flexar Hub Web — feed window reducer (Phase 1.6).
//
// The feed renders the messages of *one narrow*. `messagesStore` holds
// every message keyed by id (all ingested history + every live event),
// but it is NOT narrow-ordered — it cannot answer "what are the
// messages of this narrow, in order". That ordered window is what this
// reducer owns:
//
//   - `orderedIds`  — the message ids of the current narrow's fetched
//                     window, ascending chronological order.
//   - `foundOldest` / `foundNewest` — whether the window reaches the
//                     oldest / newest matching message (pagination
//                     stop conditions, from the `getMessages` result).
//   - `historyLimited` — whether the server truncated history for plan
//                     reasons (a one-time notice the feed shows).
//   - `status` / `error` — the initial-fetch lifecycle.
//   - `loadingOlder` / `loadingNewer` — in-flight pagination fetches.
//
// Server-state (message bodies, flags, reactions) stays in
// `messagesStore`; this layer owns only ordering + pagination cursors.
// Every state transition is a pure function here, unit-tested in
// `./feedWindowReducer.test.ts`; the hook in `./useFeedWindow.ts` runs
// the effects (fetch, ingest) and threads results through these
// reducers.
//
// Ordering invariant: `orderedIds` is always sorted ascending and free
// of duplicates. Zulip message ids are monotonic with send time, so
// sorting by id is sorting chronologically — the reducer relies on this
// for merge and live-append.

import type { MessageId } from "../../domain";

/** Lifecycle of the initial history fetch for a narrow. */
export type FeedFetchStatus = "idle" | "loading" | "ready" | "error";

/** The feed's per-narrow window state. */
export interface FeedWindowState {
  /**
   * Message ids of the current narrow's window, ascending (oldest
   * first). Bodies are read from `messagesStore` by id.
   */
  orderedIds: MessageId[];
  /** Whether the window reaches the oldest matching message. */
  foundOldest: boolean;
  /** Whether the window reaches the newest matching message. */
  foundNewest: boolean;
  /** Whether the server truncated history due to plan restrictions. */
  historyLimited: boolean;
  /** Lifecycle of the initial fetch. */
  status: FeedFetchStatus;
  /** Human-readable error message when `status === "error"`. */
  error: string | undefined;
  /** Whether an older-page fetch is currently in flight. */
  loadingOlder: boolean;
  /** Whether a newer-page fetch is currently in flight. */
  loadingNewer: boolean;
}

/** The window state for a narrow that has not been fetched yet. */
export function initialFeedWindowState(): FeedWindowState {
  return {
    orderedIds: [],
    foundOldest: false,
    foundNewest: false,
    historyLimited: false,
    status: "idle",
    error: undefined,
    loadingOlder: false,
    loadingNewer: false,
  };
}

// Merge a batch of ids into a sorted, de-duplicated id list. Both
// inputs are assumed already ascending; the result is ascending.
function mergeSortedIds(
  current: readonly MessageId[],
  incoming: readonly MessageId[],
): MessageId[] {
  if (incoming.length === 0) {
    return [...current];
  }
  const seen = new Set<MessageId>(current);
  let changed = false;
  for (const id of incoming) {
    if (!seen.has(id)) {
      seen.add(id);
      changed = true;
    }
  }
  if (!changed) {
    return [...current];
  }
  return [...seen].sort((a, b) => a - b);
}

/** Marks the initial fetch as started. */
export function startInitialFetch(state: FeedWindowState): FeedWindowState {
  return { ...state, status: "loading", error: undefined };
}

/** The payload of one `getMessages` response, narrowed to what we keep. */
export interface FetchPageResult {
  /** Ids of the fetched messages (any order; merged + sorted here). */
  ids: readonly MessageId[];
  foundOldest: boolean;
  foundNewest: boolean;
  historyLimited: boolean;
}

/**
 * Folds the initial-fetch response into the window. Replaces the
 * ordered list (this is the first page for the narrow) and records the
 * pagination cursors.
 */
export function applyInitialFetch(
  state: FeedWindowState,
  result: FetchPageResult,
): FeedWindowState {
  return {
    ...state,
    orderedIds: mergeSortedIds([], result.ids),
    foundOldest: result.foundOldest,
    foundNewest: result.foundNewest,
    historyLimited: state.historyLimited || result.historyLimited,
    status: "ready",
    error: undefined,
  };
}

/** Marks the initial fetch as failed, preserving any prior window. */
export function applyInitialFetchError(
  state: FeedWindowState,
  message: string,
): FeedWindowState {
  return { ...state, status: "error", error: message };
}

/** Marks an older / newer pagination fetch as in flight. */
export function startPageFetch(
  state: FeedWindowState,
  direction: "older" | "newer",
): FeedWindowState {
  return direction === "older"
    ? { ...state, loadingOlder: true }
    : { ...state, loadingNewer: true };
}

/**
 * Folds an older-page response into the window: merges the ids and
 * updates `foundOldest`. `foundNewest` is left untouched — paging
 * backward says nothing about the newest end.
 */
export function applyOlderPage(
  state: FeedWindowState,
  result: FetchPageResult,
): FeedWindowState {
  return {
    ...state,
    orderedIds: mergeSortedIds(state.orderedIds, result.ids),
    foundOldest: result.foundOldest,
    historyLimited: state.historyLimited || result.historyLimited,
    loadingOlder: false,
  };
}

/**
 * Folds a newer-page response into the window: merges the ids and
 * updates `foundNewest`. `foundOldest` is left untouched.
 */
export function applyNewerPage(
  state: FeedWindowState,
  result: FetchPageResult,
): FeedWindowState {
  return {
    ...state,
    orderedIds: mergeSortedIds(state.orderedIds, result.ids),
    foundNewest: result.foundNewest,
    historyLimited: state.historyLimited || result.historyLimited,
    loadingNewer: false,
  };
}

/** Clears the in-flight flag for a failed pagination fetch. */
export function applyPageFetchError(
  state: FeedWindowState,
  direction: "older" | "newer",
): FeedWindowState {
  return direction === "older"
    ? { ...state, loadingOlder: false }
    : { ...state, loadingNewer: false };
}

/**
 * Live `message` event: a new message that *matches the current narrow*
 * (the caller has already checked with `matchesNarrow`).
 *
 * The new message is only appended when the window already reaches the
 * newest end (`foundNewest`): otherwise there is an un-fetched gap
 * between the window and this message, and inserting it would make the
 * list non-contiguous. When `foundNewest` is false the event is
 * dropped — the message will be picked up when the user pages newer.
 * A new message also extends the newest end, so it stays `foundNewest`.
 */
export function applyLiveMessage(
  state: FeedWindowState,
  messageId: MessageId,
): FeedWindowState {
  if (!state.foundNewest) {
    return state;
  }
  const orderedIds = mergeSortedIds(state.orderedIds, [messageId]);
  if (orderedIds.length === state.orderedIds.length) {
    return state;
  }
  return { ...state, orderedIds };
}

/**
 * A message left the current narrow — either deleted, or edited / moved
 * so it no longer matches. Drops it from the ordered list. A no-op if
 * the id was not in the window.
 */
export function removeMessage(
  state: FeedWindowState,
  messageId: MessageId,
): FeedWindowState {
  if (!state.orderedIds.includes(messageId)) {
    return state;
  }
  return {
    ...state,
    orderedIds: state.orderedIds.filter((id) => id !== messageId),
  };
}
