// Flexar Hub Web — mark-as-read on scroll (Phase 3.4).
//
// Watches the visible portion of the virtualized message list and marks
// the unread messages that have actually entered the viewport as read,
// in batched, debounced, off-screen tab-aware bursts. The optimistic
// path drops them from the unread buckets and adds the `read` flag to
// the message cache immediately, then `apiClient.updateMessageFlags`
// confirms — the realtime `update_message_flags` event reconciles when
// it arrives (the reducers are idempotent on the same `(id, flag, op)`
// triple).
//
// ── Why "actually visible", not "in the virtualized range" ──────────
//
// `@tanstack/react-virtual` overscans by default (eight rows in the
// feed), so `getVirtualItems()` lists rows the user has *not* scrolled
// to yet. Marking those as read would be wrong — the user has not seen
// them. We compute a row's visibility from its `[start, start+size]`
// extent against the scroll element's `[scrollTop, scrollTop+clientHeight]`
// viewport, which the virtualizer publishes through `getVirtualItems()`
// itself. This stays cheap: the visible window is bounded by viewport
// height, regardless of how many messages the narrow holds.
//
// ── Off-screen tabs ─────────────────────────────────────────────────
//
// Marking messages as read while the tab is hidden defeats the whole
// notion of "the user has read these". The hook gates on
// `document.visibilityState === "visible"` and listens to the
// `visibilitychange` event so a tab that returns to focus picks up the
// rows that were on screen when it was hidden.
//
// ── Local-echo ids ──────────────────────────────────────────────────
//
// Compose-box optimistic echoes carry negative ids (see Phase 2.2).
// They are by definition the viewer's own messages and are never
// unread, so they never enter the pending set; the negative-id filter
// is a belt-and-braces guard to keep them off the wire even if a future
// reducer change lets them through.

import { useEffect, useRef } from "react";
import type { Virtualizer } from "@tanstack/react-virtual";
import { apiClient } from "../../api";
import type { Message, MessageId } from "../../domain";
import { useMessagesStore } from "../../stores/messagesStore";
import { useUnreadStore } from "../../stores/unreadStore";
import { applyUpdateMessageFlagsEventToUnread } from "../../stores/unreadReducer";
import type { FeedRow } from "./feedItems";

/**
 * How long the hook waits after a scroll/render settles before flushing
 * pending ids. Long enough that fast-scrolling past a chunk of unread
 * messages does not mark them all as read — the user has not actually
 * read them. Short enough that a settled view marks promptly.
 */
const FLUSH_DEBOUNCE_MS = 600;

export interface UseMarkVisibleAsReadParams {
  /** The flat row list driving the virtualizer (id-only — bodies via `getMessage`). */
  rows: readonly FeedRow[];
  /** Resolve a message id to its body. */
  getMessage: (messageId: MessageId) => Message | undefined;
  /**
   * The row virtualizer the list renders through. Typed as
   * `Virtualizer<HTMLDivElement, Element>` to match `useVirtualizer`'s
   * default item-element parameter — `MessageList` constructs it that
   * way, and the hook only reads `getVirtualItems()` and
   * `scrollOffset`, neither of which depend on the element type.
   */
  virtualizer: Virtualizer<HTMLDivElement, Element>;
  /** The list's scroll container — for the viewport bounds. */
  scrollRef: React.RefObject<HTMLDivElement | null>;
}

