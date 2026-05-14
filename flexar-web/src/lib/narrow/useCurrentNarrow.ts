// Flexar Hub Web — read the current narrow / built-in view from the URL.
//
// These hooks are the read side of the narrow↔URL contract: the
// message feed (Phase 1.6) and the left sidebar (Phase 1.5) call them
// to know what the URL currently addresses, without parsing paths
// themselves.
//
// They are thin wrappers over React Router's `useLocation`. Parsing is
// memoised on the pathname so consumers get a stable reference while
// the user stays on the same narrow.

import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import type { Narrow } from "../../domain";
import type { BuiltinView } from "./builtinViews";
import { BUILTIN_VIEWS } from "./builtinViews";
import { NARROW_ROOT, parseNarrowPath } from "./scheme";

// Match a pathname to a special (non-narrow) built-in view by its
// exact path. Narrow views are matched via `parseNarrowPath` instead,
// since they share the `/narrow/...` space.
function matchSpecialView(pathname: string): BuiltinView | undefined {
  return BUILTIN_VIEWS.find(
    (view) => view.kind === "special" && view.path === pathname,
  );
}

/**
 * The narrow the current URL addresses, or `undefined` when the URL is
 * not a narrow path (e.g. a special view like `/inbox`, or `/login`).
 *
 * A malformed `/narrow/...` path resolves to the empty narrow `[]`
 * (Combined feed) — the safe, always-valid fallback — rather than
 * `undefined`, so the feed still renders something for a user who
 * hand-edited the URL.
 */
export function useCurrentNarrow(): Narrow | undefined {
  const { pathname } = useLocation();
  return useMemo(() => {
    if (pathname !== NARROW_ROOT && !pathname.startsWith(`${NARROW_ROOT}/`)) {
      return undefined;
    }
    const result = parseNarrowPath(pathname);
    return result.ok ? result.narrow : [];
  }, [pathname]);
}

/**
 * The built-in view the current URL addresses, or `undefined` when the
 * URL is a narrow that is not one of the registered built-in views
 * (e.g. an arbitrary channel narrow), or not a view path at all.
 *
 * Narrow-backed built-in views are matched by deep-equality of their
 * narrow against the parsed URL narrow, so `/narrow/is/mentioned`
 * resolves to the Mentions view regardless of how it was reached.
 */
export function useCurrentView(): BuiltinView | undefined {
  const { pathname } = useLocation();
  return useMemo(() => {
    const special = matchSpecialView(pathname);
    if (special !== undefined) {
      return special;
    }
    if (pathname !== NARROW_ROOT && !pathname.startsWith(`${NARROW_ROOT}/`)) {
      return undefined;
    }
    const result = parseNarrowPath(pathname);
    if (!result.ok) {
      return undefined;
    }
    return BUILTIN_VIEWS.find(
      (view) =>
        view.kind === "narrow" && narrowsEqual(view.narrow, result.narrow),
    );
  }, [pathname]);
}

// Deep-equality for narrows: same terms, same order, same negation.
// Operands compared structurally so array operands (DM user-id lists)
// match by content.
function narrowsEqual(a: Narrow, b: Narrow): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return a.every((termA, i) => {
    const termB = b[i];
    if (
      termA.operator !== termB.operator ||
      Boolean(termA.negated) !== Boolean(termB.negated)
    ) {
      return false;
    }
    const opA = termA.operand;
    const opB = termB.operand;
    if (Array.isArray(opA) || Array.isArray(opB)) {
      return (
        Array.isArray(opA) &&
        Array.isArray(opB) &&
        opA.length === opB.length &&
        opA.every((v, j) => v === opB[j])
      );
    }
    return opA === opB;
  });
}
