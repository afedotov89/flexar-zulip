// Keyboard navigation for the virtualized message list (Phase 6.1).
//
// j / ↓ / k / ↑ / Home / End move focus between message rows; `r`
// jumps focus to the compose textarea. Bars (recipient, date) are
// skipped — only `kind === "message"` rows are reachable, matching the
// model "the active thing is a message, not the conversation header".
//
// ── Why "active by index" rather than DOM focus walking ────────────
//
// The list is virtualized: the DOM node for a row outside the
// overscan window does not exist, so a "next sibling" walk dies at the
// edge. We instead carry an active index in a ref, scroll it into view
// via the virtualizer, and re-focus the matching `<article>` after the
// browser has painted (via `requestAnimationFrame`). The default
// starts at the last message row — the same place "open at the
// bottom" puts the viewport.
//
// `r` is intentionally simple: it just bumps the compose-focus signal.
// Compose pre-fills its recipient from the URL narrow, so focusing
// the textarea is equivalent to "reply in this narrow" for every
// narrow that has a destination. Quoting / per-message reply targeting
// is out of scope for 6.1.

import { useCallback, useEffect, useRef, type RefObject } from "react";
import type { Virtualizer } from "@tanstack/react-virtual";
import { useKeyboardShortcut } from "../../lib/keyboard";
import { useComposeFocusStore } from "../compose";
import type { FeedRow } from "./feedItems";

interface UseFeedKeyboardParams {
  rows: readonly FeedRow[];
  virtualizer: Virtualizer<HTMLDivElement, Element>;
  scrollRef: RefObject<HTMLDivElement | null>;
}

export function useFeedKeyboard({
  rows,
  virtualizer,
  scrollRef,
}: UseFeedKeyboardParams): void {
  // The index of the currently "active" row in `rows`. Initially
  // `undefined` so the first j / k snaps to the bottom / top message
  // rather than activating an unrelated middle one.
  const activeIndexRef = useRef<number | undefined>(undefined);

  // When the row list shrinks (narrow change, history trim), the
  // stored index might be out of range. Reset it so the next j / k
  // re-anchors from the bottom/top.
  useEffect(() => {
    if (
      activeIndexRef.current !== undefined &&
      activeIndexRef.current >= rows.length
    ) {
      activeIndexRef.current = undefined;
    }
  }, [rows.length]);

  // Helper: scroll the active index into view and focus its row's
  // `<article>` once the browser has rendered it. Tolerates a tick of
  // delay between scroll and the virtualizer mounting the row.
  const focusActive = useCallback(() => {
    const index = activeIndexRef.current;
    if (index === undefined) {
      return;
    }
    virtualizer.scrollToIndex(index, { align: "auto" });
    // Try immediately — if the row is already in the virtualizer's
    // overscan window, the article element is in the DOM right now
    // and we can focus synchronously. This is the common case for
    // any list that fits without scrolling.
    if (focusArticleAt(scrollRef.current, index)) {
      return;
    }
    // Otherwise the row will mount once react-virtual flushes its
    // next render. Poll briefly for it. We don't use rAF — background
    // tabs throttle rAF heavily, and the user expects keyboard
    // navigation to feel instant even in tabs they just switched to.
    let attempts = 0;
    const intervalId = window.setInterval(() => {
      attempts += 1;
      if (focusArticleAt(scrollRef.current, index) || attempts > 10) {
        window.clearInterval(intervalId);
      }
    }, 16);
  }, [scrollRef, virtualizer]);

  const goRelative = useCallback(
    (direction: 1 | -1) => {
      const current = activeIndexRef.current;
      if (current === undefined) {
        // First press: snap to last (for j/↓) or first (for k/↑)
        // message row. Looking from the right end for direction=1 puts
        // us on the bottom-most message, which is what the user just
        // saw on screen.
        const seed =
          direction === 1
            ? lastMessageRowIndex(rows)
            : firstMessageRowIndex(rows);
        if (seed === undefined) {
          return;
        }
        activeIndexRef.current = seed;
        focusActive();
        return;
      }
      const next = stepToMessageRow(rows, current, direction);
      if (next === undefined) {
        return;
      }
      activeIndexRef.current = next;
      focusActive();
    },
    [rows, focusActive],
  );

  const goEdge = useCallback(
    (edge: "first" | "last") => {
      const index =
        edge === "first"
          ? firstMessageRowIndex(rows)
          : lastMessageRowIndex(rows);
      if (index === undefined) {
        return;
      }
      activeIndexRef.current = index;
      focusActive();
    },
    [rows, focusActive],
  );

  const requestComposeFocus = useComposeFocusStore((s) => s.requestFocus);

  useKeyboardShortcut(
    "feed-next",
    useCallback(
      (event: KeyboardEvent) => {
        // Stop the page from also scrolling on ArrowDown.
        event.preventDefault();
        goRelative(1);
      },
      [goRelative],
    ),
  );

  useKeyboardShortcut(
    "feed-prev",
    useCallback(
      (event: KeyboardEvent) => {
        event.preventDefault();
        goRelative(-1);
      },
      [goRelative],
    ),
  );

  useKeyboardShortcut(
    "feed-top",
    useCallback(
      (event: KeyboardEvent) => {
        event.preventDefault();
        goEdge("first");
      },
      [goEdge],
    ),
  );

  useKeyboardShortcut(
    "feed-bottom",
    useCallback(
      (event: KeyboardEvent) => {
        event.preventDefault();
        goEdge("last");
      },
      [goEdge],
    ),
  );

  useKeyboardShortcut(
    "feed-reply",
    useCallback(
      (event: KeyboardEvent) => {
        event.preventDefault();
        requestComposeFocus();
      },
      [requestComposeFocus],
    ),
  );
}

// Focus the `<article>` inside the data-index wrapper at `index`.
// Returns true on success. Used by `focusActive` for both the
// synchronous fast path and the interval poll fallback.
function focusArticleAt(
  scrollNode: HTMLDivElement | null,
  index: number,
): boolean {
  if (scrollNode === null) {
    return false;
  }
  const article = scrollNode.querySelector<HTMLElement>(
    `[data-index="${index}"] article`,
  );
  if (article === null) {
    return false;
  }
  article.focus();
  return true;
}

// Find the next index after `from` whose row is a message, walking
// in `direction`. Returns undefined if there isn't one.
function stepToMessageRow(
  rows: readonly FeedRow[],
  from: number,
  direction: 1 | -1,
): number | undefined {
  for (let i = from + direction; i >= 0 && i < rows.length; i += direction) {
    if (rows[i].kind === "message") {
      return i;
    }
  }
  return undefined;
}

function firstMessageRowIndex(rows: readonly FeedRow[]): number | undefined {
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].kind === "message") {
      return i;
    }
  }
  return undefined;
}

function lastMessageRowIndex(rows: readonly FeedRow[]): number | undefined {
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i].kind === "message") {
      return i;
    }
  }
  return undefined;
}
