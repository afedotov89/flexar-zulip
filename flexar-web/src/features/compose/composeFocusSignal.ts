// A pending-flag store used as an imperative focus signal for the
// compose textarea.
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
// Only one `ComposeBox` is ever mounted at a time, so a single flag
// is enough; no fan-out / ordering concerns.

import { create } from "zustand";

export interface ComposeFocusState {
  /** Set by `requestFocus()`, cleared by `consume()`. */
  pending: boolean;
  /** Raise the focus request — idempotent if one is already pending. */
  requestFocus: () => void;
  /** Mark the pending request as handled. */
  consume: () => void;
}

export const useComposeFocusStore = create<ComposeFocusState>()((set) => ({
  pending: false,
  requestFocus: () => set({ pending: true }),
  consume: () => set({ pending: false }),
}));
