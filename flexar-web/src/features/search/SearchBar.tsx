// Flexar Hub Web — search bar (Phase 3.1).
//
// The navbar's search input. The user types Zulip-flavored query
// syntax (`from:alice topic:design hello`) and submits with Enter;
// the parser turns the query into a `Narrow`, the SPA navigates to
// the matching narrow URL, and the message feed and the server's
// `/messages?narrow=...` filter take it from there.
//
// We keep this thin: the component owns the input value and the
// submit-to-narrow wiring, nothing more. Operator-aware autocomplete
// (suggesting `from:` users, `channel:` channels, …) is a future
// refinement and out of this phase's scope.

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Input } from "../../components/Input";
import { useI18n } from "../../lib/i18n";
import { useNarrowNavigation } from "../../lib/narrow";
import { parseSearchQuery } from "../../lib/search";
import { useSearchFocusStore } from "./searchFocusSignal";
import styles from "./SearchBar.module.css";

export function SearchBar(): React.JSX.Element {
  const [value, setValue] = useState("");
  const { goToNarrow } = useNarrowNavigation();
  const inputRef = useRef<HTMLInputElement>(null);
  const { m } = useI18n();

  // External focus signal — bumped by the `search` shortcut
  // (Ctrl/Cmd+K). When the tick changes we focus + select-all so the
  // user can immediately type over any leftover query.
  const focusTick = useSearchFocusStore((state) => state.tick);
  const lastFocusTickRef = useRef(focusTick);
  useEffect(() => {
    if (lastFocusTickRef.current === focusTick) {
      return;
    }
    lastFocusTickRef.current = focusTick;
    const input = inputRef.current;
    if (input === null) {
      return;
    }
    input.focus();
    input.select();
  }, [focusTick]);

  const onSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmed = value.trim();
      if (trimmed === "") {
        // Empty submit goes to the combined feed — the same place an
        // empty narrow lands the user. Keeping this consistent means
        // pressing Enter with an empty box is a deliberate "back to
        // everything" action rather than a no-op the user has to
        // explain to themselves.
        goToNarrow([]);
        return;
      }
      const narrow = parseSearchQuery(trimmed);
      goToNarrow(narrow);
    },
    [value, goToNarrow],
  );

  return (
    <form className={styles.bar} role="search" onSubmit={onSubmit}>
      <Input
        ref={inputRef}
        size="sm"
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={m.search.placeholder}
        aria-label={m.search.ariaLabel}
        iconLeft="search"
        autoComplete="off"
      />
    </form>
  );
}
