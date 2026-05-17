// "Последние" — the recent-conversations screen.
//
// Lists every conversation the viewer has been part of recently —
// channel topics and DMs alike — sorted by the timestamp of the
// most recent message, newest first. Each row shows the recipient,
// the latest message's sender + snippet, and a short relative time
// ("сейчас" / "5 м" / "вчера" / dated). Clicking a row navigates the
// feed into that conversation's narrow.
//
// Data: a one-shot `getMessages` fetch on mount (anchor=newest,
// numBefore=100, narrow=[]) — same call the combined feed would
// make, used here to populate the recent-conversations list without
// reaching for a virtualisation hook we don't need on this screen.
// 100 messages is enough to fill a screen for active orgs without
// fetching pages the user won't scroll to.
//
// We re-fetch on mount each visit rather than caching: the screen
// is consulted ad-hoc, the data is small, and a stale "last activity
// 3 hours ago" reading on something that just had a new reply would
// feel broken.

import { useEffect, useMemo, useState } from "react";
import { apiClient } from "../../api";
import { Banner } from "../../components/Banner";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { Icon } from "../../components/Icon";
import { Spinner } from "../../components/Spinner";
import type {
  DirectMessageRecipient,
  Message,
  Narrow,
  StreamId,
} from "../../domain";
import { describeApiError } from "../../lib/errors";
import { useNarrowNavigation } from "../../lib/narrow";
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
  /** Icon for the leading slot. */
  iconName: "hash" | "user";
  /** Primary line: channel name + topic, or DM partner names. */
  primary: string;
  /** Optional secondary segment for topics: shown after a chevron. */
  secondary?: string;
  /** Latest message's author. */
  author: string;
  /** First line of the latest message, trimmed of HTML markup. */
  snippet: string;
  /** Message timestamp (Unix seconds) — sort key + relative-time source. */
  timestamp: number;
}

function rawTextFromHtml(html: string): string {
  // Quick-and-dirty plain-text extraction: drop tags, decode a small
  // set of common entities, collapse whitespace. Good enough for a
  // one-line preview; we're not trying to reproduce the renderer.
  const stripped = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
  if (stripped.length <= SNIPPET_CHARS) {
    return stripped;
  }
  return stripped.slice(0, SNIPPET_CHARS - 1) + "…";
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
      let iconName: "hash" | "user";
      let primary: string;
      let secondary: string | undefined;
      if (message.type === "stream" && message.stream_id !== undefined) {
        const streamId = message.stream_id as StreamId;
        const topic = message.subject;
        key = `stream:${streamId}:${topic}`;
        narrow = [
          { operator: "channel", operand: streamId },
          { operator: "topic", operand: topic },
        ];
        iconName = "hash";
        primary =
          subscriptions[streamId]?.name ?? `Канал ${streamId}`;
        secondary = topic === "" ? "(без темы)" : topic;
      } else if (Array.isArray(message.display_recipient)) {
        const ids = (message.display_recipient as DirectMessageRecipient[])
          .map((r) => r.id)
          .filter((id): id is number => typeof id === "number")
          .sort((a, b) => a - b);
        key = `dm:${ids.join(",")}`;
        narrow = [{ operator: "dm", operand: ids }];
        iconName = "user";
        const names = ids.map(
          (id) => usersMap[id]?.full_name ?? `Пользователь ${id}`,
        );
        primary = names.join(", ") || "Личная беседа";
      } else {
        continue;
      }
      if (seen.has(key)) {
        continue;
      }
      seen.set(key, {
        key,
        narrow,
        iconName,
        primary,
        secondary,
        author: message.sender_full_name,
        snippet: rawTextFromHtml(message.content),
        timestamp: message.timestamp,
      });
    }
    // Within `seen` the insertion order is already newest-first
    // because the fetch returns id-desc, but be explicit so a future
    // bucket-merge change can't quietly reverse it.
    return Array.from(seen.values()).sort(
      (a, b) => b.timestamp - a.timestamp,
    );
  }, [status, subscriptions, usersMap]);

  if (status.kind === "loading") {
    return (
      <div className={styles.page}>
        <h1 className={styles.heading}>Последние</h1>
        <div className={styles.loading}>
          <Spinner size="md" aria-label="Загрузка недавних бесед" />
        </div>
      </div>
    );
  }

  if (status.kind === "error") {
    return (
      <div className={styles.page}>
        <h1 className={styles.heading}>Последние</h1>
        <Banner tone="danger">{status.message}</Banner>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className={styles.page}>
        <h1 className={styles.heading}>Последние</h1>
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
      <h1 className={styles.heading}>Последние</h1>
      <ul className={styles.list}>
        {rows.map((row) => (
          <li key={row.key} className={styles.row}>
            <button
              type="button"
              className={styles.rowButton}
              onClick={() => goToNarrow(row.narrow)}
            >
              <Icon
                name={row.iconName}
                size="sm"
                className={styles.leadingIcon}
              />
              <div className={styles.body}>
                <div className={styles.titleLine}>
                  <span className={styles.primary}>{row.primary}</span>
                  {row.secondary !== undefined && (
                    <>
                      <span className={styles.separator} aria-hidden="true">
                        ›
                      </span>
                      <span className={styles.secondary}>{row.secondary}</span>
                    </>
                  )}
                </div>
                <div className={styles.snippetLine}>
                  <span className={styles.author}>{row.author}:</span>{" "}
                  <span className={styles.snippet}>{row.snippet}</span>
                </div>
              </div>
              <span className={styles.time}>
                {relativeTime(row.timestamp, now)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
