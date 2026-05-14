// The Direct messages section of the left sidebar (Phase 1.5).
//
// Lists the viewer's DM conversations as navigation rows: participant
// avatar + name(s), an unread badge, and a presence dot for one-on-one
// chats. Clicking a row navigates to that DM's narrow.
//
// ── DM conversation data source ─────────────────────────────────────
//
// There is no store of "my DM conversations" yet. The cleanest source
// available offline is the bucketed unread store: its DM buckets
// (`getDmConversationKeys`) enumerate every conversation that currently
// has unread messages. That is a *partial* list — a DM with no unreads
// will not appear — so this section also flags (in HANDOFF) that a
// proper `dmConversationsStore` is needed for the complete, recency-
// ordered list. When there are no unread DMs the section shows an empty
// state rather than implying the user has no DM history.
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
import { usePresenceStore } from "../../stores/presenceStore";
import { useUnreadStore } from "../../stores/unreadStore";
import {
  dmConversationKeysWithUnread,
  dmUnreadCount,
} from "../../stores/unreadReducer";
import { useUsersStore } from "../../stores/usersStore";
import { Avatar } from "../../components/Avatar";
import { NavRow } from "./NavRow";
import { PresenceDot } from "./PresenceDot";
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

/** Parse a DM conversation key ("2,4,7") into its participant ids. */
function parseConversationKey(key: string): UserId[] {
  return key
    .split(",")
    .map((part) => Number(part))
    .filter((n) => Number.isInteger(n));
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
  // Select the stable buckets object, not a freshly-built array — a
  // selector returning a new array each call would loop the store.
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

  // Build a display model per conversation, sorted by participant
  // names so the list has a stable, readable order. Memoised on the
  // inputs that actually affect it.
  const conversations = useMemo(
    () =>
      dmConversationKeysWithUnread(unread)
        .map((key) => {
          const participantIds = parseConversationKey(key);
          const others = participantIds.filter((id) => id !== ownUserId);
          const displayIds = others.length > 0 ? others : participantIds;
          const names = displayIds.map(
            (id) => getUser(id)?.full_name ?? `User ${id}`,
          );
          const narrow = dmNarrow(participantIds, ownUserId);
          return {
            key,
            displayIds,
            label: names.join(", "),
            path: narrowToPath(narrow),
            unreadCount: dmUnreadCount(unread, key),
          };
        })
        .sort((a, b) => a.label.localeCompare(b.label)),
    [unread, ownUserId, getUser],
  );

  const filtered =
    filterQuery === ""
      ? conversations
      : conversations.filter((c) =>
          c.label.toLowerCase().includes(filterQuery),
        );

  return (
    <SidebarSection
      title="Личные сообщения"
      expanded={expanded}
      onToggle={onToggle}
    >
      {filtered.length === 0 ? (
        <p className={styles.empty}>
          {conversations.length === 0
            ? "Нет непрочитанных личных сообщений"
            : "Ничего не найдено"}
        </p>
      ) : (
        filtered.map((conversation) => {
          // The presence dot is meaningful only for a one-on-one DM.
          const soloOtherId =
            conversation.displayIds.length === 1
              ? conversation.displayIds[0]
              : undefined;
          const firstId = conversation.displayIds[0];
          const firstUser =
            firstId !== undefined ? getUser(firstId) : undefined;
          return (
            <NavRow
              key={conversation.key}
              to={conversation.path}
              label={conversation.label}
              selected={conversation.path === currentDmPath}
              unreadCount={conversation.unreadCount}
              unreadLabel={
                conversation.unreadCount > 0
                  ? `${conversation.unreadCount} непрочитанных`
                  : undefined
              }
              leading={
                <span className={styles.avatarSlot}>
                  <Avatar
                    size="sm"
                    name={conversation.label}
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
