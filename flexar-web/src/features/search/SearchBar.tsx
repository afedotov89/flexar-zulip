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

import { useCallback, useState, type FormEvent } from "react";
import { Input } from "../../components/Input";
import { useNarrowNavigation } from "../../lib/narrow";
import { parseSearchQuery } from "../../lib/search";
import styles from "./SearchBar.module.css";

export function SearchBar(): React.JSX.Element {
  const [value, setValue] = useState("");
  const { goToNarrow } = useNarrowNavigation();

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
        size="sm"
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search (try from:, channel:, topic:, is:starred, …)"
        aria-label="Search messages"
        iconLeft="search"
        autoComplete="off"
      />
    </form>
  );
}
