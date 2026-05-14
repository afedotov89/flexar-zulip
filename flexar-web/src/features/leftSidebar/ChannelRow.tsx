// A single channel row in the left sidebar, with its topics (1.5).
//
// The row itself is a `NavRow` to the channel narrow, prefixed by a
// collapse toggle that shows/hides the channel's topic rows. A button
// cannot nest a button, so the toggle and the `NavRow` anchor sit
// side-by-side in a flex container — the same shape `SidebarSection`
// uses for its header.
//
// Topics shown: the sidebar has no full topic list (there is no topics
// store and no topic-list API method wired yet — flagged in HANDOFF).
// What it *can* show reliably is the set of topics that currently have
// unread messages, read from the bucketed unread store. Those are also
// the topics most worth surfacing in a navigation sidebar. A channel
// with no unread topics simply shows no topic rows.
//
// The channel's leading `#` / lock icon is tinted with the viewer's
// per-channel `Subscription.color` — passed to `NavRow` as
// `accentColor`, a data-driven content color (see `NavRow`).

import type { StreamId, Subscription } from "../../domain";
import { narrowToPath } from "../../lib/narrow";
import { Icon } from "../../components/Icon";
import { NavRow } from "./NavRow";
import styles from "./ChannelRow.module.css";

export interface ChannelRowProps {
  /** The viewer's subscription to this channel. */
  subscription: Subscription;
  /** Topics in this channel that currently have unread messages. */
  unreadTopics: ReadonlyArray<{ topic: string; unreadCount: number }>;
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
  unreadTopics,
  channelUnread,
  expanded,
  onToggle,
  currentPath,
}: ChannelRowProps): React.JSX.Element {
  const { stream_id: streamId, name, invite_only: inviteOnly } = subscription;
  const channelPath = narrowToPath([
    { operator: "channel", operand: streamId },
  ]);
  const hasTopics = unreadTopics.length > 0;

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
          disabled={!hasTopics}
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
          selected={channelPath === currentPath}
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

      {expanded &&
        unreadTopics.map(({ topic, unreadCount }) => {
          const topicPath = narrowToPath([
            { operator: "channel", operand: streamId },
            { operator: "topic", operand: topic },
          ]);
          // The server's "general" topic is the empty string; show a
          // readable placeholder rather than a blank row.
          const topicLabel = topic === "" ? "(без темы)" : topic;
          return (
            <NavRow
              key={topic}
              to={topicPath}
              label={topicLabel}
              indent={1}
              selected={topicPath === currentPath}
              unreadCount={unreadCount}
              unreadLabel={
                unreadCount > 0 ? `${unreadCount} непрочитанных` : undefined
              }
            />
          );
        })}
    </div>
  );
}
