// Flexar Hub Web — virtualized message list (Phase 1.6).
//
// The feed's scroll container. It renders the `FeedRow[]` derived by
// `buildFeedRows` through `@tanstack/react-virtual`, which windows the
// list so a long history stays cheap, measures variable row heights,
// and — crucially — preserves the viewport when older rows are
// prepended (scroll anchoring), which is what makes upward infinite
// scroll not jump.
//
// ── The inline-style constraint ─────────────────────────────────────
//
// react-virtual's documented pattern positions each row with an inline
// `style` (`transform: translateY(start)`, absolute positioning). The
// repo's ESLint config forbids the `style` prop outright
// (`react/forbid-dom-props`). The sanctioned workaround — already used
// by the overlay primitives (`src/components/_overlay`) — is to write
// the *computed geometry* as CSS custom properties imperatively through
// a ref, and have the CSS Module consume them with `var(--row-start)`.
// That is what `rowRefCallback` below does: it forwards the node to
// react-virtual's `measureElement` (which only reads
// `getBoundingClientRect`, no `style` needed) AND stamps `--row-start`
// onto it. The geometry is computed layout, not a design token, so this
// does not breach the "tokens only" rule (same reasoning as
// `useOverlayPosition`).
//
// ── Recipient bars ──────────────────────────────────────────────────
//
// A recipient bar is a normal virtualized row at the start of each
// conversation block — it scrolls with the content it heads. True
// pinned-while-scrolling stickiness inside a virtualized list needs a
// separate always-mounted overlay header tracking the topmost visible
// block; that machinery is disproportionate for Phase 1.6 and is left
// as a later refinement. The in-flow bar still does its core job:
// marking where each conversation block begins.
//
// ── Infinite scroll ─────────────────────────────────────────────────
//
// On scroll, when the viewport nears the top the list asks the feed
// window for an older page; near the bottom, a newer page. The feed
// window's in-flight flags and `foundOldest` / `foundNewest` cursors
// keep this to at most one request per direction. A `Spinner` shows at
// whichever end has a fetch in flight.
//
// jsdom note: `getBoundingClientRect` / `scrollHeight` are all-zero
// under the test environment, so virtualization geometry collapses
// there. The component still renders its rows (react-virtual falls back
// to estimated sizes) and the tests assert on content and behaviour,
// not pixel geometry — see `MessageFeed.test.tsx`.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { IconButton } from "../../components/IconButton";
import { Spinner } from "../../components/Spinner";
import type { Message } from "../../domain";
import { DateSeparator } from "./DateSeparator";
import { MessageRow } from "./MessageRow";
import { RecipientBar } from "./RecipientBar";
import type { FeedRecipient, FeedRow } from "./feedItems";
import { useFeedKeyboard } from "./useFeedKeyboard";
import { useMarkVisibleAsRead } from "./useMarkVisibleAsRead";
import styles from "./MessageList.module.css";

// How far from the bottom (px) the viewport must move *up* before we
// show the "scroll to bottom" affordance. Same threshold as the
// upward infinite-scroll trigger — keeps "I lost track of the bottom"
// vs "I'm following live" decisions on the same scale.
const SCROLL_TO_BOTTOM_THRESHOLD = 400;

export interface MessageListProps {
  /** The flat row list to render, top to bottom. */
  rows: readonly FeedRow[];
  /** Resolve a message id to its body (from `messagesStore`). */
  getMessage: (messageId: number) => Message | undefined;
  /** Whether more history exists above the current window. */
  hasOlder: boolean;
  /** Whether more history exists below the current window. */
  hasNewer: boolean;
  /** Whether an older-page fetch is in flight. */
  loadingOlder: boolean;
  /** Whether a newer-page fetch is in flight. */
  loadingNewer: boolean;
  /** Request the page of messages older than the window. */
  onLoadOlder: () => void;
  /** Request the page of messages newer than the window. */
  onLoadNewer: () => void;
  /**
   * Identity of the current narrow's window. When it changes, the list
   * jumps to the bottom (the newest message) — the feed opens at the
   * most recent message, the conventional chat behaviour. Stable while
   * the user stays on one narrow.
   */
  scrollAnchorKey: string;
}

