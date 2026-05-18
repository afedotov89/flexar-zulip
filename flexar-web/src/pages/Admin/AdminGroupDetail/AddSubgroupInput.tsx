// Add-subgroup inline typeahead for the Subgroups tab (Phase C3).
//
// Adapted from `pages/Admin/AdminGroups/AddMemberInput.tsx` — same UX,
// but the suggestion pool is `useUserGroupsStore` instead of users.
// Kept as a per-feature component rather than a shared primitive: the
// caller decides which groups are eligible (cycle exclusion, self
// exclusion, system-group exclusion), so the filter is intentionally
// pushed in by `excludedIds`.
//
// Filter rules: substring match on `name`, case-insensitive; system
// and deactivated groups excluded; ids in `excludedIds` (the parent
// itself, current direct subgroups, and any group that would create a
// cycle) excluded; cap to 8 results.
//
// Drop-down opens on focus with the first 8 eligible candidates (even
// for an empty query) so admins immediately see what they can pick.
// Typing narrows. When the query is non-empty but matches nothing, an
// explicit "Нет вариантов" row replaces the list so the field never
// looks broken-but-silent.

import { useMemo, useState } from "react";
import { Input } from "../../../components/Input";
import type { UserGroup } from "../../../domain";
import { useUserGroupsStore } from "../../../stores/userGroupsStore";
import styles from "./AddSubgroupInput.module.css";

export interface AddSubgroupInputProps {
  /** Group ids that must not appear in suggestions. */
  excludedIds: ReadonlyArray<number>;
  /** Called once the user picks a candidate. */
  onSelect: (groupId: number) => void;
}

const MAX_RESULTS = 8;

export function AddSubgroupInput({
  excludedIds,
  onSelect,
}: AddSubgroupInputProps): React.JSX.Element {
  const directory = useUserGroupsStore((s) => s.userGroups);
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);

  const candidates = useMemo<UserGroup[]>(() => {
    const trimmed = query.trim().toLowerCase();
    const excluded = new Set(excludedIds);
    const matches: UserGroup[] = [];
    for (const group of Object.values(directory)) {
      if (group.is_system_group || group.deactivated) {
        continue;
      }
      if (excluded.has(group.id)) {
        continue;
      }
      if (trimmed !== "" && !group.name.toLowerCase().includes(trimmed)) {
        continue;
      }
      matches.push(group);
      if (matches.length >= MAX_RESULTS) {
        break;
      }
    }
    return matches;
  }, [query, excludedIds, directory]);

  const handlePick = (groupId: number): void => {
    onSelect(groupId);
    setQuery("");
  };

  // Open the dropdown on focus OR as soon as anything is typed — the
  // OR keeps existing tests (which use `fireEvent.change` without an
  // explicit focus event) green while still giving click-and-browse
  // discoverability to real users.
  const dropdownOpen = focused || query !== "";
  const showEmpty = dropdownOpen && candidates.length === 0;

  return (
    <div className={styles.root}>
      <Input
        type="search"
        aria-label="Добавить подгруппу"
        placeholder="Поиск подгруппы по названию"
        value={query}
        onChange={(event) => setQuery(event.currentTarget.value)}
        onFocus={() => setFocused(true)}
        // Defer blur so a click on a candidate row registers before the
        // dropdown unmounts; without the delay the click is eaten.
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        iconLeft="search"
      />
      {dropdownOpen && candidates.length > 0 && (
        <ul className={styles.results} aria-label="Совпадения">
          {candidates.map((group) => (
            <li key={group.id}>
              <button
                type="button"
                className={styles.candidate}
                onMouseDown={(event) => {
                  // Prevent the input from losing focus on mouse-down
                  // so the onClick fires before our delayed onBlur.
                  event.preventDefault();
                }}
                onClick={() => handlePick(group.id)}
              >
                <span className={styles.candidateText}>
                  <span className={styles.candidateName}>{group.name}</span>
                  {group.description !== "" && (
                    <span className={styles.candidateDescription}>
                      {group.description}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {showEmpty && (
        <div className={styles.empty} role="status">
          {query.trim() === ""
            ? "Нет доступных подгрупп. Создайте новую кастомную группу или снимите фильтры."
            : "Нет совпадений. Системные роли в подгруппы не вкладываются."}
        </div>
      )}
    </div>
  );
}
