// Unit tests for the keymap helpers. The chord-comparator drives every
// global shortcut, so this is small but load-bearing.

import { describe, expect, it } from "vitest";
import {
  KEYMAP,
  formatShortcut,
  matchesShortcut,
  shortcutById,
  type Shortcut,
} from "./keymap";

function event(
  key: string,
  modifiers: Partial<{
    ctrl: boolean;
    meta: boolean;
    shift: boolean;
    alt: boolean;
  }> = {},
): KeyboardEvent {
  return new KeyboardEvent("keydown", {
    key,
    ctrlKey: modifiers.ctrl,
    metaKey: modifiers.meta,
    shiftKey: modifiers.shift,
    altKey: modifiers.alt,
  });
}

describe("matchesShortcut", () => {
  it("matches a plain key", () => {
    expect(matchesShortcut(event("j"), { key: "j" })).toBe(true);
    expect(matchesShortcut(event("k"), { key: "j" })).toBe(false);
  });

  it("treats Cmd and Ctrl as the same mod key", () => {
    const chord: Shortcut = { key: "k", modKey: true };
    expect(matchesShortcut(event("k", { meta: true }), chord)).toBe(true);
    expect(matchesShortcut(event("k", { ctrl: true }), chord)).toBe(true);
    expect(matchesShortcut(event("k"), chord)).toBe(false);
  });

  it("requires shift when the chord asks for it", () => {
    const chord: Shortcut = { key: "?", shift: true };
    expect(matchesShortcut(event("?", { shift: true }), chord)).toBe(true);
    // A "?" without shift cannot exist on most layouts, but stay strict.
    expect(matchesShortcut(event("?"), chord)).toBe(false);
  });

  it("rejects when an unexpected modifier is held", () => {
    const chord: Shortcut = { key: "j" };
    expect(matchesShortcut(event("j", { ctrl: true }), chord)).toBe(false);
    expect(matchesShortcut(event("j", { shift: true }), chord)).toBe(false);
  });
});

describe("formatShortcut", () => {
  it("renders a plain key uppercased", () => {
    expect(formatShortcut({ key: "j" })).toBe("J");
  });

  it("renders a mod-chord with Ctrl on non-mac", () => {
    // The helper checks navigator.platform; in jsdom it's empty, so we
    // get the non-mac branch.
    expect(formatShortcut({ key: "k", modKey: true })).toBe("Ctrl + K");
  });

  it("pretty-prints arrow keys", () => {
    expect(formatShortcut({ key: "ArrowUp" })).toBe("↑");
    expect(formatShortcut({ key: "ArrowDown" })).toBe("↓");
  });

  it("keeps multi-character key names verbatim", () => {
    expect(formatShortcut({ key: "Backspace" })).toBe("Backspace");
    expect(formatShortcut({ key: "Escape" })).toBe("Esc");
  });
});

describe("KEYMAP integrity", () => {
  it("has unique entry ids", () => {
    const ids = KEYMAP.flatMap((g) => g.entries.map((e) => e.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("exposes lookup by id", () => {
    expect(shortcutById("help")?.label).toContain("горячих клавиш");
    expect(shortcutById("does-not-exist")).toBeUndefined();
  });

  it("every chord has at least a key", () => {
    for (const group of KEYMAP) {
      for (const entry of group.entries) {
        expect(entry.chords.length).toBeGreaterThan(0);
        for (const chord of entry.chords) {
          expect(chord.key).toBeTruthy();
        }
      }
    }
  });
});
