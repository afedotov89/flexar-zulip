// Flexar Hub Web — typed navigation to a narrow or built-in view.
//
// The write side of the narrow↔URL contract. The left sidebar and the
// message feed call these to move the app to a different narrow or
// view, without assembling URL paths by hand.
//
// Thin wrapper over React Router's `useNavigate`: `narrowToPath` (or
// the registry's precomputed view path) plus a `navigate` call.

import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import type { Narrow } from "../../domain";
import type { BuiltinView } from "./builtinViews";
import { narrowToPath } from "./scheme";

/** Imperative navigators for narrows and built-in views. */
export interface NarrowNavigation {
  /** Navigate to an arbitrary narrow (channel, topic, DM, search…). */
  goToNarrow: (narrow: Narrow) => void;
  /** Navigate to a built-in view — narrow-backed or a special screen. */
  goToView: (view: BuiltinView) => void;
}

/**
 * Returns stable navigators for narrows and built-in views.
 *
 * Channel narrows serialise with bare ids; if a readable
 * `channel/7-general` slug is wanted, the caller is the right place to
 * resolve it (it has the streams store) — pass the result through
 * `goToNarrow` after building the narrow, or extend this hook via the
 * orchestrator if a shared resolver is needed.
 */
export function useNarrowNavigation(): NarrowNavigation {
  const navigate = useNavigate();

  const goToNarrow = useCallback(
    (narrow: Narrow) => {
      navigate(narrowToPath(narrow));
    },
    [navigate],
  );

  const goToView = useCallback(
    (view: BuiltinView) => {
      navigate(view.path);
    },
    [navigate],
  );

  return { goToNarrow, goToView };
}
