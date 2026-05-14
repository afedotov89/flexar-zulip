// A titled list of people in the right sidebar (Phase 1.8).
//
// Both the contextual section ("this channel" / "this conversation")
// and the full organization directory render as a `UserSection`: a
// heading, a count, and a `<ul>` of `UserRow`s — or an empty-state
// line when there is nobody to show. It is presentational: the already
// ordered + filtered entries and a presence resolver arrive as props.
//
// The heading is a real `<h2>`: the right sidebar's `<aside>` is the
// document's complementary region (set on the AppShell wrapper), and
// its sections need proper heading structure for screen-reader
// navigation.

import type { Presence } from "../../domain";
import type { UserListEntry } from "./userList";
import { UserRow } from "./UserRow";
import styles from "./UserSection.module.css";

export interface UserSectionProps {
  /** Section heading, e.g. "В этом канале" or "Все участники". */
  title: string;
  /** The ordered, already-filtered people to list. */
  entries: readonly UserListEntry[];
  /** Resolve a user id to their presence, for each row's dot. */
  getPresence: (userId: number) => Presence | undefined;
  /** Empty-state line when `entries` is empty. */
  emptyLabel: string;
}

export function UserSection({
  title,
  entries,
  getPresence,
  emptyLabel,
}: UserSectionProps): React.JSX.Element {
  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>
        <span className={styles.title}>{title}</span>
        {entries.length > 0 && (
          <span className={styles.count}>{entries.length}</span>
        )}
      </h2>
      {entries.length === 0 ? (
        <p className={styles.empty}>{emptyLabel}</p>
      ) : (
        <ul className={styles.list}>
          {entries.map((entry) => (
            <UserRow
              key={entry.user.user_id}
              user={entry.user}
              presence={getPresence(entry.user.user_id)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
