// Flexar Hub Web — route table (Phase 0.5, auth added in Phase 1.1).
//
// Routing skeleton:
//   /            -> RequireAuth guard; when authenticated renders the
//                   AppShell layout, whose index is the Feed placeholder.
//                   When not, the guard redirects to /login.
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
// The two showcase routes are dev-only witness pages and stay outside
// the auth guard on purpose, so the primitive library remains reachable
// for browser-testing without a session.

import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "./AppShell";
import { RequireAuth } from "./RequireAuth";
import { Feed } from "../pages/Feed";
import { LoginPage } from "../pages/LoginPage";
import { NotFound } from "../pages/NotFound";
import { TokenShowcase } from "../pages/TokenShowcase";
import { PrimitivesShowcase } from "../pages/PrimitivesShowcase";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [{ index: true, element: <Feed /> }],
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
