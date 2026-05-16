// A bump-counter store used as an imperative focus signal for the
// compose textarea.
//
// The `c` ("compose") and `r` ("reply") keyboard shortcuts live at
// the AppShell scope, but the compose textarea is mounted deep inside
// the feed. Passing a ref upward through React would force several
// components to know about focus management that has nothing to do
// with their concerns. Instead, the shortcuts call `requestFocus()`,
// `ComposeBox` subscribes to the counter and focuses its textarea
// whenever it ticks. One global counter is enough — only one
// `ComposeBox` is ever mounted at a time.

import { create } from "zustand";

export interface ComposeFocusState {
  /** Bumped each time the textarea should grab focus. */
  tick: number;
  requestFocus: () => void;
}

export const useComposeFocusStore = create<ComposeFocusState>()((set) => ({
  tick: 0,
  requestFocus: () => set((state) => ({ tick: state.tick + 1 })),
}));
