// "Новые" — the unread-overview screen.
//
// Renders every unread conversation the viewer has, grouped into two
// sections: direct messages first (compact, no nesting), then channels
// (each channel a header with its unread topic rows nested under it).
// Clicking a conversation navigates the feed to that conversation's
// narrow. Picks the data straight from `useUnreadStore.unread` — no
// new fetch needed; the same buckets the sidebar counters already
// read from.
//
// Sort order:
//   - DMs: alphabetical by displayed name.
//   - Channels: pinned channels first (matching sidebar order), then
//     alphabetical by channel name.
//   - Topics within a channel: alphabetical.
//
// The empty state ("Всё прочитано") covers the daily-driver target —
// most users will hit zero from time to time and the screen should
// look intentional rather than blank.

import { useMemo } from "react";
import { Avatar } from "../../components/Avatar";
import { EmptyState } from "../../components/EmptyState";
import { Icon } from "../../components/Icon";
import { PageHeader } from "../../components/PageHeader";
import type { Narrow, StreamId } from "../../domain";
import { useNarrowNavigation } from "../../lib/narrow";
import { useAuthStore } from "../../stores/authStore";
import { useStreamsStore } from "../../stores/streamsStore";
import { useUnreadStore } from "../../stores/unreadStore";
import { useUsersStore } from "../../stores/usersStore";
import styles from "./Inbox.module.css";

interface InboxDmRow {
  conversationKey: string;
  participantIds: number[];
  label: string;
  count: number;
  /** The (first) other-participant — drives the row's avatar so DM
   *  rows read with the same identity hook as `MessageRow` and the
   *  `Recent` page. `undefined` if the user isn't in the cache yet. */
  avatarName: string;
  avatarSrc: string | undefined;
}

interface InboxTopicRow {
  topic: string;
  count: number;
}

interface InboxChannelGroup {
  streamId: StreamId;
  name: string;
  total: number;
  topics: InboxTopicRow[];
  /** Channel-color accent for the row's left swatch. */
  color: string | undefined;
  pinned: boolean;
}

function parseDmKey(key: string): number[] {
  return key
    .split(",")
    .map((part) => Number.parseInt(part, 10))
    .filter((n) => Number.isFinite(n));
}

function countSet(set: Record<number, true> | undefined): number {
  return set === undefined ? 0 : Object.keys(set).length;
}