// Rough starting height for an unmeasured row, in pixels. react-virtual
// replaces this with the real measured height as rows mount; a sane
// estimate just reduces the initial layout shuffle.
const ESTIMATED_ROW_HEIGHT = 56;

// How close to an edge (in pixels) the viewport must get before the
// list asks for the next page in that direction.
const LOAD_THRESHOLD = 400;

// Per-row estimate by kind: bars and separators are shorter than a
// message row, so a kind-aware estimate settles faster.
function estimateRowSize(row: FeedRow): number {
  switch (row.kind) {
    case "recipient-bar":
      return 36;
    case "date-separator":
      return 32;
    case "message":
      return ESTIMATED_ROW_HEIGHT;
  }
}

export function MessageList({
  rows,
  getMessage,
  hasOlder,
  hasNewer,
  loadingOlder,
  loadingNewer,
  onLoadOlder,
  onLoadNewer,
  scrollAnchorKey,
}: MessageListProps): React.JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null);
  const sizerRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => estimateRowSize(rows[index]),
    // Stable keys per row — this is what lets react-virtual keep the
    // viewport pinned when rows are prepended (scroll anchoring).
    getItemKey: (index) => rows[index].key,
    overscan: 8,
  });

  // Forwarded to each row element: hands the node to react-virtual for
  // measurement AND stamps the computed `start` offset as a CSS custom
  // property the CSS Module positions the row with (see the file
  // header for why this is not an inline `style`).
  const makeRowRef = useCallback(
    (start: number) => (node: HTMLDivElement | null) => {
      if (node !== null) {
        node.style.setProperty("--row-start", `${start}px`);
      }
      virtualizer.measureElement(node);
    },
    [virtualizer],
  );

  // The list's full scrollable height. react-virtual's pattern sets
  // this as an inline `style` height on the spacer; the repo forbids
  // the `style` prop, so — as with the row offsets — it is written as
  // a CSS custom property through a ref and consumed by the CSS Module.
  const totalSize = virtualizer.getTotalSize();
  useEffect(() => {
    sizerRef.current?.style.setProperty("--total-size", `${totalSize}px`);
  }, [totalSize]);

  // Stick-to-bottom: a chat feed opens at the most recent message and
  // stays there while the user is reading live. The naive "jump once
  // when rows arrive" approach fails because react-virtual jumps using
  // estimated row heights (`estimateSize`), then real measurements come
  // in, `totalSize` grows, and the absolute scrollTop pinned by the
  // first jump leaves the user stranded in the middle of the feed.
  //
  // Invariant: `stayAtBottomRef` is true while the user is at the bottom
  // (or has just landed on the narrow). Every `totalSize` change in that
  // state re-scrolls to the last row, so measurement settling and newly
  // arriving live messages both keep the viewport pinned. Scrolling up
  // past `SCROLL_TO_BOTTOM_THRESHOLD` releases it; scrolling back into
  // the bottom band re-arms it. The scroll handler below owns the
  // arm/release transitions.
  const stayAtBottomRef = useRef(true);
  const anchoredKeyRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (rows.length === 0) {
      return;
    }
    if (anchoredKeyRef.current === scrollAnchorKey) {
      return;
    }
    anchoredKeyRef.current = scrollAnchorKey;
    stayAtBottomRef.current = true;
    virtualizer.scrollToIndex(rows.length - 1, { align: "end" });
  }, [scrollAnchorKey, rows.length, virtualizer]);

  // Re-pin to bottom whenever the scrollable area grows while in
  // stick-mode. This is what catches the measurement-settling case
  // (rows mount taller than the 56px estimate) and live new-message
  // arrivals — both move the bottom edge, and we want to follow it.
  useEffect(() => {
    if (!stayAtBottomRef.current || rows.length === 0) {
      return;
    }
    virtualizer.scrollToIndex(rows.length - 1, { align: "end" });
  }, [totalSize, rows.length, virtualizer]);

  // Release stick-to-bottom on any user-initiated scroll input. We
  // release synchronously (not via rAF) so the next render — which the
  // virtualizer schedules in response to the user's scroll — does NOT
  // see `stayAtBottomRef.current === true` and yank the viewport back
  // to the bottom in the re-pin effect above. Re-arming when the user
  // returns to the live end is handled by the scroll handler below.
  // Programmatic `scrollToIndex` calls (narrow-change jump, live-
  // message follow, scrollToBottom button) do not dispatch these
  // events, so they can't accidentally trip the release.
  useEffect(() => {
    const element = scrollRef.current;
    if (element === null) {
      return;
    }
    const release = (): void => {
      stayAtBottomRef.current = false;
    };
    element.addEventListener("wheel", release, { passive: true });
    element.addEventListener("touchmove", release, { passive: true });
    element.addEventListener("keydown", release);
    return () => {
      element.removeEventListener("wheel", release);
      element.removeEventListener("touchmove", release);
      element.removeEventListener("keydown", release);
    };
  }, []);

  // Whether the viewport is far enough from the bottom to surface the
  // "scroll to last message" affordance. Refreshed on every scroll
  // event (the virtualizer's `scrollOffset` is the most reactive
  // signal we already have).
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  // Edge detection for infinite scroll. Runs on every virtualizer
  // change (which includes scroll); compares the scroll offset against
  // the thresholds and asks the feed window for the next page. The feed
  // window guards against duplicate / past-the-end fetches, so calling
  // eagerly here is safe. Also arms / releases stick-to-bottom mode
  // based on how far the viewport is from the live end.
  useEffect(() => {
    const element = scrollRef.current;
    if (element === null) {
      return;
    }
    const { scrollTop, clientHeight } = element;
    if (hasOlder && !loadingOlder && scrollTop < LOAD_THRESHOLD) {
      onLoadOlder();
    }
    if (
      hasNewer &&
      !loadingNewer &&
      totalSize - (scrollTop + clientHeight) < LOAD_THRESHOLD
    ) {
      onLoadNewer();
    }
    // Distance the viewport bottom is above the content bottom. Powers
    // both the scroll-to-bottom affordance and the stick re-arm below.
    // Release is handled separately on user-initiated events, NOT here:
    // a programmatic `scrollToIndex` propagates scroll-top to the DOM
    // asynchronously, so this effect can briefly read a stale
    // (scroll-top=0) snapshot and misread it as "user scrolled away".
    const distanceFromBottom = totalSize - (scrollTop + clientHeight);
    if (distanceFromBottom < 4) {
      // Re-arm the stick when scrollToBottom (or a manual return)
      // lands the viewport back at the live end.
      stayAtBottomRef.current = true;
    }
    setShowScrollToBottom(
      rows.length > 0 && distanceFromBottom > SCROLL_TO_BOTTOM_THRESHOLD,
    );
  }, [
    virtualizer.scrollOffset,
    totalSize,
    hasOlder,
    hasNewer,
    loadingOlder,
    loadingNewer,
    onLoadOlder,
    onLoadNewer,
    rows.length,
  ]);

  const scrollToBottom = useCallback(() => {
    if (rows.length === 0) {
      return;
    }
    virtualizer.scrollToIndex(rows.length - 1, { align: "end" });
  }, [rows.length, virtualizer]);

  // Pinned recipient bar: the most-recent `recipient-bar` row at or
  // above the topmost visible row. As the user scrolls deep into a
  // long conversation block, the original in-flow bar leaves the
  // viewport — without this, you'd lose the "where am I?" anchor
  // until the next block starts. Real-pinned behaviour (Slack /
  // Telegram convention).
  //
  // Implementation: read the virtualizer's visible-range start, walk
  // back through `rows` for the nearest recipient bar, render it at
  // the top of the scroll container with `position: sticky`. Sticky
  // works here because the pinned bar is a sibling of the absolute-
  // positioned sizer, not a child — the scroll container is its
  // sticky context.
  const virtualRows = virtualizer.getVirtualItems();
  // The virtualizer keeps an overscan buffer of rows above the
  // viewport in the DOM, so `virtualRows[0]` is the topmost RENDERED
  // row, not the topmost VISIBLE one. We need "visible top": the
  // first row whose top is at or below the current scroll offset,
  // OR whose bottom has scrolled below the viewport top (i.e. the
  // row straddles the viewport top). The two-clause test is cheap
  // and also handles jsdom's zero-height layout (every row reports
  // size=0 in tests, where the bottom-check alone never matches).
  const scrollOffset = virtualizer.scrollOffset;
  const topVisibleIndex = useMemo(() => {
    if (virtualRows.length === 0) {
      return null;
    }
    if (scrollOffset === null) {
      return virtualRows[0].index;
    }
    for (const vr of virtualRows) {
      if (vr.start >= scrollOffset || vr.start + vr.size > scrollOffset) {
        return vr.index;
      }
    }
    return virtualRows[virtualRows.length - 1].index;
  }, [virtualRows, scrollOffset]);
  const pinnedRecipient: FeedRecipient | null = useMemo(() => {
    if (topVisibleIndex === null) {
      return null;
    }
    // If the topmost visible row IS a recipient bar, no pin needed —
    // the in-flow bar is already on screen.
    if (rows[topVisibleIndex]?.kind === "recipient-bar") {
      return null;
    }
    for (let i = topVisibleIndex - 1; i >= 0; i--) {
      const row = rows[i];
      if (row?.kind === "recipient-bar") {
        return row.recipient;
      }
    }
    return null;
  }, [rows, topVisibleIndex]);

  // Mark unread messages that have actually entered the viewport as read.
  // The hook owns its own debouncing, batching, and visibility gating —
  // see `useMarkVisibleAsRead` for the why.
  useMarkVisibleAsRead({
    rows,
    getMessage,
    virtualizer,
    scrollRef,
  });

  // Feed-scope keyboard shortcuts (j / k / arrows / Home / End / r).
  // Active only while a message list is mounted — special views
  // (Inbox, Drafts) don't get j/k.
  useFeedKeyboard({ rows, virtualizer, scrollRef });

  return (
    <div className={styles.container}>
      <div ref={scrollRef} className={styles.scroll} role="log" tabIndex={0}>
        {pinnedRecipient !== null && (
          <div className={styles.pinnedBar} aria-hidden="true">
            <RecipientBar recipient={pinnedRecipient} />
          </div>
        )}
        {loadingOlder && (
          <div className={styles.edgeSpinner}>
            <Spinner size="sm" aria-label="Загрузка более ранних сообщений" />
          </div>
        )}

        <div ref={sizerRef} className={styles.sizer}>
          {virtualRows.map((virtualRow) => {
            const row = rows[virtualRow.index];
            return (
              <div
                key={virtualRow.key}
                ref={makeRowRef(virtualRow.start)}
                data-index={virtualRow.index}
                className={styles.rowWrapper}
              >
                {row.kind === "recipient-bar" && (
                  <RecipientBar recipient={row.recipient} />
                )}
                {row.kind === "date-separator" && (
                  <DateSeparator dayStart={row.dayStart} />
                )}
                {row.kind === "message" &&
                  renderMessageRow(
                    row.messageId,
                    row.isGroupStart,
                    getMessage,
                  )}
              </div>
            );
          })}
        </div>

        {loadingNewer && (
          <div className={styles.edgeSpinner}>
            <Spinner size="sm" aria-label="Загрузка более поздних сообщений" />
          </div>
        )}
      </div>

      {showScrollToBottom && (
        <div className={styles.scrollToBottom}>
          <IconButton
            icon="chevron-down"
            variant="primary"
            aria-label="К последнему сообщению"
            onClick={scrollToBottom}
          />
        </div>
      )}
    </div>
  );
}

// Render one message row, resolving its body from the store. A row
// whose body is not in the cache (a transient state — the id list and
// the store can momentarily disagree) renders nothing rather than
// crashing; the next store update fills it in.
function renderMessageRow(
  messageId: number,
  isGroupStart: boolean,
  getMessage: (id: number) => Message | undefined,
): React.JSX.Element | null {
  const message = getMessage(messageId);
  if (message === undefined) {
    return null;
  }
  return <MessageRow message={message} isGroupStart={isGroupStart} />;
}
