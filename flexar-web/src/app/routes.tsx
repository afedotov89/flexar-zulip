// Flexar Hub Web — route table (Phase 0.5).
//
// Minimal routing skeleton:
//   /            -> AppShell layout; index renders the Feed placeholder
//                   into the center <Outlet />.
//   /showcase    -> the Phase 0.2 TokenShowcase, kept reachable. It is a
//                   standalone full-page component (its own 100vh page
//                   chrome), so it lives OUTSIDE the AppShell layout
//                   rather than inside the center column.
//   /primitives  -> the Phase 0.6 PrimitivesShowcase, same treatment as
//                   /showcase: a standalone full-page witness component
//                   outside the AppShell layout.
//   *            -> NotFound placeholder.

import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "./AppShell";
import { Feed } from "../pages/Feed";
import { NotFound } from "../pages/NotFound";
import { TokenShowcase } from "../pages/TokenShowcase";
import { PrimitivesShowcase } from "../pages/PrimitivesShowcase";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [{ index: true, element: <Feed /> }],
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
