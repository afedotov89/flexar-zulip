// A single person row in the right sidebar's user lists (1.8).
//
// Presentational: an avatar with an overlaid presence dot, the user's
// name, and — for bots and deactivated accounts — a short trailing
// tag. The right sidebar's user lists are not navigational in this
// phase (there is no per-user narrow target yet), so a row is a plain
// non-interactive list item, not a link or button. Data and the
// user's presence arrive as props; the row touches no store. The
// `PresenceDot` carries the accessible presence label, so the row
// itself adds no extra status text.

import type { Presence, User, UserStatus } from "../../domain";
import { Avatar } from "../../components/Avatar";
import { PresenceDot } from "../../components/PresenceDot";
import { useUserStatusesStore } from "../../stores/userStatusesStore";
import { glyphFromUnicodeEmojiCode } from "../../lib/emoji/identity";
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

  return (
    <li className={styles.row}>
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
      </span>
      {tag !== undefined && <span className={styles.tag}>{tag}</span>}
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
