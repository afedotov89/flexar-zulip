// Flexar Hub Web — typing indicator (Phase 4.3).
//
// "Alice is typing…" / "Alice and Bob are typing…" / "Alice and 2
// others are typing…" — a small line shown above the compose box for
// the currently active narrow. Hides itself when no one is typing.
//
// The component is a thin renderer; the conversation-key resolution
// and the realtime subscription live in `useTypingFor` and the typing
// store. Names are resolved off `useUsersStore` at render time;
// unknown users fall back to a stable placeholder rather than
// breaking the row.

import type { Narrow } from "../../domain";
import { useUsersStore } from "../../stores/usersStore";
import { useTypingFor } from "./useTypingFor";
import styles from "./TypingIndicator.module.css";

export interface TypingIndicatorProps {
  /** The narrow whose conversation the compose box is targeting. */
  narrow: Narrow | undefined;
}

export function TypingIndicator({
  narrow,
}: TypingIndicatorProps): React.JSX.Element | null {
  const senderIds = useTypingFor(narrow);
  const getUser = useUsersStore((s) => s.getUser);

  if (senderIds.length === 0) {
    return null;
  }

  const names = senderIds.map(
    (id) => getUser(id)?.full_name ?? `User ${id}`,
  );
  const message = formatTypingNames(names);

  return (
    <div className={styles.indicator} role="status" aria-live="polite">
      {message}
    </div>
  );
}

/**
 * Build the human-readable phrase for an active-typer list:
 *   ["Alice"]                 → "Alice печатает…"
 *   ["Alice", "Bob"]          → "Alice и Bob печатают…"
 *   ["Alice", "Bob", "Carol"] → "Alice и ещё 2 печатают…"
 *
 * Cap at three names rendered explicitly so the row stays single-line
 * even with a chatty thread.
 */
export function formatTypingNames(names: readonly string[]): string {
  if (names.length === 0) {
    return "";
  }
  if (names.length === 1) {
    return `${names[0]} печатает…`;
  }
  if (names.length === 2) {
    return `${names[0]} и ${names[1]} печатают…`;
  }
  const others = names.length - 1;
  return `${names[0]} и ещё ${others} печатают…`;
}
