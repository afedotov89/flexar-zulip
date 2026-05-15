// Flexar Hub Web — feed message row (Phase 1.6 + 3.2 + 3.3).
//
// One message in the feed. Two layouts, chosen by `isGroupStart`:
//
//   - group start  — the full header: avatar, sender name, timestamp,
//                     then the content.
//   - group follower — a collapsed row: no avatar / name, content
//                     aligned under the group's content column, with
//                     the timestamp revealed only on hover (the
//                     conventional chat-grouping treatment).
//
// Every row carries a hover toolbar of action controls (react, reply,
// more). Phase 3.2 wires the "Add reaction" affordance to the reaction
// picker; Phase 3.3 wires `dots-vertical` to the actions
// `DropdownMenu` (star/unstar, copy link, mark unread, edit, delete).
// The reply control remains a Phase 2 placeholder. The toolbar is in
// the DOM at all times (visually revealed on `:hover` /
// `:focus-within`) so tabbing into it works.
//
// Phase 3.2 also adds a `ReactionsRow` beneath the message body when
// the message has reactions (or a reaction-related error to surface).
// `useReactionToggle` lives on the row (not inside `ReactionsRow`) so
// the same `toggle` callback drives both the chip clicks and the
// hover-toolbar picker — the optimistic update / REST call / error
// handling lives in exactly one place per message.
//
// Phase 3.3 adds inline edit + delete-confirm: the row swaps
// `MessageContent` for `EditMessageForm` while editing (the toolbar /
// menu / reactions row are hidden during edit so focus stays on the
// editor); the delete-confirm `Modal` opens via a state flag.
//
// The row is a focusable `article` in the feed's `log`, so the message
// list is keyboard-navigable item by item with a visible focus ring.
//
// Message *content* is rendered by `MessageContent` — a deliberate
// seam: Phase 1.6 shows plain text, Phase 1.7 swaps in sanitized HTML
// hydration (see `MessageContent`).

import { useCallback, useEffect, useState } from "react";
import { Avatar } from "../../components/Avatar";
import { IconButton } from "../../components/IconButton";
import type { EmojiIdentity, Message } from "../../domain";
import { useAuthStore } from "../../stores/authStore";
import {
  DeleteConfirmModal,
  EditMessageForm,
  MessageActionsMenu,
} from "../messageActions";
import {
  ReactionPickerButton,
  ReactionsRow,
  useReactionToggle,
} from "../reactions";
import { MessageContent } from "./MessageContent";
import { formatMessageTime } from "./formatting";
import styles from "./MessageRow.module.css";

export interface MessageRowProps {
  /** The message to render. */
  message: Message;
  /**
   * Whether this row starts a new sender-group (full header) or is a
   * collapsed follower (content only, time on hover).
   */
  isGroupStart: boolean;
}

interface HoverActionsProps {
  /** The message the toolbar acts on. */
  message: Message;
  /** Signed-in user's id, or `undefined` when the server did not report it. */
  viewerId: number | undefined;
  /** Picker handler — opens the reaction picker and adds the picked emoji. */
  onPickReaction: (identity: EmojiIdentity) => void;
  /** Switch the row into inline-edit mode. */
  onEditRequested: () => void;
  /** Open the delete confirmation modal. */
  onDeleteRequested: () => void;
  /** Surface a transient error from a menu action. */
  onActionError: (message: string) => void;
  /** Surface a transient success notice from a menu action. */
  onActionNotice: (message: string) => void;
}

// The hover toolbar. The reply control remains a Phase 2 placeholder
// (no-op handler); the "Add reaction" control is wired in Phase 3.2,
// the actions dropdown ("More actions") in Phase 3.3. Controls are
// real, labelled, and keyboard-reachable.
function HoverActions({
  message,
  viewerId,
  onPickReaction,
  onEditRequested,
  onDeleteRequested,
  onActionError,
  onActionNotice,
}: HoverActionsProps): React.JSX.Element {
  return (
    <div className={styles.actions}>
      <ReactionPickerButton variant="toolbar" onPick={onPickReaction} />
      <IconButton
        icon="paperclip"
        size="sm"
        variant="ghost"
        aria-label="Reply in thread"
        onClick={() => {
          // Phase 2: start a reply.
        }}
      />
      <MessageActionsMenu
        message={message}
        viewerId={viewerId}
        onEditRequested={onEditRequested}
        onDeleteRequested={onDeleteRequested}
        onActionError={onActionError}
        onActionNotice={onActionNotice}
      />
    </div>
  );
}

