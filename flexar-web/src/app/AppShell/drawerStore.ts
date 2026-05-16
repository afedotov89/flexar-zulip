// Tiny store for the mobile sidebar drawers.
//
// On wide screens both sidebars live in always-visible columns and this
// store is ignored. Under 1024px the right sidebar collapses into a
// drawer; under 768px the left sidebar joins it. The store is the open/
// closed bit and the open/close commands — the visual breakpoint logic
// lives in CSS.
//
// Only one drawer is open at a time (opening one closes the other);
// the route changes via `useLocation` close them both — see the
// effect in `AppShell`. Esc also closes via a tiny global listener
// the component registers.

import { create } from "zustand";

type Side = "left" | "right";

export interface DrawerState {
  /** Which drawer, if any, is currently open. */
  open: Side | null;
  /** Open the left-sidebar drawer (closes the right one if it was open). */
  openLeft: () => void;
  /** Open the right-sidebar drawer (closes the left one if it was open). */
  openRight: () => void;
  /** Close any open drawer. */
  close: () => void;
}

export const useDrawerStore = create<DrawerState>()((set) => ({
  open: null,
  openLeft: () => set({ open: "left" }),
  openRight: () => set({ open: "right" }),
  close: () => set({ open: null }),
}));
