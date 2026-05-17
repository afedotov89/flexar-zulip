// A single channel row in the left sidebar, with its topics (Phase 1.5,
// completed in 1.5a).
//
// The row itself is a `NavRow` to the channel narrow, prefixed by a
// collapse toggle that shows/hides the channel's topic rows. A button
// cannot nest a button, so the toggle and the `NavRow` anchor sit
// side-by-side in a flex container — the same shape `SidebarSection`
// uses for its header.
//
// ── Topic list ──────────────────────────────────────────────────────
//
// The full per-channel topic list comes from `topicsStore`, which is
// populated lazily: this row triggers `loadTopics(streamId)` the first
// time it is expanded (and on re-expand after a re-register cleared the
// cache). While the fetch is in flight the row shows a spinner; on
// failure, a short error line. The topics render in the store's
// recency order, each with its unread count overlaid from
// `unreadStore.getTopicUnread`.
//
// The channel's leading `#` / lock icon is tinted with the viewer's
// per-channel `Subscription.color` — passed to `NavRow` as
// `accentColor`, a data-driven content color (see `NavRow`).

import { useEffect } from "react";
import type { StreamId, Subscription } from "../../domain";
import { narrowToPath } from "../../lib/narrow";
import { useTopicsStore } from "../../stores/topicsStore";
import { useUnreadStore } from "../../stores/unreadStore";
import { topicUnreadCount } from "../../stores/unreadReducer";
import { Icon } from "../../components/Icon";
import { Spinner } from "../../components/Spinner";
import { NavRow } from "./NavRow";
import styles from "./ChannelRow.module.css";

export interface ChannelRowProps {
  /** The viewer's subscription to this channel. */
  subscription: Subscription;
  /** This channel's total unread count, across all topics. */
  channelUnread: number;
  /** Whether the channel's topic list is expanded. */
  expanded: boolean;
  /** Toggle this channel's expanded state. */
  onToggle: (streamId: StreamId) => void;
  /** Path of the currently-addressed narrow, for active-row highlight. */
  currentPath: string | undefined;
}

export function ChannelRow({
  subscription,
  channelUnread,
  expanded,
  onToggle,
  currentPath,
}: ChannelRowProps): React.JSX.Element {
  const { stream_id: streamId, name, invite_only: inviteOnly } = subscription;

  const topics = useTopicsStore((s) => s.topicsByChannel[streamId]);
  const loadStatus = useTopicsStore((s) => s.loadStatus[streamId]);
  const loadTopics = useTopicsStore((s) => s.loadTopics);
  // The bucketed unread state — subscribed directly so a per-topic
  // count change re-renders this row. Per-topic counts are derived
  // below with the pure `topicUnreadCount` reducer.
  const unread = useUnreadStore((s) => s.unread);

  // Fetch the channel's topics the first time it is expanded. `loadTopics`
  // is idempotent — an already-loaded or in-flight channel is a no-op —
  // so this is safe to re-run on every expand (e.g. after a re-register
  // cleared the cache).
  useEffect(() => {
    if (expanded) {
      void loadTopics(streamId);
    }
  }, [expanded, streamId, loadTopics]);

  const channelPath = narrowToPath([
    { operator: "channel", operand: streamId },
  ]);

  return (
    <div className={styles.channel}>
      <div className={styles.channelHeader}>
        <button
          type="button"
          className={styles.toggle}
          aria-expanded={expanded}
          aria-label={
            expanded
              ? `Свернуть темы канала ${name}`
              : `Развернуть темы канала ${name}`
          }
          onClick={() => onToggle(streamId)}
        >
          <Icon
            name={expanded ? "chevron-down" : "chevron-right"}
            size="sm"
          />
        </button>
        <NavRow
          to={channelPath}
          label={name}
          // The channel row is "selected" not only when the URL is
          // exactly the channel narrow, but also when it is any
          // topic inside the channel. Without this, navigating to
          // `/narrow/channel/3/topic/X` left the channel row in the
          // sidebar visually identical to every other channel — the
          // tree gave no hint where the user was. Slack / Discord /
          // VS Code all use the same "parent is selected when a
          // child is current" pattern.
          selected={
            channelPath === currentPath ||
            currentPath.startsWith(`${channelPath}/topic/`)
          }
          unreadCount={channelUnread}
          unreadLabel={
            channelUnread > 0 ? `${channelUnread} непрочитанных` : undefined
          }
          accentColor={subscription.color}
          leading={
            <Icon name={inviteOnly ? "lock" : "hash"} size="sm" />
          }
        />
      </div>

      {expanded && (
        <>
          {loadStatus === "loading" && topics === undefined && (
            <p className={styles.topicsStatus}>
              <Spinner size="sm" />
              <span>Загрузка тем…</span>
            </p>
          )}
          {loadStatus === "error" && (
            <p className={styles.topicsStatus}>Не удалось загрузить темы</p>
          )}
          {topics !== undefined && topics.length === 0 && (
            <p className={styles.topicsStatus}>Нет тем</p>
          )}
          {topics?.map((topic) => {
            const topicPath = narrowToPath([
              { operator: "channel", operand: streamId },
              { operator: "topic", operand: topic.name },
            ]);
            // The server's "general" topic is the empty string; show a
            // readable placeholder rather than a blank row.
            const topicLabel = topic.name === "" ? "(без темы)" : topic.name;
            const unreadCount = topicUnreadCount(unread, streamId, topic.name);
            return (
              <NavRow
                key={topic.name}
                to={topicPath}
                label={topicLabel}
                indent={1}
                selected={topicPath === currentPath}
                unreadCount={unreadCount}
                unreadLabel={
                  unreadCount > 0
                    ? `${unreadCount} непрочитанных`
                    : undefined
                }
              />
            );
          })}
        </>
      )}
    </div>
  );
}
