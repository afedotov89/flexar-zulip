// The Direct messages section of the left sidebar (Phase 1.5,
// completed in 1.5a).
//
// Lists the viewer's DM conversations as navigation rows: participant
// avatar + name(s), an unread badge, and a presence dot for one-on-one
// chats. Clicking a row navigates to that DM's narrow.
//
// ── DM conversation data source ─────────────────────────────────────
//
// The full, recency-ordered conversation list comes from
// `dmConversationsStore` (hydrated from the register snapshot's
// `recent_private_conversations`, kept live by DM `message` events).
// Read conversations are included, so a DM with no unreads still
// appears. Unread counts are overlaid from `unreadStore.getDmUnread`,
// keyed by the same `conversationKey`.
//
// A DM conversation key is the sorted, comma-joined participant user
// ids *including* the viewer (see `dmConversationKey`). The narrow for
// the conversation uses the *other* participants, matching how Zulip
// addresses a `dm` narrow; a conversation with oneself narrows to the
// viewer's own id.

import { useMemo } from "react";
import type { Narrow, UserId } from "../../domain";
import { narrowToPath, useCurrentNarrow } from "../../lib/narrow";
import { useAuthStore } from "../../stores/authStore";
import { useDmConversationsStore } from "../../stores/dmConversationsStore";
import { usePresenceStore } from "../../stores/presenceStore";
import { useUnreadStore } from "../../stores/unreadStore";
import { dmUnreadCount } from "../../stores/unreadReducer";
import { useUsersStore } from "../../stores/usersStore";
import { Avatar } from "../../components/Avatar";
import { PresenceDot } from "../../components/PresenceDot";
import { NavRow } from "./NavRow";
import { SidebarSection } from "./SidebarSection";
import styles from "./DirectMessagesSection.module.css";

export interface DirectMessagesSectionProps {
  /** Whether the section is expanded. */
  expanded: boolean;
  /** Toggle the section's expanded state. */
  onToggle: () => void;
  /** Lowercased filter query; empty string means "no filter". */
  filterQuery: string;
}

/** The DM narrow for a conversation: the non-viewer participants. */
function dmNarrow(participantIds: UserId[], ownUserId: UserId | null): Narrow {
  const others = participantIds.filter((id) => id !== ownUserId);
  // A conversation with only oneself narrows to the viewer's own id.
  const operand = others.length > 0 ? others : participantIds;
  return [{ operator: "dm", operand }];
}

export function DirectMessagesSection({
  expanded,
  onToggle,
  filterQuery,
}: DirectMessagesSectionProps): React.JSX.Element {
  // The full recency-ordered conversation list — the stable array, not
  // a freshly-built one, so the selector does not loop the store.
  const conversations = useDmConversationsStore((s) => s.conversations);
  // The bucketed unread state — subscribed directly so a
  // per-conversation count change re-renders this section. Counts are
  // derived per row below with the pure `dmUnreadCount` reducer.
  const unread = useUnreadStore((s) => s.unread);
  const getUser = useUsersStore((s) => s.getUser);
  const getPresence = usePresenceStore((s) => s.getPresence);
  const ownUserId = useAuthStore((s) => s.session?.userId ?? null);
  const currentNarrow = useCurrentNarrow();

  // The path of the currently-addressed DM narrow, if any — used to
  // highlight the active row. Comparing serialised paths avoids a
  // bespoke narrow-equality check here.
  const currentDmPath =
    currentNarrow !== undefined &&
    currentNarrow.length === 1 &&
    currentNarrow[0].operator === "dm"
      ? narrowToPath(currentNarrow)
      : undefined;

  // Build the stable display model per conversation (label, path,
  // participant ids), preserving the store's recency order. The unread
  // count is overlaid at render time, not memoised, so it stays live.
  const rows = useMemo(
    () =>
      conversations.map((conversation) => {
        const { conversationKey, participantIds } = conversation;
        const others = participantIds.filter((id) => id !== ownUserId);
        const displayIds = others.length > 0 ? others : participantIds;
        const names = displayIds.map(
          (id) => getUser(id)?.full_name ?? `User ${id}`,
        );
        const narrow = dmNarrow(participantIds, ownUserId);
        return {
          key: conversationKey,
          displayIds,
          label: names.join(", "),
          path: narrowToPath(narrow),
        };
      }),
    [conversations, ownUserId, getUser],
  );

  const filtered =
    filterQuery === ""
      ? rows
      : rows.filter((row) => row.label.toLowerCase().includes(filterQuery));

  return (
    <SidebarSection
      title="Личные сообщения"
      expanded={expanded}
      onToggle={onToggle}
    >
      {filtered.length === 0 ? (
        <p className={styles.empty}>
          {rows.length === 0
            ? "Нет личных сообщений"
            : "Ничего не найдено"}
        </p>
      ) : (
        filtered.map((row) => {
          // The presence dot is meaningful only for a one-on-one DM.
          const soloOtherId =
            row.displayIds.length === 1 ? row.displayIds[0] : undefined;
          const firstId = row.displayIds[0];
          const firstUser =
            firstId !== undefined ? getUser(firstId) : undefined;
          // The unread count is overlaid live from `unreadStore`.
          const unreadCount = dmUnreadCount(unread, row.key);
          return (
            <NavRow
              key={row.key}
              to={row.path}
              label={row.label}
              selected={row.path === currentDmPath}
              unreadCount={unreadCount}
              unreadLabel={
                unreadCount > 0
                  ? `${unreadCount} непрочитанных`
                  : undefined
              }
              leading={
                <span className={styles.avatarSlot}>
                  <Avatar
                    size="sm"
                    name={row.label}
                    src={firstUser?.avatar_url ?? undefined}
                  />
                  {soloOtherId !== undefined && (
                    <PresenceDot
                      presence={getPresence(soloOtherId)}
                      className={styles.presenceDot}
                    />
                  )}
                </span>
              }
            />
          );
        })
      )}
    </SidebarSection>
  );
}
