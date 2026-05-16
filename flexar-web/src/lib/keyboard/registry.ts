// Keyboard shortcut registry — runtime side of `keymap.ts`.
//
// One document-level `keydown` listener (lazily installed on the first
// subscription, removed on the last) routes events to handlers that
// `useKeyboardShortcut` registers. Handlers are stacked LIFO so a
// freshly-mounted modal's `Escape` handler beats the global one without
// either side having to know about the other.
//
// `Escape` matches first against the LIFO stack (closest overlay wins);
// other chords iterate the stack but always call all matching handlers
// in stack order — this means the order of "ambient" shortcut consumers
// (compose, feed, sidebar) doesn't matter, while overlay-scoped
// shortcuts still get first dibs.
//
// Scope handling: handlers registered as `scope: "default"` are skipped
// when the active element is an editable element (textarea, text-like
// input, contenteditable). `scope: "global"` always fires — used by
// the help overlay (`?`), the search focus (`Cmd/Ctrl+K`), and
// `Escape`.

import {
  KEYMAP,
  matchesShortcut,
  shortcutById,
  type ShortcutEntry,
  type ShortcutScope,
} from "./keymap";

export type ShortcutHandler = (event: KeyboardEvent) => void;

interface Subscription {
  /** Entry id from KEYMAP. */
  id: string;
  /** Resolved entry — cached to spare a lookup per event. */
  entry: ShortcutEntry;
  /** The user handler. */
  handler: ShortcutHandler;
}

// LIFO stack so the latest mount wins for stop-on-first chords like
// Escape. `push` on subscribe, splice-by-identity on unsubscribe.
const subscriptions: Subscription[] = [];

// The single keydown listener is installed on the first subscription
// and removed on the last; this keeps the module a no-op in tests that
// don't use shortcuts.
let listenerInstalled = false;

function installListenerIfNeeded(): void {
  if (listenerInstalled || typeof window === "undefined") {
    return;
  }
  window.addEventListener("keydown", dispatch);
  listenerInstalled = true;
}

function uninstallListenerIfEmpty(): void {
  if (!listenerInstalled || subscriptions.length > 0) {
    return;
  }
  window.removeEventListener("keydown", dispatch);
  listenerInstalled = false;
}

/**
 * Subscribe `handler` to the shortcut entry `id`. Returns an
 * unsubscribe function. Throws synchronously if `id` is unknown — that
 * way a typo surfaces at component-mount time, not silently.
 */
export function subscribeShortcut(
  id: string,
  handler: ShortcutHandler,
): () => void {
  const entry = shortcutById(id);
  if (entry === undefined) {
    throw new Error(`Unknown keyboard shortcut id: "${id}"`);
  }
  const sub: Subscription = { id, entry, handler };
  subscriptions.push(sub);
  installListenerIfNeeded();
  return () => {
    const index = subscriptions.indexOf(sub);
    if (index >= 0) {
      subscriptions.splice(index, 1);
    }
    uninstallListenerIfEmpty();
  };
}

/**
 * True when the keyboard event's target is something that types text —
 * a `<textarea>`, a text-like `<input>`, or any contenteditable element.
 * `select` / `checkbox` / `radio` / `button` `<input>`s are *not*
 * editable in this sense, so j/k still works on a focused checkbox.
 */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }
  if (target instanceof HTMLTextAreaElement) {
    return true;
  }
  if (target instanceof HTMLInputElement) {
    // The set of `<input>` types that accept free-form text. Anything
    // else (button, checkbox, radio, range, color, file, …) is not a
    // typing target.
    const type = target.type.toLowerCase();
    return TEXTLIKE_INPUT_TYPES.has(type);
  }
  if (target instanceof HTMLElement && target.isContentEditable) {
    return true;
  }
  return false;
}

const TEXTLIKE_INPUT_TYPES = new Set<string>([
  "text",
  "search",
  "email",
  "url",
  "tel",
  "password",
  "number",
  "date",
  "datetime-local",
  "month",
  "time",
  "week",
]);

/**
 * Decide whether a subscription whose entry has the given scope should
 * fire for an event whose target is `target`.
 */
function scopeAllows(scope: ShortcutScope, target: EventTarget | null): boolean {
  if (scope === "global") {
    return true;
  }
  return !isEditableTarget(target);
}

/**
 * Internal keydown handler — exposed for tests that don't want to
 * synthesise real DOM events. The public seam is `subscribeShortcut`.
 */
export function dispatch(event: KeyboardEvent): void {
  // Walk LIFO so the most-recently-mounted handler wins for stop-on-
  // first chords (Escape). For non-Escape chords we still call every
  // matching handler, in LIFO order, so independent features (sidebar,
  // feed, compose) can each subscribe to disjoint ids without
  // accidentally blocking one another.
  for (let i = subscriptions.length - 1; i >= 0; i--) {
    const { entry, handler } = subscriptions[i];
    if (!scopeAllows(entry.scope, event.target)) {
      continue;
    }
    const matched = entry.chords.some((chord) => matchesShortcut(event, chord));
    if (!matched) {
      continue;
    }
    handler(event);
    // Escape is exclusive — first match consumes it. Otherwise we
    // would close two stacked overlays at once. Other chords are
    // pass-through because each id has at most one registered
    // handler in practice; if a future feature wants exclusivity it
    // can call `event.stopPropagation()` itself.
    if (event.defaultPrevented || entry.id === "escape") {
      return;
    }
  }
}

/**
 * Test-only: reset the registry. Used by unit tests to keep state
 * isolated between cases. Not exported through the barrel.
 */
export function _resetForTests(): void {
  subscriptions.length = 0;
  if (listenerInstalled && typeof window !== "undefined") {
    window.removeEventListener("keydown", dispatch);
  }
  listenerInstalled = false;
}

/**
 * Test-only: peek at the current subscription count. Used to assert
 * lifecycle (install/uninstall, no leaks).
 */
export function _subscriptionCount(): number {
  return subscriptions.length;
}

// Re-export KEYMAP for convenience in callers that want both the
// registry and the catalogue from one import.
export { KEYMAP };
