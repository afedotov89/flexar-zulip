// Global lightbox-state store (Phase 4.2, video added 6.x).
//
// Single asset at a time, by design: a click on any inline image or
// video in any message body opens the same lightbox. Splitting that
// across per-`MessageContent` modals would deliver a worse experience
// and pay React for nothing — one global slot is enough.
//
// `kind` discriminates the asset for the Lightbox component — it
// renders an `<img>` for images and a controllable `<video>` for
// video.
//
// No `persist`: the lightbox is a transient view, never restored
// across reloads.

import { create } from "zustand";

export type LightboxKind = "image" | "video";

export interface LightboxState {
  open: boolean;
  /** Source URL of the asset; `null` while the lightbox is closed. */
  src: string | null;
  /** Alt / accessible label; `""` when none was provided. */
  alt: string;
  /** What kind of asset to render. Defaults to image. */
  kind: LightboxKind;
  openImage: (src: string, alt?: string) => void;
  openVideo: (src: string, alt?: string) => void;
  close: () => void;
}

export const useLightboxStore = create<LightboxState>()((set) => ({
  open: false,
  src: null,
  alt: "",
  kind: "image",
  openImage: (src, alt = "") => {
    set({ open: true, src, alt, kind: "image" });
  },
  openVideo: (src, alt = "") => {
    set({ open: true, src, alt, kind: "video" });
  },
  close: () => {
    set({ open: false, src: null, alt: "", kind: "image" });
  },
}));
