// Flexar Hub Web — feed message row (Phase 1.6 + 3.2).
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
// picker; the other buttons remain Phase 2 placeholders for now. The
// toolbar is in the DOM at all times (visually revealed on `:hover` /
// `:focus-within`) so tabbing into it works.
//
// Phase 3.2 also adds a `ReactionsRow` beneath the message body when
// the message has reactions (or a reaction-related error to surface).
// `useReactionToggle` lives on the row (not inside `ReactionsRow`) so
// the same `toggle` callback drives both the chip clicks and the
// hover-toolbar picker — the optimistic update / REST call / error
// handling lives in exactly one place per message.
//
// The row is a focusable `article` in the feed's `log`, so the message
// list is keyboard-navigable item by item with a visible focus ring.
//
// Message *content* is rendered by `MessageContent` — a deliberate
// seam: Phase 1.6 shows plain text, Phase 1.7 swaps in sanitized HTML
// hydration (see `MessageContent`).

import { useCallback } from "react";
import { Avatar } from "../../components/Avatar";
import { IconButton } from "../../components/IconButton";
import type { EmojiIdentity, Message } from "../../domain";
import { useAuthStore } from "../../stores/authStore";
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
  /** Picker handler — opens the reaction picker and adds the picked emoji. */
  onPickReaction: (identity: EmojiIdentity) => void;
}

// The hover toolbar. The reply/more actions remain Phase 2 placeholders
// (no-op handlers); the "Add reaction" control is wired in Phase 3.2.
// Controls are real, labelled, and keyboard-reachable.
function HoverActions({ onPickReaction }: HoverActionsProps): React.JSX.Element {
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
      <IconButton
        icon="dots-vertical"
        size="sm"
        variant="ghost"
        aria-label="More actions"
        onClick={() => {
          // Phase 2: open the message action menu.
        }}
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
        <MessageContent content={message.content} />
        <ReactionsRow
          message={message}
          viewerId={viewerId}
          toggle={toggle}
          errorMessage={errorMessage}
        />
      </div>

      <HoverActions onPickReaction={handleToolbarPick} />
    </article>
  );
}
