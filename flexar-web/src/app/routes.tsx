// Flexar Hub Web — route table (Phase 0.5; auth in 1.1, narrow in 1.4).
//
// Routing skeleton:
//   /            -> RequireAuth guard; when authenticated renders the
//                   AppShell layout, whose index is the Feed placeholder.
//                   When not, the guard redirects to /login.
//   /narrow/*    -> a narrow-addressed view inside the AppShell layout.
//                   The whole trailing path is a narrow path (see
//                   `src/lib/narrow` for the scheme); the center column
//                   renders the Feed, which reads the narrow off the URL
//                   via `useCurrentNarrow` (Phase 1.6 wires its guts).
//   /inbox       -> the Inbox special view, inside the AppShell layout.
//   /recent      -> the Recent special view, inside the AppShell layout.
//   /drafts      -> the Drafts special view, inside the AppShell layout.
//                   These three are *special views*, not narrows (see
//                   `src/lib/narrow/builtinViews`); for now each renders
//                   the Feed placeholder, to be replaced with its own
//                   screen in a later phase.
//   /login       -> LoginPage. A standalone full-page screen outside the
//                   AppShell layout. Redirects to / when already signed
//                   in (Phase 1.1).
//   /showcase    -> the Phase 0.2 TokenShowcase, kept reachable. It is a
//                   standalone full-page component (its own 100vh page
//                   chrome), so it lives OUTSIDE the AppShell layout
//                   rather than inside the center column.
//   /primitives  -> the Phase 0.6 PrimitivesShowcase, same treatment as
//                   /showcase: a standalone full-page witness component
//                   outside the AppShell layout.
//
// The narrow and special-view route paths are kept in sync with the
// `src/lib/narrow` scheme: `NARROW_ROOT` for the narrow space, and the
// special views' `path` fields from the built-in view registry.
//
// The two showcase routes are dev-only witness pages and stay outside
// the auth guard on purpose, so the primitive library remains reachable
// for browser-testing without a session.

import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "./AppShell";
import { RequireAuth } from "./RequireAuth";
import { Feed } from "../pages/Feed";
import { LoginPage } from "../pages/LoginPage";
import { NotFound } from "../pages/NotFound";
import { Channels } from "../pages/Channels";
import { Settings } from "../pages/Settings";
import { TokenShowcase } from "../pages/TokenShowcase";
import { PrimitivesShowcase } from "../pages/PrimitivesShowcase";
import { NARROW_ROOT, SPECIAL_VIEWS } from "../lib/narrow";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <Feed /> },
          // The whole narrow path lives under NARROW_ROOT as a splat;
          // the Feed reads and parses it via `useCurrentNarrow`.
          { path: `${NARROW_ROOT.slice(1)}/*`, element: <Feed /> },
          // Special (non-narrow) built-in views: Inbox / Recent /
          // Drafts. Each renders the Feed placeholder for now.
          ...SPECIAL_VIEWS.map((view) => ({
            path: view.path.slice(1),
            element: <Feed />,
          })),
          // Personal settings (Phase 5.1).
          { path: "settings", element: <Settings /> },
          // Browse channels (Phase 5.5).
          { path: "channels", element: <Channels /> },
        ],
      },
    ],
  },
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/showcase",
    element: <TokenShowcase />,
  },
  {
    path: "/primitives",
    element: <PrimitivesShowcase />,
  },
  {
    path: "*",
    element: <NotFound />,
  },
]);
