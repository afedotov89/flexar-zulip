// Flexar Hub Web — feed recipient bar (Phase 1.6).
//
// The sticky header that starts each conversation block in the feed. A
// new bar is emitted (by `buildFeedRows`) whenever the recipient
// changes going down the list:
//
//   - channel block → `# channel › topic` (a lock glyph for private
//     channels; `(no topic)` for the empty-string topic);
//   - DM block      → the other participants' names.
//
// It resolves ids to display data through the Phase 1.3 server-state
// stores (`streamsStore` for the channel, `usersStore` for DM
// participants, `authStore` for the viewer id). When a channel or user
// is not yet in its store the bar degrades to a readable id-based
// label rather than rendering blank.

import { Icon } from "../../components/Icon";
import { useAuthStore } from "../../stores/authStore";
import { useStreamsStore } from "../../stores/streamsStore";
import { useUsersStore } from "../../stores/usersStore";
import type { FeedRecipient } from "./feedItems";
import { formatDmParticipants } from "./formatting";
import styles from "./RecipientBar.module.css";

export interface RecipientBarProps {
  /** The conversation block this bar heads. */
  recipient: FeedRecipient;
}

// Zulip's empty-string topic; shown with a readable placeholder.
const EMPTY_TOPIC_LABEL = "(no topic)";

function ChannelBar({
  streamId,
  topic,
}: {
  streamId: number;
  topic: string;
}): React.JSX.Element {
  const stream = useStreamsStore((store) => store.getStream(streamId));
  const channelName = stream?.name ?? `Channel ${streamId}`;
  const isPrivate = stream?.invite_only ?? false;
  const topicLabel = topic === "" ? EMPTY_TOPIC_LABEL : topic;

  return (
    <>
      <Icon
        name={isPrivate ? "lock" : "hash"}
        size="sm"
        className={styles.channelIcon}
      />
      <span className={styles.channelName}>{channelName}</span>
      <span className={styles.topicSeparator} aria-hidden="true">
        ›
      </span>
      <span className={styles.topic}>{topicLabel}</span>
    </>
  );
}

function DmBar({
  participantIds,
}: {
  participantIds: readonly number[];
}): React.JSX.Element {
  const getUser = useUsersStore((store) => store.getUser);
  const ownUserId = useAuthStore((store) => store.session?.userId);
  const label = formatDmParticipants(participantIds, ownUserId, getUser);

  return (
    <>
      <Icon name="smile" size="sm" className={styles.channelIcon} />
      <span className={styles.channelName}>{label}</span>
    </>
  );
}

export function RecipientBar({
  recipient,
}: RecipientBarProps): React.JSX.Element {
  return (
    <div className={styles.bar}>
      {recipient.type === "channel" ? (
        <ChannelBar streamId={recipient.streamId} topic={recipient.topic} />
      ) : (
        <DmBar participantIds={recipient.participantIds} />
      )}
    </div>
  );
}
