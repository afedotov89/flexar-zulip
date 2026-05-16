// Imperative focus signal for the navbar search bar.
//
// Same pattern as `composeFocusSignal`: a bump counter that the global
// `Cmd/Ctrl+K` shortcut increments and `SearchBar` watches via an
// effect. Lets the shortcut be registered once at the AppShell scope
// without dragging the input ref up through the navbar.

import { create } from "zustand";

export interface SearchFocusState {
  tick: number;
  requestFocus: () => void;
}

export const useSearchFocusStore = create<SearchFocusState>()((set) => ({
  tick: 0,
  requestFocus: () => set((state) => ({ tick: state.tick + 1 })),
}));
