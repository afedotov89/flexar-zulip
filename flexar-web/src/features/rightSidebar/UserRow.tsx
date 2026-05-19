// A single person row in the right sidebar's user lists (1.8).
//
// Avatar with an overlaid presence dot, the user's name, status,
// email, plus — for bots and deactivated accounts — a short
// trailing tag. Clicking the row opens a direct-message narrow
// with that user (the standard way to start a 1:1 conversation
// from the directory in Slack / Telegram). Bots and deactivated
// accounts stay non-interactive — DMs to them aren't useful in
// most setups.

import type { Presence, User, UserStatus } from "../../domain";
import { Avatar } from "../../components/Avatar";
import { PresenceDot } from "../../components/PresenceDot";
import { useUserStatusesStore } from "../../stores/userStatusesStore";
import { useAuthStore } from "../../stores/authStore";
import { glyphFromUnicodeEmojiCode } from "../../lib/emoji/identity";
import { useNarrowNavigation } from "../../lib/narrow";
import styles from "./UserRow.module.css";

export interface UserRowProps {
  /** The person to render. */
  user: User;
  /**
   * The user's presence — passed through to the `PresenceDot`, which
   * collapses it to active / idle / offline and labels the dot.
   */
  presence: Presence | undefined;
}

// Russian trailing tags for non-human / inactive accounts.
const BOT_TAG = "бот";
const DEACTIVATED_TAG = "деактивирован";

export function UserRow({ user, presence }: UserRowProps): React.JSX.Element {
  // Deactivation is the stronger signal: a deactivated bot reads as
  // deactivated. A live bot reads as a bot.
  const tag = !user.is_active
    ? DEACTIVATED_TAG
    : user.is_bot
      ? BOT_TAG
      : undefined;

  const status = useUserStatusesStore((s) => s.statuses[user.user_id]);
  const ownUserId = useAuthStore((s) => s.session?.userId);
  const { goToNarrow } = useNarrowNavigation();

  // Clickable for active humans only — bots and deactivated accounts
  // stay as plain rows (DMing a Notification Bot / Email Gateway is
  // not a useful interaction). Self-DMs are allowed (Zulip supports
  // sending a message to yourself as a personal notepad).
  const isDmTarget = user.is_active && !user.is_bot;

  const content = (
    <>
      <span className={styles.avatarSlot}>
        <Avatar
          size="sm"
          name={user.full_name}
          src={user.avatar_url ?? undefined}
        />
        <PresenceDot presence={presence} className={styles.presenceDot} />
      </span>
      <span className={styles.identity}>
        <span className={styles.nameRow}>
          <span className={styles.name}>{user.full_name}</span>
          {status !== undefined && (
            <UserStatusBadge status={status} />
          )}
        </span>
        {status?.status_text !== undefined && status.status_text !== "" && (
          <span className={styles.statusText}>{status.status_text}</span>
        )}
        {/* Email — third line, muted, ellipsis-clipped. Bots get an
            `@<realm>-bot` placeholder address that's noisy and adds
            no signal, so the email line is humans-only. */}
        {!user.is_bot && user.email !== "" && (
          <span className={styles.email} title={user.email}>
            {user.email}
          </span>
        )}
      </span>
      {tag !== undefined && <span className={styles.tag}>{tag}</span>}
    </>
  );

  if (!isDmTarget) {
    return <li className={styles.row}>{content}</li>;
  }

  // Open a DM narrow with this user — for self-DMs the recipient is
  // just our own id; otherwise the (sorted-asc) pair `[self, peer]`
  // matches the conventional DM key shape used everywhere else.
  const handleClick = (): void => {
    const recipients =
      ownUserId === undefined || ownUserId === user.user_id
        ? [user.user_id]
        : [ownUserId, user.user_id].sort((a, b) => a - b);
    goToNarrow([{ operator: "dm", operand: recipients }]);
  };

  return (
    <li>
      <button
        type="button"
        className={`${styles.row} ${styles.clickable}`}
        onClick={handleClick}
        aria-label={`Личная переписка с ${user.full_name}`}
      >
        {content}
      </button>
    </li>
  );
}

/**
 * Inline status emoji shown next to the user's name. Renders Unicode
 * emoji as text (the corpus and Zulip's own renderer agree on the
 * `emoji_code → glyph` decoding); other namespaces fall back to the
 * colon-shortcode so the row stays informative even when the realm
 * emoji image is not in scope.
 */
function UserStatusBadge({ status }: { status: UserStatus }): React.JSX.Element | null {
  if (
    status.reaction_type === "unicode_emoji" &&
    status.emoji_code !== undefined &&
    status.emoji_code !== ""
  ) {
    const glyph = glyphFromUnicodeEmojiCode(status.emoji_code);
    if (glyph !== null) {
      return (
        <span
          className={styles.statusEmoji}
          aria-label={`Status emoji: ${status.emoji_name ?? ""}`}
        >
          {glyph}
        </span>
      );
    }
  }
  if (status.emoji_name !== undefined && status.emoji_name !== "") {
    return (
      <span className={styles.statusEmoji}>
        {`:${status.emoji_name}:`}
      </span>
    );
  }
  return null;
}
