// Flexar Hub Web — the feed's per-narrow window hook (Phase 1.6).
//
// `useFeedWindow(narrow)` owns everything the message feed needs to
// render one narrow: the ordered id list, the pagination cursors, the
// fetch lifecycle, and live-event reconciliation. It is the seam
// between the pure `feedWindowReducer` (state transitions) and the
// effectful world (the `apiClient.getMessages` network calls, the
// `messagesStore` cache it writes through, and the live event stream
// `messagesStore` folds).
//
// ── Data flow ───────────────────────────────────────────────────────
//
// On narrow change the hook resets to a fresh window and fires the
// initial fetch: `getMessages({ narrow, anchor, numBefore, numAfter })`,
// `ingest`s the result into `messagesStore`, and folds the returned ids
// + cursors into the window via the reducer.
//
//   anchor: `"newest"`. The feed opens at the bottom (the most recent
//   messages) — the conventional chat behaviour and the one that needs
//   no unread-state plumbing. `"first_unread"` (open at the first
//   unread message) is a deliberate later refinement; `unreadStore`
//   exists but wiring the feed's scroll-to-anchor to it is its own
//   piece of work and out of this phase's scope.
//
// `loadOlder()` / `loadNewer()` fetch adjacent pages anchored on the
// oldest / newest loaded id, guarded by `foundOldest` / `foundNewest`
// and the in-flight flags so a burst of scroll events fires at most one
// request per direction.
//
// ── Live-event reconciliation ───────────────────────────────────────
//
// `messagesStore` already folds `message` / `update_message` /
// `delete_message` / `reaction` / `update_message_flags` into its cache
// (the realtime queue is unfiltered, so *every* message reaches the
// store). The feed subscribes to that cache and reconciles its window
// against it whenever it changes:
//
//   - a message in the store, matching the current narrow, not yet in
//     the window → appended (only when the window reaches the newest
//     end — see `applyLiveMessage`);
//   - a message in the window that is gone from the store (deleted) or
//     no longer matches the narrow (edited / moved out) → removed.
//
// `matchesNarrow` decides "matches the narrow"; the operators it cannot
// evaluate client-side stay permissive, so the worst case is showing a
// message the server would have filtered until the next refetch — never
// hiding one it would have included (see `matchesNarrow`'s header).

import { useCallback, useEffect, useReducer, useRef } from "react";
import { apiClient } from "../../api";
import type { MessageId, Narrow } from "../../domain";
import { describeApiError } from "../../lib/errors";
import { matchesNarrow } from "../../lib/narrow";
import { useMessagesStore } from "../../stores/messagesStore";
import {
  applyInitialFetch,
  applyInitialFetchError,
  applyLiveMessage,
  applyNewerPage,
  applyOlderPage,
  applyPageFetchError,
  initialFeedWindowState,
  removeMessage,
  startInitialFetch,
  startPageFetch,
  type FeedWindowState,
  type FetchPageResult,
} from "./feedWindowReducer";

// How many messages each fetch pulls. The initial fetch pulls a page in
// each direction around the anchor; pagination pulls one page.
const PAGE_SIZE = 50;

// The reducer-action union the hook's `useReducer` dispatches. Each
// action delegates to a pure transition in `feedWindowReducer`.
type FeedWindowAction =
  | { type: "reset" }
  | { type: "initial-fetch-start" }
  | { type: "initial-fetch-success"; result: FetchPageResult }
  | { type: "initial-fetch-error"; message: string }
  | { type: "page-fetch-start"; direction: "older" | "newer" }
  | { type: "older-page-success"; result: FetchPageResult }
  | { type: "newer-page-success"; result: FetchPageResult }
  | { type: "page-fetch-error"; direction: "older" | "newer" }
  | { type: "live-message"; messageId: MessageId }
  | { type: "remove-messages"; messageIds: readonly MessageId[] };

