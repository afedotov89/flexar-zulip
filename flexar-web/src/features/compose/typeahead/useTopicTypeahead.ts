// Flexar Hub Web — topic typeahead controller (Phase 2.3).
//
// Specialised hook for the compose box's *topic input*. Differences
// from the textarea typeahead:
//   - the entire input value is the query (no trigger character);
//   - selection replaces the whole value with the chosen topic name;
//   - the underlying topic list is fetched lazily via `topicsStore`
//     when the input first gets focus.
//
// The hook does the lazy fetch itself (calls `loadTopics(streamId)`
// once on focus) so the owner only has to pass the current channel id
// and wire the returned attributes/handlers.

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import type { KeyboardEvent } from "react";
import type { StreamId, Topic } from "../../../domain";
import { topicRows, type TopicRow } from "./sources";

export interface TopicTypeaheadState {
  open: boolean;
  panelId: string;
  rows: readonly TopicRow[];
  activeId: string | null;
}

export interface UseTopicTypeaheadArgs {
  /** Current topic-input value (the query). */
  value: string;
  /** The channel the topic belongs to (drives the fetch). */
  streamId: StreamId | undefined;
  /** All known topics for `streamId`, from `topicsStore.getTopics`. */
  topics: readonly Topic[];
  /**
   * Lazy topic-list loader. Called once on focus; idempotent in the
   * store, so multiple calls are safe.
   */
  loadTopics: (streamId: StreamId) => void;
  /** Called when the user picks a topic (replaces the input value). */
  onApply: (value: string) => void;
}

export interface UseTopicTypeaheadReturn {
  state: TopicTypeaheadState;
  onHover: (id: string) => void;
  onSelect: (id: string) => void;
  /** Attach to the topic input's `onFocus` to trigger the lazy fetch. */
  handleFocus: () => void;
  handleBlur: () => void;
  /** As `useTextareaTypeahead` — return `true` if the event was consumed. */
  handleKeyDown: (event: KeyboardEvent<HTMLInputElement>) => boolean;
  close: () => void;
}

export function useTopicTypeahead({
  value,
  streamId,
  topics,
  loadTopics,
  onApply,
}: UseTopicTypeaheadArgs): UseTopicTypeaheadReturn {
  const panelId = useId();
  // The topic typeahead is only open while the input has focus and is
  // not manually dismissed. Manual dismiss clears on every keystroke or
  // on the next focus, so it does not "stick" past the next interaction.
  const [hasFocus, setHasFocus] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const rows = useMemo(() => topicRows(value, topics), [value, topics]);
  const open = hasFocus && !dismissed && rows.length > 0;

  const [activeId, setActiveId] = useState<string | null>(null);
  useEffect(() => {
    if (!open) {
      setActiveId(null);
      return;
    }
    setActiveId((current) => {
      if (current !== null && rows.some((r) => r.id === current)) {
        return current;
      }
      return rows[0].id;
    });
  }, [open, rows]);

  // Reset the manual-dismiss flag any time the value changes, so typing
  // re-opens the typeahead.
  useEffect(() => {
    setDismissed(false);
  }, [value]);

  const close = useCallback(() => {
    setDismissed(true);
    setActiveId(null);
  }, []);

  const apply = useCallback(
    (rowId: string) => {
      const row = rows.find((r) => r.id === rowId);
      if (row === undefined) {
        return;
      }
      onApply(row.insertText);
      setDismissed(true);
      setActiveId(null);
    },
    [rows, onApply],
  );

  const handleFocus = useCallback(() => {
    setHasFocus(true);
    setDismissed(false);
    if (streamId !== undefined) {
      loadTopics(streamId);
    }
  }, [streamId, loadTopics]);

  const handleBlur = useCallback(() => {
    setHasFocus(false);
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>): boolean => {
      if (!open) {
        return false;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close();
        return true;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveId((current) => {
          const idx = current === null ? -1 : rows.findIndex((r) => r.id === current);
          const next = (idx + 1) % rows.length;
          return rows[next].id;
        });
        return true;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveId((current) => {
          const idx = current === null ? 0 : rows.findIndex((r) => r.id === current);
          const next = (idx - 1 + rows.length) % rows.length;
          return rows[next].id;
        });
        return true;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        if (activeId === null) {
          return false;
        }
        event.preventDefault();
        apply(activeId);
        return true;
      }
      return false;
    },
    [open, rows, activeId, apply, close],
  );

  return {
    state: { open, panelId, rows, activeId },
    onHover: setActiveId,
    onSelect: apply,
    handleFocus,
    handleBlur,
    handleKeyDown,
    close,
  };
}
