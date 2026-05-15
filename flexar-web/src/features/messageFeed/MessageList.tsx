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

import { useCallback, useEffect, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Spinner } from "../../components/Spinner";
import type { Message } from "../../domain";
import { DateSeparator } from "./DateSeparator";
import { MessageRow } from "./MessageRow";
import { RecipientBar } from "./RecipientBar";
import type { FeedRow } from "./feedItems";
import { useMarkVisibleAsRead } from "./useMarkVisibleAsRead";
import styles from "./MessageList.module.css";

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

  // Open at the bottom: when the narrow changes (`scrollAnchorKey`)
  // and its rows are present, jump to the last row. Tracked by a ref
  // so the jump happens exactly once per narrow — once the user
  // scrolls, subsequent row changes (pagination, live messages) must
  // not yank the viewport back down.
  const anchoredKeyRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (rows.length === 0) {
      return;
    }
    if (anchoredKeyRef.current === scrollAnchorKey) {
      return;
    }
    anchoredKeyRef.current = scrollAnchorKey;
    virtualizer.scrollToIndex(rows.length - 1, { align: "end" });
  }, [scrollAnchorKey, rows.length, virtualizer]);

  // Edge detection for infinite scroll. Runs on every virtualizer
  // change (which includes scroll); compares the scroll offset against
  // the thresholds and asks the feed window for the next page. The feed
  // window guards against duplicate / past-the-end fetches, so calling
  // eagerly here is safe.
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
  }, [
    virtualizer.scrollOffset,
    totalSize,
    hasOlder,
    hasNewer,
    loadingOlder,
    loadingNewer,
    onLoadOlder,
    onLoadNewer,
  ]);

  // Mark unread messages that have actually entered the viewport as read.
  // The hook owns its own debouncing, batching, and visibility gating —
  // see `useMarkVisibleAsRead` for the why.
  useMarkVisibleAsRead({
    rows,
    getMessage,
    virtualizer,
    scrollRef,
  });

  const virtualRows = virtualizer.getVirtualItems();

  return (
    <div ref={scrollRef} className={styles.scroll} role="log" tabIndex={0}>
      {loadingOlder && (
        <div className={styles.edgeSpinner}>
          <Spinner size="sm" aria-label="Loading earlier messages" />
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
                renderMessageRow(row.messageId, row.isGroupStart, getMessage)}
            </div>
          );
        })}
      </div>

      {loadingNewer && (
        <div className={styles.edgeSpinner}>
          <Spinner size="sm" aria-label="Loading later messages" />
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