export function Inbox(): React.JSX.Element {
  // Subscribe to the underlying maps so a hydration / event lands a
  // re-render. (Just selecting `unread` works the same — `set()` in
  // the reducer always returns a fresh `UnreadBuckets`.)
  const buckets = useUnreadStore((s) => s.unread);
  const usersMap = useUsersStore((s) => s.users);
  const subscriptions = useStreamsStore((s) => s.subscriptions);
  const ownUserId = useAuthStore((s) => s.session?.userId);
  const { goToNarrow } = useNarrowNavigation();

  const dms: InboxDmRow[] = useMemo(() => {
    const rows: InboxDmRow[] = [];
    for (const [key, set] of Object.entries(buckets.dms)) {
      const count = countSet(set);
      if (count === 0) {
        continue;
      }
      const participantIds = parseDmKey(key);
      // Build a readable label from the OTHER participants — the
      // viewer is part of the key but their own name would be noise
      // in the row. With a single other participant we get their
      // name; group DMs concatenate names with a comma. Unknown ids
      // fall back to "Пользователь N".
      const others =
        ownUserId === undefined
          ? participantIds
          : participantIds.filter((id) => id !== ownUserId);
      const names = others.map(
        (id) => usersMap[id]?.full_name ?? `Пользователь ${id}`,
      );
      // Avatar: the first "other" participant. For 1:1 chats that's
      // the only counterpart; for group DMs we pick whoever sorts
      // first in the id-ascending key. The label is the same set of
      // names so the visual identity matches the text.
      const partnerId = others[0];
      const partner =
        partnerId !== undefined ? usersMap[partnerId] : undefined;
      rows.push({
        conversationKey: key,
        participantIds,
        label: names.join(", "),
        count,
        avatarName: partner?.full_name ?? (names.join(", ") || "?"),
        avatarSrc: partner?.avatar_url ?? undefined,
      });
    }
    rows.sort((a, b) => a.label.localeCompare(b.label));
    return rows;
  }, [buckets.dms, usersMap, ownUserId]);

  const channels: InboxChannelGroup[] = useMemo(() => {
    const groups: InboxChannelGroup[] = [];
    for (const [streamIdStr, topicsMap] of Object.entries(buckets.channels)) {
      const streamId = Number(streamIdStr) as StreamId;
      const topicRows: InboxTopicRow[] = [];
      let total = 0;
      for (const [topic, set] of Object.entries(topicsMap)) {
        const count = countSet(set);
        if (count === 0) {
          continue;
        }
        topicRows.push({ topic, count });
        total += count;
      }
      if (topicRows.length === 0) {
        continue;
      }
      topicRows.sort((a, b) => a.topic.localeCompare(b.topic));
      const subscription = subscriptions[streamId];
      groups.push({
        streamId,
        name: subscription?.name ?? `Канал ${streamId}`,
        total,
        topics: topicRows,
        color: subscription?.color,
        pinned: subscription?.pin_to_top ?? false,
      });
    }
    // Pinned channels first, then alphabetical — same convention as
    // the sidebar so a user's mental map of "where is X" carries over
    // between the inbox screen and the sidebar tree.
    groups.sort((a, b) => {
      if (a.pinned !== b.pinned) {
        return a.pinned ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
    return groups;
  }, [buckets.channels, subscriptions]);

  if (dms.length === 0 && channels.length === 0) {
    return (
      <div className={styles.page}>
        <PageHeader icon="inbox" title="Новые" />
        <EmptyState
          icon="inbox"
          title="Всё прочитано"
          description="Когда придёт новое сообщение, оно появится здесь."
        />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <PageHeader icon="inbox" title="Новые" />
      <div className={styles.body}>

      {dms.length > 0 && (
        <section className={styles.section} aria-labelledby="inbox-dms">
          <h2 id="inbox-dms" className={styles.sectionHeading}>
            Личные сообщения
          </h2>
          <ul className={styles.list}>
            {dms.map((dm) => {
              const narrow: Narrow = [
                { operator: "dm", operand: dm.participantIds },
              ];
              return (
                <li key={dm.conversationKey} className={styles.dmRow}>
                  <button
                    type="button"
                    className={styles.rowButton}
                    onClick={() => goToNarrow(narrow)}
                  >
                    <Avatar
                      size="sm"
                      name={dm.avatarName}
                      src={dm.avatarSrc}
                    />
                    <span className={styles.rowLabel}>{dm.label}</span>
                    <span className={styles.badge}>{dm.count}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {channels.length > 0 && (
        <section className={styles.section} aria-labelledby="inbox-channels">
          <h2 id="inbox-channels" className={styles.sectionHeading}>
            Каналы
          </h2>
          <ul className={styles.channelList}>
            {channels.map((channel) => (
              <li key={channel.streamId} className={styles.channelGroup}>
                <button
                  type="button"
                  className={styles.channelHeader}
                  onClick={() =>
                    goToNarrow([
                      { operator: "channel", operand: channel.streamId },
                    ])
                  }
                >
                  <span
                    className={styles.channelSwatch}
                    // Channel color is data-driven; expose it as a CSS
                    // custom property via inline style (the only
                    // sanctioned escape from token-only styling here,
                    // matching how NavRow exposes `--nav-row-accent`).
                    ref={(node) => {
                      if (node !== null) {
                        node.style.setProperty(
                          "--inbox-channel-swatch",
                          channel.color ?? "transparent",
                        );
                      }
                    }}
                    aria-hidden="true"
                  />
                  <Icon name="hash" size="sm" className={styles.leadingIcon} />
                  <span className={styles.rowLabel}>{channel.name}</span>
                  <span className={styles.badge}>{channel.total}</span>
                </button>
                <ul className={styles.topicList}>
                  {channel.topics.map((topic) => {
                    const topicLabel =
                      topic.topic === "" ? "(без темы)" : topic.topic;
                    return (
                      <li key={topic.topic} className={styles.topicRow}>
                        <button
                          type="button"
                          className={styles.rowButton}
                          onClick={() =>
                            goToNarrow([
                              {
                                operator: "channel",
                                operand: channel.streamId,
                              },
                              { operator: "topic", operand: topic.topic },
                            ])
                          }
                        >
                          <span className={styles.topicIndent} aria-hidden="true" />
                          <span className={styles.rowLabel}>{topicLabel}</span>
                          <span className={styles.badge}>{topic.count}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      )}
      </div>
    </div>
  );
}
