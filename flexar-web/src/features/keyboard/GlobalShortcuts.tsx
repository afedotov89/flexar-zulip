// Mounts the global shortcuts that the AppShell owns: focus search
// (Cmd/Ctrl+K), open compose (`c`), and jump to built-in views
// (`i` / `m` / `s` / `d`).
//
// All of these are subscriptions only — the component renders nothing.
// `KeyboardHelpOverlay` lives next to it and owns its own `?` chord.
//
// Feature-local shortcuts (j/k on the message list, `r` for reply,
// `Escape` for popovers) are registered by the components that own
// the affected state, so they only fire when those components are on
// screen. This module covers the truly always-on ones.

import { useCallback } from "react";
import { useComposeFocusStore } from "../compose";
import { useSearchFocusStore } from "../search";
import {
  getBuiltinView,
  useNarrowNavigation,
  type BuiltinViewId,
} from "../../lib/narrow";
import { useKeyboardShortcut } from "../../lib/keyboard";

export function GlobalShortcuts(): null {
  const requestSearchFocus = useSearchFocusStore((s) => s.requestFocus);
  const requestComposeFocus = useComposeFocusStore((s) => s.requestFocus);
  const { goToView } = useNarrowNavigation();

  useKeyboardShortcut(
    "search",
    useCallback(
      (event: KeyboardEvent) => {
        // Browsers reserve Cmd/Ctrl+K for various UI surfaces (URL
        // bar in Chrome, etc.). Pre-empting here is fine because the
        // chord is global to our app.
        event.preventDefault();
        requestSearchFocus();
      },
      [requestSearchFocus],
    ),
  );

  useKeyboardShortcut(
    "compose",
    useCallback(
      (event: KeyboardEvent) => {
        // Stop the literal `c` from being typed if the textarea
        // somehow steals focus a frame later (shouldn't, but it's
        // cheap insurance and we don't want a phantom char).
        event.preventDefault();
        requestComposeFocus();
      },
      [requestComposeFocus],
    ),
  );

  // Narrow navigators — each fires a `goToView` to a built-in view.
  useNarrowNavShortcut("nav-inbox", "inbox", goToView);
  useNarrowNavShortcut("nav-mentions", "mentions", goToView);
  useNarrowNavShortcut("nav-starred", "starred", goToView);
  useNarrowNavShortcut("nav-drafts", "drafts", goToView);

  return null;
}

function useNarrowNavShortcut(
  shortcutId: string,
  viewId: BuiltinViewId,
  goToView: ReturnType<typeof useNarrowNavigation>["goToView"],
): void {
  useKeyboardShortcut(
    shortcutId,
    useCallback(() => {
      goToView(getBuiltinView(viewId));
    }, [viewId, goToView]),
  );
}
