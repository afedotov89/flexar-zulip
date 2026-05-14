// Flexar Hub Web — feed message row (Phase 1.6).
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
// more). The *actions themselves* are Phase 2 — the buttons are wired
// to no-ops here — but the hover affordance and layout belong to the
// feed and so are built now. The toolbar is also keyboard-reachable:
// it is in the DOM (not `display:none`), just visually revealed on
// `:hover` / `:focus-within`, so tabbing into it works.
//
// The row is a focusable `article` in the feed's `log`, so the message
// list is keyboard-navigable item by item with a visible focus ring.
//
// Message *content* is rendered by `MessageContent` — a deliberate
// seam: Phase 1.6 shows plain text, Phase 1.7 swaps in sanitized HTML
// hydration (see `MessageContent`).

import { Avatar } from "../../components/Avatar";
import { IconButton } from "../../components/IconButton";
import type { Message } from "../../domain";
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

// The hover toolbar. The actions are Phase 2 — the handlers are no-ops
// for now — but the controls are real, labelled, and keyboard-reachable
// so the layout and affordance are verifiable.
function HoverActions(): React.JSX.Element {
  return (
    <div className={styles.actions}>
      <IconButton
        icon="smile"
        size="sm"
        variant="ghost"
        aria-label="Add reaction"
        onClick={() => {
          // Phase 2: open the emoji picker.
        }}
      />
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
      </div>

      <HoverActions />
    </article>
  );
}