export function useMarkVisibleAsRead({
  rows,
  getMessage,
  virtualizer,
  scrollRef,
}: UseMarkVisibleAsReadParams): void {
  // Pending ids accumulate across debounced ticks; the flush drains
  // them. A `Set` keeps the union O(1) per insert and dedupes naturally.
  const pendingRef = useRef<Set<MessageId>>(new Set());
  // The debounce timer; one outstanding flush at most.
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stash the most recent inputs so the visibility-change listener,
  // which is wired once, reads current values without re-binding.
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const getMessageRef = useRef(getMessage);
  getMessageRef.current = getMessage;

  // Drain the pending set: snapshot the ids, optimistically clear them
  // from the unread buckets and mark them read in the cache, then fire
  // the REST update. On REST failure, **roll back** the optimistic
  // clear — re-file the ids from the cached message bodies so the
  // sidebar counters stop lying. We deliberately do *not* surface a
  // banner: this path fires on every scroll, and a banner per flush
  // would be unusable. The console warning is for the developer.
  function flush(): void {
    flushTimerRef.current = null;
    if (pendingRef.current.size === 0) {
      return;
    }
    const ids = Array.from(pendingRef.current);
    pendingRef.current = new Set();

    useUnreadStore.getState().markRead(ids);
    useMessagesStore.getState().applyOptimisticFlagsBulk(ids, "add", "read");

    void apiClient
      .updateMessageFlags({ op: "add", flag: "read", messages: ids })
      .catch((error: unknown) => {
        // Roll back: re-file each id into its bucket via the cached
        // message body, and remove the optimistic `read` cache flag.
        // We re-use the realtime reducer with a synthesised
        // "remove read" event — same code path that handles the live
        // server event, so the result is consistent.
        useUnreadStore.setState((state) => ({
          unread: applyUpdateMessageFlagsEventToUnread(
            state.unread,
            {
              id: -1,
              type: "update_message_flags",
              op: "remove",
              flag: "read",
              messages: ids,
              all: false,
            },
            (id) => useMessagesStore.getState().messages[id],
          ),
        }));
        useMessagesStore
          .getState()
          .applyOptimisticFlagsBulk(ids, "remove", "read");
        console.warn("mark-as-read: REST call failed, rolled back", error);
      });
  }

  // Re-evaluate which rows are visible whenever the virtualizer's
  // scroll offset or row geometry changes. The visible items are
  // already a windowed subset, so this is cheap.
  // `totalSize` is read at every render so the dep array sees the
  // current value without an inline call expression — extracting it
  // satisfies `react-hooks/exhaustive-deps`.
  const totalSize = virtualizer.getTotalSize();
  useEffect(() => {
    if (typeof document !== "undefined" && document.visibilityState !== "visible") {
      return;
    }
    const scrollEl = scrollRef.current;
    if (scrollEl === null) {
      return;
    }
    const viewportTop = scrollEl.scrollTop;
    const viewportBottom = viewportTop + scrollEl.clientHeight;
    const isUnread = useUnreadStore.getState().isUnread;

    let added = false;
    for (const item of virtualizer.getVirtualItems()) {
      const itemTop = item.start;
      const itemBottom = item.start + item.size;
      // Ignore rows that lie entirely above or below the viewport
      // (overscan rows fall through here).
      if (itemBottom <= viewportTop || itemTop >= viewportBottom) {
        continue;
      }
      const row = rows[item.index];
      if (row === undefined || row.kind !== "message") {
        continue;
      }
      const id = row.messageId;
      // Skip optimistic-echo (negative) ids and rows whose body has
      // not landed yet (the row will be re-evaluated when it does).
      if (id <= 0) {
        continue;
      }
      if (getMessage(id) === undefined) {
        continue;
      }
      if (!isUnread(id)) {
        continue;
      }
      pendingRef.current.add(id);
      added = true;
    }

    if (added && flushTimerRef.current === null) {
      flushTimerRef.current = setTimeout(flush, FLUSH_DEBOUNCE_MS);
    } else if (!added && flushTimerRef.current !== null && pendingRef.current.size === 0) {
      // The user scrolled away before the debounce fired — nothing to flush.
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
  }, [
    rows,
    getMessage,
    virtualizer,
    scrollRef,
    virtualizer.scrollOffset,
    totalSize,
  ]);

  // A tab that returns to focus should pick up rows that were on
  // screen the whole time it was hidden. Bind once.
  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    function onVisibilityChange(): void {
      if (document.visibilityState !== "visible") {
        return;
      }
      const scrollEl = scrollRef.current;
      if (scrollEl === null) {
        return;
      }
      const viewportTop = scrollEl.scrollTop;
      const viewportBottom = viewportTop + scrollEl.clientHeight;
      const isUnread = useUnreadStore.getState().isUnread;
      const currentRows = rowsRef.current;
      const currentGetMessage = getMessageRef.current;

      let added = false;
      for (const item of virtualizer.getVirtualItems()) {
        const itemTop = item.start;
        const itemBottom = item.start + item.size;
        if (itemBottom <= viewportTop || itemTop >= viewportBottom) {
          continue;
        }
        const row = currentRows[item.index];
        if (row === undefined || row.kind !== "message") {
          continue;
        }
        const id = row.messageId;
        if (id <= 0 || currentGetMessage(id) === undefined || !isUnread(id)) {
          continue;
        }
        pendingRef.current.add(id);
        added = true;
      }

      if (added && flushTimerRef.current === null) {
        flushTimerRef.current = setTimeout(flush, FLUSH_DEBOUNCE_MS);
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [virtualizer, scrollRef]);

  // Cancel any pending flush on unmount — the user has navigated away;
  // their next scroll re-evaluates the new view. The pending ids are
  // dropped on purpose (the user did not necessarily read them).
  useEffect(() => {
    return () => {
      if (flushTimerRef.current !== null) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      pendingRef.current.clear();
    };
  }, []);
}
