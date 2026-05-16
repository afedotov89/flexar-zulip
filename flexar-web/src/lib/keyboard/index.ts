// Barrel for the keyboard module.
//
// `keymap`    — pure data + matchers (no side effects).
// `registry`  — runtime dispatch (lazy document listener, LIFO stack).
// `useKeyboardShortcut` — React hook that binds a callback to a chord.

export {
  KEYMAP,
  formatShortcut,
  matchesShortcut,
  shortcutById,
  type Shortcut,
  type ShortcutEntry,
  type ShortcutGroup,
  type ShortcutScope,
} from "./keymap";
export { isEditableTarget, subscribeShortcut } from "./registry";
export type { ShortcutHandler } from "./registry";
export { useKeyboardShortcut } from "./useKeyboardShortcut";
