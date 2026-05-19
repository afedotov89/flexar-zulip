// "Последние" — the recent-conversations screen.
//
// Lists every conversation the viewer has been part of recently —
// channel topics and DMs alike — sorted by the timestamp of the most
// recent message, newest first. Each row is a Telegram-style chat
// pill: avatar on the left (last sender for channels, the partner
// for DMs), recipient name + topic on the top line, message snippet
// on the second line, relative time on the right. Clicking a row
// navigates the feed into that conversation's narrow.
//
// The avatar-led rhythm is intentionally the same as `MessageRow` in
// the feed — directory and reading view share one visual language so
// the eye doesn't have to re-learn what a row means when the user
// switches between them.
//
// Data: a one-shot `getMessages` fetch on mount (anchor=newest,
// numBefore=100, narrow=[]) — same call the combined feed would
// make, used here to populate the recent-conversations list without
// reaching for a virtualisation hook we don't need on this screen.
// We re-fetch on mount each visit rather than caching: the screen is
// consulted ad-hoc, the data is small, and a stale "last activity
// 3 hours ago" reading on something that just had a new reply would
// feel broken.

import { useEffect, useMemo, useState } from "react";
import { apiClient } from "../../api";
import { Avatar } from "../../components/Avatar";
import { Banner } from "../../components/Banner";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { Icon } from "../../components/Icon";
import { PageHeader } from "../../components/PageHeader";
import { MessageRowsSkeleton } from "../../components/MessageRowsSkeleton";
import type {
  DirectMessageRecipient,
  Message,
  Narrow,
  StreamId,
} from "../../domain";
import { describeApiError } from "../../lib/errors";
import { useNarrowNavigation } from "../../lib/narrow";
import { htmlToPlainText } from "../../lib/renderedContent";
import { useAuthStore } from "../../stores/authStore";
import { useStreamsStore } from "../../stores/streamsStore";
import { useUsersStore } from "../../stores/usersStore";
import styles from "./Recent.module.css";

const FETCH_LIMIT = 100;
const SNIPPET_CHARS = 80;

interface RecentRow {
  /** Unique identity for the row's React key + dedup map. */
  key: string;
  /** Where clicking the row should navigate. */
  narrow: Narrow;
  /**
   * The recipient bar's identity — channel + topic, or DM partner(s).
   * Discriminated so the bar can render the right leading icon
   * (`hash` for channels, `user` for DMs).
   */
  recipient:
    | { kind: "channel"; channelName: string; topic: string }
    | { kind: "dm"; participants: string };
  /** Avatar / sender for the embedded mini-message row. */
  senderName: string;
  senderAvatarUrl: string | undefined;
  /** Was the latest message sent by the viewer? */
  authorIsViewer: boolean;
  /** First line of the latest message, trimmed of HTML markup. */
  snippet: string;
  /** Message timestamp (Unix seconds) — sort key + relative-time source. */
  timestamp: number;
}

function relativeTime(timestamp: number, now: number): string {
  const diffSec = now - timestamp;
  if (diffSec < 60) {
    return "сейчас";
  }
  if (diffSec < 60 * 60) {
    return `${Math.floor(diffSec / 60)} мин`;
  }
  if (diffSec < 60 * 60 * 24) {
    return `${Math.floor(diffSec / (60 * 60))} ч`;
  }
  if (diffSec < 60 * 60 * 24 * 2) {
    return "вчера";
  }
  if (diffSec < 60 * 60 * 24 * 7) {
    return `${Math.floor(diffSec / (60 * 60 * 24))} дн`;
  }
  return new Date(timestamp * 1000).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
  });
}