function feedWindowStateReducer(
  state: FeedWindowState,
  action: FeedWindowAction,
): FeedWindowState {
  switch (action.type) {
    case "reset":
      return initialFeedWindowState();
    case "initial-fetch-start":
      return startInitialFetch(state);
    case "initial-fetch-success":
      return applyInitialFetch(state, action.result);
    case "initial-fetch-error":
      return applyInitialFetchError(state, action.message);
    case "page-fetch-start":
      return startPageFetch(state, action.direction);
    case "older-page-success":
      return applyOlderPage(state, action.result);
    case "newer-page-success":
      return applyNewerPage(state, action.result);
    case "page-fetch-error":
      return applyPageFetchError(state, action.direction);
    case "live-message":
      return applyLiveMessage(state, action.messageId);
    case "remove-messages": {
      let next = state;
      for (const id of action.messageIds) {
        next = removeMessage(next, id);
      }
      return next;
    }
  }
}

/** What `useFeedWindow` exposes to the feed components. */
export interface FeedWindow extends FeedWindowState {
  /** Fetch the page of messages older than the window, if any. */
  loadOlder: () => void;
  /** Fetch the page of messages newer than the window, if any. */
  loadNewer: () => void;
  /** Re-run the initial fetch (used to recover from an error state). */
  retry: () => void;
}

// Convert an `unknown` thrown by the API client into a readable string.
function describeError(error: unknown): string {
  return describeApiError(error, "Не удалось загрузить сообщения.");
}

/**
 * The feed window for `narrow`. A new narrow resets the window and
 * triggers a fresh initial fetch; the returned object drives the
 * virtualized list (`orderedIds`), the loading / empty / error states,
 * and the pagination callbacks.
 *
 * Pass `narrow` by stable reference per narrow — `useCurrentNarrow`
 * already memoises on the pathname, so this hook keys its effects on
 * the narrow reference.
 */
