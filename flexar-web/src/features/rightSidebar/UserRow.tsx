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

import type { Presence, User } from "../../domain";
import { Avatar } from "../../components/Avatar";
import { PresenceDot } from "../../components/PresenceDot";
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
      <span className={styles.name}>{user.full_name}</span>
      {tag !== undefined && <span className={styles.tag}>{tag}</span>}
    </li>
  );
}
