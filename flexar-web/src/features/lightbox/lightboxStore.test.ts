// Unit tests for the lightbox store (Phase 4.2).

import { beforeEach, describe, expect, it } from "vitest";
import { useLightboxStore } from "./lightboxStore";

describe("useLightboxStore", () => {
  beforeEach(() => {
    useLightboxStore.setState({ open: false, src: null, alt: "" });
  });

  it("starts closed", () => {
    const state = useLightboxStore.getState();
    expect(state.open).toBe(false);
    expect(state.src).toBeNull();
    expect(state.alt).toBe("");
  });

  it("opens with a src and alt", () => {
    useLightboxStore.getState().openImage("/img/a.png", "A");
    const state = useLightboxStore.getState();
    expect(state.open).toBe(true);
    expect(state.src).toBe("/img/a.png");
    expect(state.alt).toBe("A");
  });

  it("defaults alt to the empty string", () => {
    useLightboxStore.getState().openImage("/img/b.png");
    expect(useLightboxStore.getState().alt).toBe("");
  });

  it("clears state on close", () => {
    useLightboxStore.getState().openImage("/img/c.png", "C");
    useLightboxStore.getState().close();
    const state = useLightboxStore.getState();
    expect(state.open).toBe(false);
    expect(state.src).toBeNull();
    expect(state.alt).toBe("");
  });
});