export function useFeedWindow(narrow: Narrow): FeedWindow {
  const [state, dispatch] = useReducer(
    feedWindowStateReducer,
    undefined,
    initialFeedWindowState,
  );

  // `ingest` is a stable store action; pulled once so effects can call
  // it without re-subscribing the component to the whole store.
  const ingest = useMessagesStore((store) => store.ingest);

  // The latest window state, mirrored into a ref so the long-lived
  // `messagesStore` subscription and the pagination callbacks read
  // current values without being re-created on every state change.
  const stateRef = useRef(state);
  stateRef.current = state;

  // The current narrow, in a ref, for the same reason: the live-event
  // subscription closes over it once and must see the latest value.
  const narrowRef = useRef(narrow);
  narrowRef.current = narrow;

  // A monotonically bumped token; `retry()` advances it to re-run the
  // initial fetch without changing the narrow reference.
  const [retryToken, bumpRetryToken] = useReducer((n: number) => n + 1, 0);
  const retry = useCallback(() => {
    bumpRetryToken();
  }, []);

  // Initial fetch — runs on narrow change and on `retry()`. A
  // `cancelled` flag drops a response that arrives after the narrow
  // changed (or another retry fired), so a stale window is never
  // committed. `retryToken` is intentionally in the dep array; the
  // narrow is read through both `narrow` (the change trigger) and the
  // request itself.
  useEffect(() => {
    let cancelled = false;
    dispatch({ type: "reset" });
    dispatch({ type: "initial-fetch-start" });

    apiClient
      .getMessages({
        narrow,
        anchor: "newest",
        numBefore: PAGE_SIZE,
        numAfter: PAGE_SIZE,
      })
      .then((result) => {
        if (cancelled) {
          return;
        }
        ingest(result.messages);
        dispatch({
          type: "initial-fetch-success",
          result: {
            ids: result.messages.map((message) => message.id),
            foundOldest: result.foundOldest,
            foundNewest: result.foundNewest,
            historyLimited: result.historyLimited,
          },
        });
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        dispatch({
          type: "initial-fetch-error",
          message: describeError(error),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [narrow, retryToken, ingest]);

  // Older-page fetch: anchored just before the oldest loaded id.
  const loadOlder = useCallback(() => {
    const current = stateRef.current;
    if (
      current.status !== "ready" ||
      current.foundOldest ||
      current.loadingOlder ||
      current.orderedIds.length === 0
    ) {
      return;
    }
    const oldestId = current.orderedIds[0];
    dispatch({ type: "page-fetch-start", direction: "older" });
    apiClient
      .getMessages({
        narrow: narrowRef.current,
        anchor: oldestId,
        // The anchor message is already in the window; fetch strictly
        // older messages and exclude the anchor itself.
        numBefore: PAGE_SIZE,
        numAfter: 0,
        includeAnchor: false,
      })
      .then((result) => {
        ingest(result.messages);
        dispatch({
          type: "older-page-success",
          result: {
            ids: result.messages.map((message) => message.id),
            foundOldest: result.foundOldest,
            foundNewest: result.foundNewest,
            historyLimited: result.historyLimited,
          },
        });
      })
      .catch(() => {
        dispatch({ type: "page-fetch-error", direction: "older" });
      });
  }, [ingest]);

  // Newer-page fetch: anchored just after the newest loaded id.
  const loadNewer = useCallback(() => {
    const current = stateRef.current;
    if (
      current.status !== "ready" ||
      current.foundNewest ||
      current.loadingNewer ||
      current.orderedIds.length === 0
    ) {
      return;
    }
    const newestId = current.orderedIds[current.orderedIds.length - 1];
    dispatch({ type: "page-fetch-start", direction: "newer" });
    apiClient
      .getMessages({
        narrow: narrowRef.current,
        anchor: newestId,
        numBefore: 0,
        numAfter: PAGE_SIZE,
        includeAnchor: false,
      })
      .then((result) => {
        ingest(result.messages);
        dispatch({
          type: "newer-page-success",
          result: {
            ids: result.messages.map((message) => message.id),
            foundOldest: result.foundOldest,
            foundNewest: result.foundNewest,
            historyLimited: result.historyLimited,
          },
        });
      })
      .catch(() => {
        dispatch({ type: "page-fetch-error", direction: "newer" });
      });
  }, [ingest]);

  // Live-event reconciliation. Subscribe to the `messagesStore` cache
  // directly (outside React's render subscription) so every fold of a
  // `message` / `update_message` / `delete_message` event triggers one
  // reconciliation pass. The pass is a cheap diff: appends matching new
  // messages, removes deleted / moved-out ones.
  useEffect(() => {
    function reconcile(): void {
      const current = stateRef.current;
      if (current.status !== "ready") {
        return;
      }
      const activeNarrow = narrowRef.current;
      const { messages, flags } = useMessagesStore.getState();

      // Removals: ids in the window that the store no longer holds
      // (deleted) or that no longer match the narrow (edited / moved).
      const toRemove: MessageId[] = [];
      for (const id of current.orderedIds) {
        const message = messages[id];
        if (message === undefined) {
          toRemove.push(id);
          continue;
        }
        if (!matchesNarrow(message, activeNarrow, { flags: flags[id] })) {
          toRemove.push(id);
        }
      }
      if (toRemove.length > 0) {
        dispatch({ type: "remove-messages", messageIds: toRemove });
      }

      // Appends: messages in the store, matching the narrow, newer than
      // the window's newest id, not already present. Only meaningful
      // when the window reaches the newest end (`applyLiveMessage`
      // enforces that too — this just avoids needless scans).
      if (current.foundNewest) {
        const known = new Set(current.orderedIds);
        const newestId =
          current.orderedIds.length > 0
            ? current.orderedIds[current.orderedIds.length - 1]
            : 0;
        for (const message of Object.values(messages)) {
          if (
            message.id > newestId &&
            !known.has(message.id) &&
            matchesNarrow(message, activeNarrow, { flags: flags[message.id] })
          ) {
            dispatch({ type: "live-message", messageId: message.id });
          }
        }
      }
    }

    // Reconcile once on mount (covers messages already in the cache for
    // this narrow) and on every subsequent store change.
    reconcile();
    return useMessagesStore.subscribe(reconcile);
  }, []);

  return { ...state, loadOlder, loadNewer, retry };
}
