// React hook: bind a callback to a registered shortcut id.
//
// One-line wrapper around `subscribeShortcut` that handles the React
// lifecycle (subscribe on mount, unsubscribe on unmount, re-subscribe
// when the id changes). The handler is held in a ref so callers don't
// need to memoise it — the registered subscription stays stable for
// the life of the mount, and always calls the latest callback.

import { useEffect, useRef } from "react";
import { subscribeShortcut, type ShortcutHandler } from "./registry";

export interface UseKeyboardShortcutOptions {
  /** When false, the subscription is skipped — for conditional gates. */
  enabled?: boolean;
}

export function useKeyboardShortcut(
  id: string,
  handler: ShortcutHandler,
  options: UseKeyboardShortcutOptions = {},
): void {
  const { enabled = true } = options;
  const handlerRef = useRef(handler);
  // Keep the ref fresh without re-subscribing: the registered fn always
  // calls the latest handler the caller passed.
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    return subscribeShortcut(id, (event) => {
      handlerRef.current(event);
    });
  }, [id, enabled]);
}