export function Recent(): React.JSX.Element {
  const [status, setStatus] = useState<
    | { kind: "loading" }
    | { kind: "error"; message: string }
    | { kind: "ready"; messages: readonly Message[] }
  >({ kind: "loading" });
  const ownUserId = useAuthStore((s) => s.session?.userId);
  const subscriptions = useStreamsStore((s) => s.subscriptions);
  const usersMap = useUsersStore((s) => s.users);
  const { goToNarrow } = useNarrowNavigation();

  useEffect(() => {
    let cancelled = false;
    setStatus({ kind: "loading" });
    apiClient
      .getMessages({
        narrow: [],
        anchor: "newest",
        numBefore: FETCH_LIMIT,
        numAfter: 0,
      })
      .then((result) => {
        if (cancelled) {
          return;
        }
        setStatus({ kind: "ready", messages: result.messages });
      })
      .catch((cause) => {
        if (cancelled) {
          return;
        }
        setStatus({
          kind: "error",
          message: describeApiError(
            cause,
            "Не удалось загрузить недавние беседы.",
          ),
        });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const rows: RecentRow[] = useMemo(() => {
    if (status.kind !== "ready") {
      return [];
    }
    // Bucket by conversation: take the latest message per bucket as
    // the row's representative. The fetch returns messages id-desc,
    // so the FIRST time we see a bucket is the latest message — no
    // timestamp compare needed.
    const seen = new Map<string, RecentRow>();
    for (const message of status.messages) {
      let key: string;
      let narrow: Narrow;
      let recipient: RecentRow["recipient"];
      if (message.type === "stream" && message.stream_id !== undefined) {
        const streamId = message.stream_id as StreamId;
        const topicName = message.subject;
        key = `stream:${streamId}:${topicName}`;
        narrow = [
          { operator: "channel", operand: streamId },
          { operator: "topic", operand: topicName },
        ];
        recipient = {
          kind: "channel",
          channelName: subscriptions[streamId]?.name ?? `Канал ${streamId}`,
          topic: topicName === "" ? "(без темы)" : topicName,
        };
      } else if (Array.isArray(message.display_recipient)) {
        const ids = (message.display_recipient as DirectMessageRecipient[])
          .map((r) => r.id)
          .filter((id): id is number => typeof id === "number")
          .sort((a, b) => a - b);
        key = `dm:${ids.join(",")}`;
        narrow = [{ operator: "dm", operand: ids }];
        const others =
          ownUserId === undefined
            ? ids
            : ids.filter((id) => id !== ownUserId);
        const namedOthers = others.map(
          (id) => usersMap[id]?.full_name ?? `Пользователь ${id}`,
        );
        recipient = {
          kind: "dm",
          participants:
            namedOthers.length === 0
              ? "Личная беседа"
              : namedOthers.join(", "),
        };
      } else {
        continue;
      }
      if (seen.has(key)) {
        continue;
      }
      const sender = usersMap[message.sender_id];
      seen.set(key, {
        key,
        narrow,
        recipient,
        senderName: message.sender_full_name,
        senderAvatarUrl:
          message.avatar_url ?? sender?.avatar_url ?? undefined,
        authorIsViewer:
          ownUserId !== undefined && message.sender_id === ownUserId,
        snippet: htmlToPlainText(message.content, {
          maxLength: SNIPPET_CHARS,
        }),
        timestamp: message.timestamp,
      });
    }
    // Within `seen` the insertion order is already newest-first
    // because the fetch returns id-desc, but be explicit so a future
    // bucket-merge change can't quietly reverse it.
    return Array.from(seen.values()).sort(
      (a, b) => b.timestamp - a.timestamp,
    );
  }, [status, subscriptions, usersMap, ownUserId]);

  if (status.kind === "loading") {
    return (
      <div className={styles.page}>
        <PageHeader icon="recent" title="Последние" />
        <MessageRowsSkeleton />
      </div>
    );
  }

  if (status.kind === "error") {
    return (
      <div className={styles.page}>
        <PageHeader icon="recent" title="Последние" />
        <Banner tone="danger">{status.message}</Banner>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className={styles.page}>
        <PageHeader icon="recent" title="Последние" />
        <EmptyState
          icon="recent"
          title="Пока ничего нет"
          description="Когда в каналах или личных беседах появятся сообщения, они попадут сюда."
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => goToNarrow([])}
            >
              Открыть общую ленту
            </Button>
          }
        />
      </div>
    );
  }

  const now = Math.floor(Date.now() / 1000);

  return (
    <div className={styles.page}>
      <PageHeader icon="recent" title="Последние" />
      <ul className={styles.list}>
        {rows.map((row) => (
          <li key={row.key} className={styles.row}>
            <button
              type="button"
              className={styles.rowButton}
              onClick={() => goToNarrow(row.narrow)}
            >
              {/* Recipient bar — matches the message-feed's
                  RecipientBar appearance (same icon + name +
                  topic vocabulary, same surface-raised band). */}
              <div className={styles.bar}>
                {row.recipient.kind === "channel" ? (
                  <>
                    <Icon
                      name="hash"
                      size="sm"
                      className={styles.barIcon}
                    />
                    <span className={styles.barName}>
                      {row.recipient.channelName}
                    </span>
                    <span className={styles.barSeparator} aria-hidden="true">
                      ›
                    </span>
                    <span className={styles.barTopic}>
                      {row.recipient.topic}
                    </span>
                  </>
                ) : (
                  <>
                    <Icon
                      name="user"
                      size="sm"
                      className={styles.barIcon}
                    />
                    <span className={styles.barName}>
                      {row.recipient.participants}
                    </span>
                  </>
                )}
              </div>
              {/* Mini message-row — same `gutter | body` rhythm as
                  feed's MessageRow: avatar in a fixed gutter,
                  sender + time header, snippet underneath. */}
              <div className={styles.messageRow}>
                <span className={styles.gutter}>
                  <Avatar
                    size="md"
                    name={row.senderName}
                    src={row.senderAvatarUrl}
                  />
                </span>
                <div className={styles.messageBody}>
                  <div className={styles.messageHeader}>
                    <span className={styles.sender}>
                      {row.authorIsViewer ? "Я" : row.senderName}
                    </span>
                    <time className={styles.time}>
                      {relativeTime(row.timestamp, now)}
                    </time>
                  </div>
                  <div className={styles.snippet}>{row.snippet}</div>
                </div>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
