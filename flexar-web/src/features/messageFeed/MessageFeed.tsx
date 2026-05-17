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
//   error    — the initial fetch failed: an `EmptyState` with a retry.
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
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { Skeleton } from "../../components/Skeleton";
import type { Message, Narrow } from "../../domain";
import { narrowToPath } from "../../lib/narrow";
import { useMessagesStore } from "../../stores/messagesStore";
import { ComposeBox } from "../compose";
import { TypingIndicator } from "../typing";
import { MarkAsReadButton } from "./MarkAsReadButton";
import { MessageList } from "./MessageList";
import { NarrowHeader } from "./NarrowHeader";
import { buildFeedRows } from "./feedItems";
import { narrowAddressesSingleConversation } from "./narrowSummary";
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
  //
  // In single-conversation narrows (channel+topic, dm) the persistent
  // NarrowHeader already names the conversation, so emitting the
  // in-flow recipient bar that would duplicate that caption is
  // redundant. Multi-recipient narrows (combined feed, mentions,
  // channel-only) keep their bars — those actually separate distinct
  // conversations being read back-to-back.
  const includeRecipientBars = !narrowAddressesSingleConversation(narrow);
  const rows = useMemo(() => {
    const resolved: Message[] = [];
    for (const id of window.orderedIds) {
      const message = messages[id];
      if (message !== undefined) {
        resolved.push(message);
      }
    }
    return buildFeedRows(resolved, { includeRecipientBars });
  }, [window.orderedIds, messages, includeRecipientBars]);

  const getMessage = (messageId: number): Message | undefined =>
    messages[messageId];

  // A stable per-narrow identity for the "open at the bottom" jump.
  const scrollAnchorKey = useMemo(() => narrowToPath(narrow), [narrow]);

  if (window.status === "loading" || window.status === "idle") {
    return (
      <div className={styles.feed}>
        <NarrowHeader narrow={narrow} />
        <LoadingState />
        <TypingIndicator narrow={narrow} />
        <ComposeBox narrow={narrow} />
      </div>
    );
  }

  if (window.status === "error") {
    return (
      <div className={styles.feed}>
        <NarrowHeader narrow={narrow} />
        <EmptyState
          tone="error"
          icon="error"
          title="Не удалось загрузить сообщения"
          description={window.error ?? "Что-то пошло не так при загрузке."}
          action={
            <Button variant="secondary" size="sm" onClick={window.retry}>
              Попробовать снова
            </Button>
          }
        />
        <TypingIndicator narrow={narrow} />
        <ComposeBox narrow={narrow} />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className={styles.feed}>
        <NarrowHeader narrow={narrow} />
        <EmptyState
          icon="inbox"
          title="Здесь пока нет сообщений"
          description="Сообщения, отправленные в этот вид, появятся здесь."
        />
        <TypingIndicator narrow={narrow} />
        <ComposeBox narrow={narrow} />
      </div>
    );
  }

  return (
    <div className={styles.feed}>
      <NarrowHeader narrow={narrow} />
      <MarkAsReadButton narrow={narrow} />
      {window.historyLimited && (
        <div className={styles.notice}>
          <Banner tone="info">
            Более ранняя история сообщений недоступна на этом тарифе.
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
