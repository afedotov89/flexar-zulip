// Global lightbox-state store (Phase 4.2).
//
// Single image at a time, by design: a click on any inline image in
// any message body opens the same lightbox. Splitting that across
// per-`MessageContent` modals would deliver a worse experience and
// pay React for nothing — one global slot is enough.
//
// No `persist`: the lightbox is a transient view, never restored
// across reloads.

import { create } from "zustand";

export interface LightboxState {
  open: boolean;
  /** Image source URL; `null` while the lightbox is closed. */
  src: string | null;
  /** Alt text for the image; `""` when none was provided. */
  alt: string;
  openImage: (src: string, alt?: string) => void;
  close: () => void;
}

export const useLightboxStore = create<LightboxState>()((set) => ({
  open: false,
  src: null,
  alt: "",
  openImage: (src, alt = "") => {
    set({ open: true, src, alt });
  },
  close: () => {
    set({ open: false, src: null, alt: "" });
  },
}));
