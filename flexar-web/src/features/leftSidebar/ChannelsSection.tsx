// The Channels section of the left sidebar (Phase 1.5).
//
// Lists the viewer's subscribed channels (`streamsStore.subscriptions`),
// pinned channels first, then alphabetical. Each channel renders as a
// `ChannelRow` with its unread topics nested underneath. A per-channel
// collapse state lives here (a set of expanded channel ids); the filter
// query is passed down from the sidebar and matches channel names.
//
// The section header carries the "+" add-channel control. The
// create/browse-channels screen is a later phase, so the button is
// present and operable but its handler is a documented no-op — flagged
// in HANDOFF. It is a real `IconButton` so it has correct focus and
// keyboard behaviour for when the target screen lands.

import { useState } from "react";
import type { StreamId, Subscription } from "../../domain";
import { narrowToPath, useCurrentNarrow } from "../../lib/narrow";
import { useStreamsStore } from "../../stores/streamsStore";
import { useUnreadStore } from "../../stores/unreadStore";
import { IconButton } from "../../components/IconButton";
import { ChannelRow } from "./ChannelRow";
import { SidebarSection } from "./SidebarSection";
import styles from "./ChannelsSection.module.css";

export interface ChannelsSectionProps {
  /** Whether the section is expanded. */
  expanded: boolean;
  /** Toggle the section's expanded state. */
  onToggle: () => void;
  /** Lowercased filter query; empty string means "no filter". */
  filterQuery: string;
}

// Pinned channels sort above unpinned; within each group, by name.
function compareSubscriptions(a: Subscription, b: Subscription): number {
  if (a.pin_to_top !== b.pin_to_top) {
    return a.pin_to_top ? -1 : 1;
  }
  return a.name.localeCompare(b.name);
}

export function ChannelsSection({
  expanded,
  onToggle,
  filterQuery,
}: ChannelsSectionProps): React.JSX.Element {
  const subscriptions = useStreamsStore((s) => s.subscriptions);
  // The raw channel buckets — used to enumerate unread topics per
  // channel. The count selectors derive from the same buckets.
  const channelBuckets = useUnreadStore((s) => s.unread.channels);
  const getChannelUnread = useUnreadStore((s) => s.getChannelUnread);
  const currentNarrow = useCurrentNarrow();

  // Channels start expanded; this set holds the ids the user collapsed.
  const [collapsedChannels, setCollapsedChannels] = useState<Set<StreamId>>(
    () => new Set(),
  );

  function toggleChannel(streamId: StreamId): void {
    setCollapsedChannels((prev) => {
      const next = new Set(prev);
      if (next.has(streamId)) {
        next.delete(streamId);
      } else {
        next.add(streamId);
      }
      return next;
    });
  }

  // The path of the currently-addressed narrow, for active-row
  // highlighting of channel and topic rows.
  const currentPath =
    currentNarrow !== undefined ? narrowToPath(currentNarrow) : undefined;

  const sorted = Object.values(subscriptions).sort(compareSubscriptions);
  const filtered =
    filterQuery === ""
      ? sorted
      : sorted.filter((sub) =>
          sub.name.toLowerCase().includes(filterQuery),
        );

  const addChannelButton = (
    <IconButton
      icon="plus"
      size="sm"
      variant="ghost"
      aria-label="Добавить канал"
      // The create/browse-channels screen is a later phase; this is a
      // deliberate no-op for now (flagged in HANDOFF).
      onClick={() => {}}
    />
  );

  return (
    <SidebarSection
      title="Каналы"
      expanded={expanded}
      onToggle={onToggle}
      headerAction={addChannelButton}
    >
      {filtered.length === 0 ? (
        <p className={styles.empty}>
          {sorted.length === 0
            ? "Нет каналов"
            : "Ничего не найдено"}
        </p>
      ) : (
        filtered.map((subscription) => {
          const streamId = subscription.stream_id;
          const topicsRecord = channelBuckets[streamId] ?? {};
          // Unread topics for this channel, alphabetical for stability.
          const unreadTopics = Object.entries(topicsRecord)
            .map(([topic, ids]) => ({
              topic,
              unreadCount: Object.keys(ids).length,
            }))
            .sort((a, b) => a.topic.localeCompare(b.topic));
          return (
            <ChannelRow
              key={streamId}
              subscription={subscription}
              unreadTopics={unreadTopics}
              channelUnread={getChannelUnread(streamId)}
              expanded={!collapsedChannels.has(streamId)}
              onToggle={toggleChannel}
              currentPath={currentPath}
            />
          );
        })
      )}
    </SidebarSection>
  );
}
