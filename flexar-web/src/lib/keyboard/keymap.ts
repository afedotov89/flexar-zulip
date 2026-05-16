// Keyboard shortcuts — pure data + matching helpers.
//
// `Shortcut` describes one chord (single key, with optional modifiers).
// `matchesShortcut` is the comparator the global keydown listener uses
// to decide whether an event should fire a registered handler.
//
// `KEYMAP` is the realm's single source of truth for built-in
// shortcuts: ids, key-chords, scopes, human-readable labels. The
// keyboard-help overlay reads this directly so the docs and the
// behaviour can't drift.
//
// Scopes:
//   "global"  — fires from anywhere, including inside text inputs.
//               Used sparingly (Cmd-K, Esc, `?`).
//   "default" — fires only when the current focus is NOT inside an
//               editable element (textarea / input / contenteditable).
//               This is the bulk of feed/narrow shortcuts.

export type ShortcutScope = "global" | "default";

export interface Shortcut {
  /** The KeyboardEvent.key to match. */
  key: string;
  /** Whether Ctrl OR Meta (Cmd) is required. */
  modKey?: boolean;
  /** Whether Shift is required. */
  shift?: boolean;
  /** Whether Alt is required. */
  alt?: boolean;
}

export interface ShortcutEntry {
  /** Stable identifier. */
  id: string;
  /** Human label for the help overlay. */
  label: string;
  /** Scope — controls whether the shortcut fires inside editable elements. */
  scope: ShortcutScope;
  /** Chord(s) that trigger this entry — multiple = aliases. */
  chords: Shortcut[];
}

export interface ShortcutGroup {
  /** Group heading in the help overlay. */
  heading: string;
  /** Shortcuts shown under this heading, in render order. */
  entries: ShortcutEntry[];
}

/**
 * Test whether a `KeyboardEvent` matches a single chord. The "mod" key
 * is `Cmd` on macOS and `Ctrl` everywhere else — we accept either to
 * spare the cross-platform branch at every call site.
 */
export function matchesShortcut(
  event: KeyboardEvent,
  shortcut: Shortcut,
): boolean {
  if (event.key !== shortcut.key) {
    return false;
  }
  const modPressed = event.metaKey || event.ctrlKey;
  if ((shortcut.modKey ?? false) !== modPressed) {
    return false;
  }
  if ((shortcut.shift ?? false) !== event.shiftKey) {
    return false;
  }
  if ((shortcut.alt ?? false) !== event.altKey) {
    return false;
  }
  return true;
}

/**
 * Render a chord as a human-readable string for the help overlay
 * (e.g. `Ctrl + K`, `Shift + ?`, `j`). Mac users see `⌘` for the mod
 * key; the heuristic is `navigator.platform` if available, else `Ctrl`.
 */
export function formatShortcut(shortcut: Shortcut): string {
  const isMac =
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad/i.test(navigator.platform);
  const parts: string[] = [];
  if (shortcut.modKey === true) {
    parts.push(isMac ? "⌘" : "Ctrl");
  }
  if (shortcut.alt === true) {
    parts.push(isMac ? "⌥" : "Alt");
  }
  if (shortcut.shift === true) {
    parts.push("Shift");
  }
  parts.push(prettyKey(shortcut.key));
  return parts.join(" + ");
}

function prettyKey(key: string): string {
  switch (key) {
    case "ArrowUp":
      return "↑";
    case "ArrowDown":
      return "↓";
    case "ArrowLeft":
      return "←";
    case "ArrowRight":
      return "→";
    case " ":
      return "Space";
    case "Escape":
      return "Esc";
    case "Enter":
      return "Enter";
    default:
      // Single visible keys ("?", "j", etc.) come through verbatim;
      // multi-char names ("Backspace", "Home") stay as-is.
      return key.length === 1 ? key.toUpperCase() : key;
  }
}

/**
 * The realm's registered shortcuts, grouped for the help overlay.
 * Adding a new shortcut: add the entry here AND wire a handler at the
 * relevant feature (`useKeyboardShortcut` reads the id off this list).
 */
export const KEYMAP: ShortcutGroup[] = [
  {
    heading: "Общие",
    entries: [
      {
        id: "help",
        label: "Показать список горячих клавиш",
        scope: "global",
        chords: [{ key: "?", shift: true }],
      },
      {
        id: "search",
        label: "Перейти к поиску",
        scope: "global",
        chords: [{ key: "k", modKey: true }],
      },
      {
        id: "escape",
        label: "Отменить / закрыть / снять фокус",
        scope: "global",
        chords: [{ key: "Escape" }],
      },
      {
        id: "compose",
        label: "Открыть compose",
        scope: "default",
        chords: [{ key: "c" }],
      },
    ],
  },
  {
    heading: "Лента сообщений",
    entries: [
      {
        id: "feed-next",
        label: "Следующее сообщение",
        scope: "default",
        chords: [{ key: "j" }, { key: "ArrowDown" }],
      },
      {
        id: "feed-prev",
        label: "Предыдущее сообщение",
        scope: "default",
        chords: [{ key: "k" }, { key: "ArrowUp" }],
      },
      {
        id: "feed-bottom",
        label: "К последнему сообщению",
        scope: "default",
        chords: [{ key: "End" }],
      },
      {
        id: "feed-top",
        label: "К первому сообщению",
        scope: "default",
        chords: [{ key: "Home" }],
      },
      {
        id: "feed-reply",
        label: "Ответить в этой теме",
        scope: "default",
        chords: [{ key: "r" }],
      },
    ],
  },
  {
    heading: "Навигация",
    entries: [
      {
        id: "nav-inbox",
        label: "Входящие",
        scope: "default",
        chords: [{ key: "i" }],
      },
      {
        id: "nav-mentions",
        label: "Упоминания",
        scope: "default",
        chords: [{ key: "m" }],
      },
      {
        id: "nav-starred",
        label: "Отмеченные",
        scope: "default",
        chords: [{ key: "s" }],
      },
      {
        id: "nav-drafts",
        label: "Черновики",
        scope: "default",
        chords: [{ key: "d" }],
      },
    ],
  },
];

/**
 * Look up an entry by id — for the keyboard-shortcut hook that wants
 * to bind a handler to the same chord the help overlay advertises.
 */
export function shortcutById(id: string): ShortcutEntry | undefined {
  for (const group of KEYMAP) {
    for (const entry of group.entries) {
      if (entry.id === id) {
        return entry;
      }
    }
  }
  return undefined;
}
