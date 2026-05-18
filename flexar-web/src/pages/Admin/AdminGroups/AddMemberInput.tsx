// Add-member inline typeahead for the create-group modal (Phase B3).
//
// Duplicate of `pages/Channels/ChannelDetail/AddSubscriberInput.tsx`,
// renamed and re-labelled for the user-groups context. The original
// stays scoped to channel subscribers; we copy rather than promote to
// a shared primitive until a third caller proves the pattern is truly
// reusable (per ENGINEERING_GUIDE §0.4 — orchestrator decision).
//
// Filter rules: substring match on `full_name` or `email`, case-
// insensitive; deactivated and bot users excluded; users already in
// `existingIds` excluded; cap to 8 results so the list doesn't grow
// without bound on a sparse query.
//
// Drop-down opens on focus with the first 8 eligible candidates (even
// for an empty query) so admins immediately see who they can pick.
// Typing narrows. Non-empty query with no matches shows a "Нет
// совпадений" row instead of nothing.

import { useMemo, useState } from "react";
import { Avatar } from "../../../components/Avatar";
import { Input } from "../../../components/Input";
import type { User, UserId } from "../../../domain";
import { useUsersStore } from "../../../stores/usersStore";
import styles from "./AddMemberInput.module.css";

export interface AddMemberInputProps {
  /** User-ids that are already selected; suppressed from suggestions. */
  existingIds: ReadonlyArray<UserId>;
  /** Called once the user picks a candidate. */
  onSelect: (userId: UserId) => void;
}

const MAX_RESULTS = 8;

export function AddMemberInput({
  existingIds,
  onSelect,
}: AddMemberInputProps): React.JSX.Element {
  const usersMap = useUsersStore((s) => s.users);
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);

  const candidates = useMemo<User[]>(() => {
    const trimmed = query.trim().toLowerCase();
    const existing = new Set(existingIds);
    const matches: User[] = [];
    for (const user of Object.values(usersMap)) {
      if (!user.is_active || user.is_bot) {
        continue;
      }
      if (existing.has(user.user_id)) {
        continue;
      }
      if (trimmed !== "") {
        const name = user.full_name.toLowerCase();
        const email = user.email.toLowerCase();
        if (!name.includes(trimmed) && !email.includes(trimmed)) {
          continue;
        }
      }
      matches.push(user);
      if (matches.length >= MAX_RESULTS) {
        break;
      }
    }
    return matches;
  }, [query, existingIds, usersMap]);

  const handlePick = (userId: UserId): void => {
    onSelect(userId);
    setQuery("");
  };

  // Open on focus OR as soon as anything is typed — the OR keeps
  // existing tests (which use `fireEvent.change` without an explicit
  // focus event) green while giving click-and-browse discoverability
  // to real users.
  const dropdownOpen = focused || query !== "";
  const showEmpty = dropdownOpen && candidates.length === 0;

  return (
    <div className={styles.root}>
      <Input
        type="search"
        aria-label="Добавить участника"
        placeholder="Поиск участника по имени или email"
        value={query}
        onChange={(event) => setQuery(event.currentTarget.value)}
        onFocus={() => setFocused(true)}
        // Defer blur so the click on a candidate registers before the
        // dropdown unmounts.
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        iconLeft="search"
      />
      {dropdownOpen && candidates.length > 0 && (
        <ul className={styles.results} aria-label="Совпадения">
          {candidates.map((user) => (
            <li key={user.user_id}>
              <button
                type="button"
                className={styles.candidate}
                onMouseDown={(event) => {
                  // Keep focus on the input so the delayed onBlur
                  // doesn't race the click.
                  event.preventDefault();
                }}
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
      {showEmpty && (
        <div className={styles.empty} role="status">
          {query.trim() === ""
            ? "Все подходящие участники уже добавлены."
            : "Нет совпадений."}
        </div>
      )}
    </div>
  );
}
