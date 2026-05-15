// Add-subscriber control for the channel detail page (Phase 5.3).
//
// Tiny inline typeahead: an `Input` plus a token-styled list of
// matches that drops below it. Clicking a candidate calls `onSelect`
// and clears the input. We deliberately avoid the heavier `Popover`
// here — the field is always inline in the section, so a static
// dropdown is simpler and more legible.
//
// Filter rules: substring match on `full_name` or `email`, case-
// insensitive; deactivated and bot users excluded; users already in
// `existingIds` excluded; cap to 8 results so the list doesn't grow
// without bound on a sparse query.

import { useMemo, useState } from "react";
import { Avatar } from "../../../components/Avatar";
import { Input } from "../../../components/Input";
import type { User, UserId } from "../../../domain";
import { useUsersStore } from "../../../stores/usersStore";
import styles from "./AddSubscriberInput.module.css";

export interface AddSubscriberInputProps {
  /** User-ids that are already subscribed; suppressed from suggestions. */
  existingIds: ReadonlyArray<UserId>;
  /** Called once the user picks a candidate. */
  onSelect: (userId: UserId) => void | Promise<void>;
}

const MAX_RESULTS = 8;

export function AddSubscriberInput({
  existingIds,
  onSelect,
}: AddSubscriberInputProps): React.JSX.Element {
  const usersMap = useUsersStore((s) => s.users);
  const [query, setQuery] = useState("");

  const candidates = useMemo<User[]>(() => {
    const trimmed = query.trim().toLowerCase();
    if (trimmed === "") {
      return [];
    }
    const existing = new Set(existingIds);
    const matches: User[] = [];
    for (const user of Object.values(usersMap)) {
      if (!user.is_active || user.is_bot) {
        continue;
      }
      if (existing.has(user.user_id)) {
        continue;
      }
      const name = user.full_name.toLowerCase();
      const email = user.email.toLowerCase();
      if (name.includes(trimmed) || email.includes(trimmed)) {
        matches.push(user);
        if (matches.length >= MAX_RESULTS) {
          break;
        }
      }
    }
    return matches;
  }, [query, existingIds, usersMap]);

  const handlePick = (userId: UserId): void => {
    void onSelect(userId);
    setQuery("");
  };

  return (
    <div className={styles.root}>
      <Input
        type="search"
        aria-label="Добавить подписчика"
        placeholder="Добавить подписчика по имени или email"
        value={query}
        onChange={(event) => setQuery(event.currentTarget.value)}
        iconLeft="plus"
      />
      {candidates.length > 0 && (
        <ul className={styles.results} aria-label="Совпадения">
          {candidates.map((user) => (
            <li key={user.user_id}>
              <button
                type="button"
                className={styles.candidate}
                onClick={() => handlePick(user.user_id)}
              >
                <Avatar
                  src={user.avatar_url ?? undefined}
                  name={user.full_name}
                  size="sm"
                />
                <span className={styles.candidateText}>
                  <span className={styles.candidateName}>{user.full_name}</span>
                  <span className={styles.candidateEmail}>{user.email}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