export function MessageRow({
  message,
  isGroupStart,
}: MessageRowProps): React.JSX.Element {
  const time = formatMessageTime(message.timestamp);
  const rowClass = isGroupStart
    ? styles.row
    : `${styles.row} ${styles.follower}`;

  const viewerId = useAuthStore((state) => state.session?.userId);
  const { toggle, errorMessage } = useReactionToggle(message.id);

  const [isEditing, setIsEditing] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Auto-clear transient notices ("Link copied") after a short delay so
  // they don't linger; errors stick until replaced by another action.
  useEffect(() => {
    if (actionNotice === null) {
      return;
    }
    const id = window.setTimeout(() => {
      setActionNotice(null);
    }, 2000);
    return () => {
      window.clearTimeout(id);
    };
  }, [actionNotice]);

  // The toolbar's picker may pick an emoji the viewer already reacted
  // with — honour it as a toggle (remove), matching the chip-row's
  // picker handler in `ReactionsRow`.
  const handleToolbarPick = useCallback(
    (identity: EmojiIdentity) => {
      const existing = message.reactions.find(
        (reaction) =>
          reaction.user_id === viewerId &&
          reaction.reaction_type === identity.reaction_type &&
          reaction.emoji_code === identity.emoji_code,
      );
      void toggle(identity, existing !== undefined);
    },
    [message.reactions, toggle, viewerId],
  );

  const handleEditRequested = useCallback(() => {
    setActionError(null);
    setActionNotice(null);
    setIsEditing(true);
  }, []);

  const handleDeleteRequested = useCallback(() => {
    setActionError(null);
    setActionNotice(null);
    setIsDeleteOpen(true);
  }, []);

  const handleActionError = useCallback((message: string) => {
    setActionNotice(null);
    setActionError(message);
  }, []);

  const handleActionNotice = useCallback((message: string) => {
    setActionError(null);
    setActionNotice(message);
  }, []);

  return (
    <article
      className={rowClass}
      tabIndex={0}
      aria-label={`Message from ${message.sender_full_name}`}
    >
      <div className={styles.gutter}>
        {isGroupStart ? (
          <Avatar
            src={message.avatar_url ?? undefined}
            name={message.sender_full_name}
            size="md"
          />
        ) : (
          // Follower rows keep the gutter width but show the timestamp
          // only on hover, where the avatar would otherwise sit.
          <span className={styles.followerTime} aria-hidden="true">
            {time}
          </span>
        )}
      </div>

      <div className={styles.body}>
        {isGroupStart && (
          <div className={styles.header}>
            <span className={styles.sender}>{message.sender_full_name}</span>
            <time className={styles.time}>{time}</time>
          </div>
        )}
        {isEditing ? (
          <EditMessageForm
            message={message}
            onClose={() => setIsEditing(false)}
          />
        ) : (
          <>
            <MessageContent content={message.content} />
            <ReactionsRow
              message={message}
              viewerId={viewerId}
              toggle={toggle}
              errorMessage={errorMessage}
            />
            {actionError !== null && (
              <p className={styles.actionError} role="alert">
                {actionError}
              </p>
            )}
            {actionNotice !== null && (
              <p className={styles.actionNotice} role="status">
                {actionNotice}
              </p>
            )}
          </>
        )}
      </div>

      {!isEditing && (
        <HoverActions
          message={message}
          viewerId={viewerId}
          onPickReaction={handleToolbarPick}
          onEditRequested={handleEditRequested}
          onDeleteRequested={handleDeleteRequested}
          onActionError={handleActionError}
          onActionNotice={handleActionNotice}
        />
      )}

      <DeleteConfirmModal
        open={isDeleteOpen}
        message={message}
        onClose={() => setIsDeleteOpen(false)}
      />
    </article>
  );
}
