// A pending-flag store used as an imperative focus signal for the
// compose textarea, with an optional text-prefill payload.
//
// Why a flag rather than a bump counter: the focus request can be
// raised either while the ComposeBox is already mounted (Cmd+`c`
// shortcut on the same narrow) OR right before the ComposeBox
// re-mounts on a route change (the hover-toolbar "Reply" navigates
// to the message's narrow, which swaps the Feed's outlet content).
// A counter-based signal can't distinguish "already processed" from
// "captured on mount as initial value" — the fresh ComposeBox would
// see the bumped counter as its initial state, conclude there's no
// transition, and silently no-op. A `pending` boolean is unambiguous:
// the consumer focuses when it's true and `consume()`s it, the
// signal is fired exactly once regardless of how many times the
// consumer re-renders.
//
// `prefillText` carries optional content for "reply with quote" —
// the producer builds the Zulip-flavored quote block, the consumer
// inserts it at the textarea's caret (or appends to any existing
// draft) when it focuses.
//
// Only one `ComposeBox` is ever mounted at a time, so a single flag
// is enough; no fan-out / ordering concerns.

import { create } from "zustand";

export interface ComposeFocusState {
  /** Set by `requestFocus()`, cleared by `consume()`. */
  pending: boolean;
  /** Optional text to insert into the textarea before focusing. */
  prefillText: string | null;
  /**
   * Raise the focus request — idempotent if one is already pending.
   * Pass `prefillText` to also seed the textarea (e.g. quote-and-
   * reply); pass nothing for a plain focus.
   */
  requestFocus: (prefillText?: string) => void;
  /** Mark the pending request as handled. */
  consume: () => void;
}

export const useComposeFocusStore = create<ComposeFocusState>()((set) => ({
  pending: false,
  prefillText: null,
  requestFocus: (prefillText) =>
    set({ pending: true, prefillText: prefillText ?? null }),
  consume: () => set({ pending: false, prefillText: null }),
}));
