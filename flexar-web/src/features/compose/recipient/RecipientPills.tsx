// DM recipient pill-list for the compose recipient row.
//
// `Кому: [Alice ×] [Bob ×] + Добавить` — a chip-list with delete + a
// trailing inline input for adding more. Names are resolved against
// `useUsersStore` on submit (Enter / comma / blur). Unknown tokens are
// dropped on submit (a future iteration adds typeahead suggestions
// here; for now we accept exact-name and email matches).
//
// The control is fully keyboard-navigable: Backspace at an empty input
// removes the last chip; Enter / comma commit the current input.

import { useCallback, useState, useRef, type KeyboardEvent } from "react";
import type { User, UserId } from "../../../domain";
import { Avatar } from "../../../components/Avatar";
import { useUsersStore } from "../../../stores/usersStore";
import styles from "./RecipientPills.module.css";

export interface RecipientPillsProps {
  /** Currently selected recipient user-ids, in display order. */
  recipientIds: UserId[];
  /** Called with the new list whenever a chip is added or removed. */
  onChange: (next: UserId[]) => void;
  disabled?: boolean;
}

export function RecipientPills({
  recipientIds,
  onChange,
  disabled,
}: RecipientPillsProps): React.JSX.Element {
  const users = useUsersStore((s) => s.users);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const commitToken = useCallback(
    (token: string): void => {
      const trimmed = token.trim();
      if (trimmed === "") {
        return;
      }
      // Numeric token → take as user id; otherwise exact full_name or
      // email match. Unmatched tokens are silently dropped (typeahead
      // is a future addition; for now we don't let bad input pollute
      // the chip-list).
      const asNumber = Number(trimmed);
      let matched: User | undefined;
      if (Number.isInteger(asNumber) && users[asNumber] !== undefined) {
        matched = users[asNumber];
      } else {
        for (const user of Object.values(users)) {
          if (user.full_name === trimmed || user.email === trimmed) {
            matched = user;
            break;
          }
        }
      }
      if (matched === undefined) {
        return;
      }
      if (recipientIds.includes(matched.user_id)) {
        // Already in the list — clear the input but don't re-add.
        setInput("");
        return;
      }
      onChange([...recipientIds, matched.user_id]);
      setInput("");
    },
    [users, recipientIds, onChange],
  );

  const removeAt = useCallback(
    (id: UserId): void => {
      onChange(recipientIds.filter((existing) => existing !== id));
    },
    [recipientIds, onChange],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>): void => {
      if (event.key === "Enter" || event.key === ",") {
        event.preventDefault();
        commitToken(input);
        return;
      }
      if (event.key === "Backspace" && input === "" && recipientIds.length > 0) {
        event.preventDefault();
        // Pop the last chip.
        onChange(recipientIds.slice(0, -1));
      }
    },
    [commitToken, input, recipientIds, onChange],
  );

  return (
    <div
      className={styles.container}
      onClick={() => inputRef.current?.focus()}
    >
      <span className={styles.label}>Кому</span>
      {recipientIds.map((id) => {
        const user = users[id];
        const name = user?.full_name ?? `User ${id}`;
        return (
          <span key={id} className={styles.chip}>
            <Avatar
              size="sm"
              name={name}
              src={user?.avatar_url ?? undefined}
            />
            <span className={styles.chipName}>{name}</span>
            <button
              type="button"
              className={styles.chipRemove}
              onClick={(event) => {
                event.stopPropagation();
                removeAt(id);
              }}
              disabled={disabled}
              aria-label={`Убрать ${name}`}
            >
              ×
            </button>
          </span>
        );
      })}
      <input
        ref={inputRef}
        className={styles.input}
        type="text"
        value={input}
        onChange={(event) => setInput(event.currentTarget.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => commitToken(input)}
        placeholder={recipientIds.length === 0 ? "Добавьте получателей" : ""}
        disabled={disabled}
        aria-label="Добавить получателя"
      />
    </div>
  );
}
