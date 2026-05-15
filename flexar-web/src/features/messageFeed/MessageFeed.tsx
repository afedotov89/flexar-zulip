// Flexar Hub Web — the message feed feature root (Phase 1.6).
//
// The app's centre column: the messages of the current narrow. This
// component is the wiring layer — it owns no logic of its own, it
// composes the pieces:
//
//   useCurrentNarrow()  → the narrow the URL addresses
//   useFeedWindow()     → the ordered id list + pagination + lifecycle
//                         for that narrow (history fetch, live events)
//   messagesStore       → the message bodies, resolved by id
//   buildFeedRows()     → the id list → the flat `FeedRow[]`
//   MessageList         → the virtualized scroll view of those rows
//
// ── States ──────────────────────────────────────────────────────────
//
//   loading  — the initial fetch is in flight: skeleton rows.
//   error    — the initial fetch failed: a `Banner` with a retry.
//   empty    — the fetch succeeded but the narrow has no messages.
//   ready    — the normal case: the virtualized list, plus a
//              `historyLimited` notice when the server truncated
//              history for plan reasons.
//
// `MessageFeed` only renders for *narrow* routes. The special views
// (Inbox / Recent / Drafts) are not narrow feeds and are not built in
// this phase — `Feed` (the page) keeps a placeholder for those.

import { useMemo } from "react";
import { Banner } from "../../components/Banner";
import { Skeleton } from "../../components/Skeleton";
import type { Message, Narrow } from "../../domain";
import { narrowToPath } from "../../lib/narrow";
import { useMessagesStore } from "../../stores/messagesStore";
import { ComposeBox } from "../compose";
import { MarkAsReadButton } from "./MarkAsReadButton";
import { MessageList } from "./MessageList";
import { buildFeedRows } from "./feedItems";
import { useFeedWindow } from "./useFeedWindow";
import styles from "./MessageFeed.module.css";

export interface MessageFeedProps {
  /** The narrow whose messages the feed renders. */
  narrow: Narrow;
}

// Skeleton placeholder shown during the initial fetch — a handful of
// rows in the message-row rhythm so the column does not jump when the
// real list arrives.
function LoadingState(): React.JSX.Element {
  return (
    <div className={styles.loading} aria-hidden="true">
      {[0, 1, 2, 3, 4, 5].map((index) => (
        <div key={index} className={styles.loadingRow}>
          <Skeleton variant="circle" height="md" />
          <div className={styles.loadingLines}>
            <Skeleton variant="text" width="sm" height="sm" />
            <Skeleton variant="text" width="full" height="md" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function MessageFeed({ narrow }: MessageFeedProps): React.JSX.Element {
  const window = useFeedWindow(narrow);

  // The message cache, subscribed so the feed re-renders when bodies
  // are ingested / updated. `getMessage` reads from this snapshot.
  const messages = useMessagesStore((store) => store.messages);

  // Resolve the ordered id list to bodies and derive the render rows.
  // An id whose body is not yet cached is skipped — a transient state
  // the next store update resolves. Recomputed only when the id list
  // or the cache changes.
  const rows = useMemo(() => {
    const resolved: Message[] = [];
    for (const id of window.orderedIds) {
      const message = messages[id];
      if (message !== undefined) {
        resolved.push(message);
      }
    }
    return buildFeedRows(resolved);
  }, [window.orderedIds, messages]);

  const getMessage = (messageId: number): Message | undefined =>
    messages[messageId];

  // A stable per-narrow identity for the "open at the bottom" jump.
  const scrollAnchorKey = useMemo(() => narrowToPath(narrow), [narrow]);

  if (window.status === "loading" || window.status === "idle") {
    return (
      <div className={styles.feed}>
        <LoadingState />
        <ComposeBox narrow={narrow} />
      </div>
    );
  }

  if (window.status === "error") {
    return (
      <div className={styles.feed}>
        <div className={styles.notice}>
          <Banner
            tone="danger"
            title="Couldn't load messages"
            onDismiss={undefined}
          >
            {window.error ?? "Something went wrong fetching this view."}{" "}
            <button
              type="button"
              className={styles.retryButton}
              onClick={window.retry}
            >
              Try again
            </button>
          </Banner>
        </div>
        <ComposeBox narrow={narrow} />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className={styles.feed}>
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>No messages here yet</p>
          <p className={styles.emptyHint}>
            Messages sent to this view will show up here.
          </p>
        </div>
        <ComposeBox narrow={narrow} />
      </div>
    );
  }

  return (
    <div className={styles.feed}>
      <MarkAsReadButton narrow={narrow} />
      {window.historyLimited && (
        <div className={styles.notice}>
          <Banner tone="info">
            Older message history isn't available on this plan.
          </Banner>
        </div>
      )}
      <MessageList
        rows={rows}
        getMessage={getMessage}
        hasOlder={!window.foundOldest}
        hasNewer={!window.foundNewest}
        loadingOlder={window.loadingOlder}
        loadingNewer={window.loadingNewer}
        onLoadOlder={window.loadOlder}
        onLoadNewer={window.loadNewer}
        scrollAnchorKey={scrollAnchorKey}
      />
      <ComposeBox narrow={narrow} />
    </div>
  );
}
