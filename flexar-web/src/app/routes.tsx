// Flexar Hub Web — route table (Phase 0.5; auth in 1.1, narrow in 1.4;
// code-split lazy routes in 6.6).
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
//
// ── Code-splitting (6.6) ───────────────────────────────────────────
//
// The whole admin section, personal settings, channel browse/detail,
// and the dev-only showcase pages are imported through `React.lazy`
// so their JS doesn't ship in the first bundle. The everyday surfaces
// (Feed / Login / NotFound) stay eagerly imported — they're the ones
// the user lands on every session and a perceptible Suspense fallback
// would hurt rather than help. The lazy chunks render through a
// single `<RouteFallback />` while their JS loads.

import { lazy, Suspense } from "react";
import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "./AppShell";
import { RequireAuth } from "./RequireAuth";
import { RequireAdmin } from "./RequireAdmin";
import { Feed } from "../pages/Feed";
import { LoginPage } from "../pages/LoginPage";
import { NotFound } from "../pages/NotFound";
import { Spinner } from "../components/Spinner";
import { NARROW_ROOT, SPECIAL_VIEWS } from "../lib/narrow";
import styles from "./routes.module.css";

// Each `lazy(() => import(...))` becomes its own webpack/Vite chunk.
// Keep one lazy import per page module so the chunk graph is
// predictable; bundle analyzer expects this 1:1 shape.
const Channels = lazy(() =>
  import("../pages/Channels").then((m) => ({ default: m.Channels })),
);
const ChannelDetail = lazy(() =>
  import("../pages/Channels/ChannelDetail").then((m) => ({
    default: m.ChannelDetail,
  })),
);
const Settings = lazy(() =>
  import("../pages/Settings").then((m) => ({ default: m.Settings })),
);
const AdminOrganization = lazy(() =>
  import("../pages/Admin/AdminOrganization").then((m) => ({
    default: m.AdminOrganization,
  })),
);
const AdminUsers = lazy(() =>
  import("../pages/Admin/AdminUsers").then((m) => ({ default: m.AdminUsers })),
);
const AdminInvites = lazy(() =>
  import("../pages/Admin/AdminInvites").then((m) => ({
    default: m.AdminInvites,
  })),
);
const TokenShowcase = lazy(() =>
  import("../pages/TokenShowcase").then((m) => ({ default: m.TokenShowcase })),
);
const PrimitivesShowcase = lazy(() =>
  import("../pages/PrimitivesShowcase").then((m) => ({
    default: m.PrimitivesShowcase,
  })),
);

// The fallback shown while a lazy page chunk is in flight. Single
// centered spinner — kept simple so any page can swap in without
// looking weird, and the load is usually too fast to be visible
// anyway.
function RouteFallback(): React.JSX.Element {
  return (
    <div className={styles.fallback}>
      <Spinner size="md" aria-label="Загрузка раздела" />
    </div>
  );
}

// Helper: wrap a lazy element in <Suspense>. Used by every lazy
// route below so the Suspense boundary is local — a chunk-load delay
// in /settings doesn't hold up /admin.
function lazyRoute(element: React.JSX.Element): React.JSX.Element {
  return <Suspense fallback={<RouteFallback />}>{element}</Suspense>;
}

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
          { path: "settings", element: lazyRoute(<Settings />) },
          // Browse channels (Phase 5.5).
          { path: "channels", element: lazyRoute(<Channels />) },
          // Channel detail / management (Phase 5.3).
          { path: "channels/:id", element: lazyRoute(<ChannelDetail />) },
          // Admin section — gated by RequireAdmin (Phase 5.2/5.3/5.4).
          {
            path: "admin",
            element: <RequireAdmin />,
            children: [
              {
                path: "organization",
                element: lazyRoute(<AdminOrganization />),
              },
              { path: "users", element: lazyRoute(<AdminUsers />) },
              { path: "invites", element: lazyRoute(<AdminInvites />) },
            ],
          },
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
    element: lazyRoute(<TokenShowcase />),
  },
  {
    path: "/primitives",
    element: lazyRoute(<PrimitivesShowcase />),
  },
  {
    path: "*",
    element: <NotFound />,
  },
]);
