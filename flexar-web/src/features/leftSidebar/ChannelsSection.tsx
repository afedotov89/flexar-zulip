// The Channels section of the left sidebar (Phase 1.5, completed in
// 1.5a).
//
// Lists the viewer's subscribed channels (`streamsStore.subscriptions`),
// pinned channels first, then alphabetical. Each channel renders as a
// `ChannelRow` with its full topic list nested underneath (lazily
// loaded by the row from `topicsStore` when expanded). A per-channel
// collapse state lives here (a set of expanded channel ids); the filter
// query is passed down from the sidebar and matches channel names.
//
// The section header carries a `⋮` more-menu trigger (not `+` —
// `+` reads as "create directly" but this opens a dropdown). The
// menu has two actions:
//   - "Создать канал" — opens `CreateChannelModal` directly. Prior
//     wiring jumped to /channels list with another button-click
//     required, which the owner flagged as wrong UX (one menu pick
//     should reach the modal, same pattern as Slack / Discord
//     channel-create).
//   - "Все каналы" — navigates to /channels (browse + subscribe).
//     Kept as a menu item because there is no other entry point.

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { StreamId, Subscription } from "../../domain";
import { narrowToPath, useCurrentNarrow } from "../../lib/narrow";
import { useStreamsStore } from "../../stores/streamsStore";
import { useUnreadStore } from "../../stores/unreadStore";
import { DropdownMenu } from "../../components/DropdownMenu";
import { IconButton } from "../../components/IconButton";
import { CreateChannelModal } from "../../pages/Channels/CreateChannelModal";
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
  const getChannelUnread = useUnreadStore((s) => s.getChannelUnread);
  const currentNarrow = useCurrentNarrow();
  const navigate = useNavigate();
  // Modal opens directly from the "+" menu's "Создать канал" item.
  // Mounting here keeps the affordance local to the sidebar section
  // that triggers it; closing routes through `onClose` so a created
  // channel doesn't auto-navigate (the realtime `subscription` event
  // adds it to the sidebar by itself).
  const [createOpen, setCreateOpen] = useState(false);

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

  // Auto-expand the current channel on navigation. If the user is in
  // a channel (or any of its topics) but has previously collapsed it,
  // the row would render with no topic siblings visible — they
  // couldn't see where they are or jump to a neighbouring topic
  // without first clicking the chevron. Reset the collapsed flag
  // whenever the current channel changes. The user is still free to
  // collapse the current channel manually afterward; the auto-expand
  // only fires on the navigation transition.
  const currentChannelId: StreamId | undefined = currentNarrow?.find(
    (term) => term.operator === "channel" || term.operator === "stream",
  )?.operand as StreamId | undefined;
  useEffect(() => {
    if (currentChannelId === undefined) {
      return;
    }
    setCollapsedChannels((prev) => {
      if (!prev.has(currentChannelId)) {
        return prev;
      }
      const next = new Set(prev);
      next.delete(currentChannelId);
      return next;
    });
  }, [currentChannelId]);

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
    <DropdownMenu
      placement="bottom"
      aria-label="Добавить канал"
      items={[
        {
          id: "create",
          label: "Создать канал",
          icon: "plus",
          onSelect: () => setCreateOpen(true),
        },
        {
          id: "browse",
          label: "Все каналы",
          icon: "hash",
          onSelect: () => void navigate("/channels"),
        },
      ]}
      trigger={
        <IconButton
          icon="dots-vertical"
          size="sm"
          variant="ghost"
          aria-label="Действия с каналами"
        />
      }
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
          return (
            <ChannelRow
              key={streamId}
              subscription={subscription}
              channelUnread={getChannelUnread(streamId)}
              expanded={!collapsedChannels.has(streamId)}
              onToggle={toggleChannel}
              currentPath={currentPath}
            />
          );
        })
      )}
      <CreateChannelModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
    </SidebarSection>
  );
}
