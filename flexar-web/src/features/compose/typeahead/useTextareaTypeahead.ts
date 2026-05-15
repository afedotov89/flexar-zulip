// Flexar Hub Web — textarea typeahead controller (Phase 2.3).
//
// Bundles the state and key handling for the `@`/`#`/`:` typeaheads in
// the compose message body. The owner component (`ComposeBox`) wires
// this hook to its textarea: pass the value/cursor on every change,
// receive the current rows + active id + `aria-*` attributes + the key
// handler that forwards arrow/enter/escape to typeahead navigation.
//
// State machine:
//
//   detectTrigger(value, cursor)
//     │
//     ├─ null            → close: no panel rendered
//     └─ {kind, query}   → compute rows for that kind
//                            ├─ rows.length === 0 → close
//                            └─ rows.length > 0   → open, activeIndex = 0
//
// On each update we keep the *previous* `activeId` highlighted when the
// new row list still contains it; otherwise we reset to row 0. This is
// what makes the typeahead feel non-jumpy as the user keeps typing.
//
// Selection writes the new value back via `onApply(value, cursor)` —
// the owner controls the actual textarea state, this hook never
// touches the DOM directly. (Setting `selectionStart`/`selectionEnd`
// after the value updates is handled by the owner in a `useEffect`.)

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import type { KeyboardEvent } from "react";
import type {
  Stream,
  StreamId,
  Subscription,
  User,
  UserId,
} from "../../../domain";
import { EMOJI_CORPUS } from "../../../lib/emoji";
import { detectTrigger, type TypeaheadTrigger } from "./triggerDetect";
import { spliceTypeahead } from "./splice";
import {
  channelRows,
  emojiRows,
  mentionRows,
  type ChannelRow,
  type EmojiRow,
  type MentionRow,
} from "./sources";

export type TextareaTypeaheadKind = "mention" | "channel" | "emoji";
export type TextareaTypeaheadRow = MentionRow | ChannelRow | EmojiRow;

export interface TextareaTypeaheadState {
  /** Whether the panel should be visible. */
  open: boolean;
  /** The current trigger kind, or `null` when closed. */
  kind: TextareaTypeaheadKind | null;
  /** The id used for the panel's `id` and the field's `aria-controls`. */
  panelId: string;
  /** The current row list (empty when closed). */
  rows: readonly TextareaTypeaheadRow[];
  /** The active row's id — for `aria-activedescendant`. */
  activeId: string | null;
}

export interface UseTextareaTypeaheadArgs {
  /** Current textarea value. */
  value: string;
  /** Current `selectionStart`. */
  cursor: number;
  users: Record<UserId, User>;
  streams: Record<StreamId, Stream>;
  subscriptions: Record<StreamId, Subscription>;
  /**
   * Called when the user picks a row. The owner installs the new
   * `value` on the textarea and sets the selection to `cursor`.
   */
  onApply: (value: string, cursor: number) => void;
}

export interface UseTextareaTypeaheadReturn {
  state: TextareaTypeaheadState;
  /** Hover handler for the panel (mouse-driven highlight sync). */
  onHover: (id: string) => void;
  /** Mouse-select handler for the panel. */
  onSelect: (id: string) => void;
  /**
   * Key handler the owner attaches to the textarea. Returns `true` if
   * the event was consumed by the typeahead — the owner should NOT do
   * its own thing (e.g. send-on-Enter) in that case.
   */
  handleKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => boolean;
  /** Close the typeahead (e.g. when the textarea blurs). */
  close: () => void;
}

export function useTextareaTypeahead({
  value,
  cursor,
  users,
  streams,
  subscriptions,
  onApply,
}: UseTextareaTypeaheadArgs): UseTextareaTypeaheadReturn {
  const panelId = useId();
  // We track a "manually closed" trigger position so Escape doesn't
  // immediately re-open the same token on the next keystroke. As soon
  // as the user moves out of the suppressed range or types a new
  // trigger, suppression clears. State (not a ref) so the trigger memo
  // re-runs when it changes.
  const [suppressed, setSuppressed] = useState<
    { start: number; end: number } | null
  >(null);

  const trigger: TypeaheadTrigger | null = useMemo(() => {
    const t = detectTrigger(value, cursor);
    if (t === null) {
      return null;
    }
    if (suppressed !== null && t.start === suppressed.start) {
      return null;
    }
    return t;
  }, [value, cursor, suppressed]);

  // Clear suppression once the cursor leaves the suppressed token.
  useEffect(() => {
    if (suppressed === null) {
      return;
    }
    if (cursor < suppressed.start || cursor > suppressed.end + 64) {
      setSuppressed(null);
    }
  }, [cursor, suppressed]);

  const rows: readonly TextareaTypeaheadRow[] = useMemo(() => {
    if (trigger === null) {
      return [];
    }
    switch (trigger.kind) {
      case "mention":
        return mentionRows(trigger.query, users);
      case "channel":
        return channelRows(trigger.query, streams, subscriptions);
      case "emoji":
        return emojiRows(trigger.query, EMOJI_CORPUS);
    }
  }, [trigger, users, streams, subscriptions]);

  const open = trigger !== null && rows.length > 0;

  // Maintain `activeId` across row-list changes: keep the same row
  // highlighted if it still exists; otherwise reset to row 0.
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

  const close = useCallback(() => {
    if (trigger !== null) {
      setSuppressed({ start: trigger.start, end: trigger.end });
    }
    setActiveId(null);
  }, [trigger]);

  const apply = useCallback(
    (rowId: string) => {
      if (trigger === null) {
        return;
      }
      const row = rows.find((r) => r.id === rowId);
      if (row === undefined) {
        return;
      }
      const result = spliceTypeahead({
        value,
        start: trigger.start,
        end: trigger.end,
        replacement: row.insertText,
      });
      // Suppress until the user moves off the inserted token (else
      // typing more characters of a name immediately after selecting
      // it would re-open the typeahead at the same token).
      setSuppressed({
        start: trigger.start,
        end: trigger.start + row.insertText.length,
      });
      setActiveId(null);
      onApply(result.value, result.cursor);
    },
    [trigger, rows, value, onApply],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>): boolean => {
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
    state: { open, kind: trigger?.kind ?? null, panelId, rows, activeId },
    onHover: setActiveId,
    onSelect: apply,
    handleKeyDown,
    close,
  };
}
