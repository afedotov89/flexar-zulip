// Flexar Hub Web — the centre-column page (Phase 1.6).
//
// The route element rendered into the app-shell's centre `<Outlet />`
// for the index route, every `/narrow/*` route, and the special-view
// routes (`/inbox`, `/recent`, `/drafts`).
//
// Two branches:
//   - a *special view* (Inbox / Recent / Drafts) — not a narrow feed.
//     Its dedicated screen is out of Phase 1.6's scope; a placeholder
//     stands in. `useCurrentView()` returns the `SpecialView` for
//     those routes.
//   - everything else — a narrow feed. `useCurrentNarrow()` gives the
//     narrow for `/narrow/*` routes; the index route `/` is not a
//     narrow path, so it falls back to the empty narrow (the Combined
//     feed), which is the natural landing view.
//
// The narrow feed itself is the `messageFeed` feature.

import type { Narrow } from "../../domain";
import { useCurrentNarrow, useCurrentView } from "../../lib/narrow";
import { MessageFeed } from "../../features/messageFeed";
import { Drafts } from "../Drafts";
import { Scheduled } from "../Scheduled";
import styles from "./Feed.module.css";

// The Combined-feed narrow, as a module constant so the index route
// passes a stable reference (a fresh `[]` each render would re-trigger
// the feed window's narrow-keyed fetch effect).
const COMBINED_FEED_NARROW: Narrow = [];

export function Feed() {
  const view = useCurrentView();
  const narrow = useCurrentNarrow();

  // Special views (Inbox / Recent / Drafts / Scheduled) are not narrow
  // feeds. Drafts (Phase 2.4) and Scheduled (Phase 4.5) have their own
  // screens; Inbox / Recent are still placeholders pending their own
  // phases.
  if (view?.kind === "special") {
    if (view.id === "drafts") {
      return <Drafts />;
    }
    if (view.id === "scheduled") {
      return <Scheduled />;
    }
    return (
      <div className={styles.feed}>
        <span className={styles.placeholderLabel}>Раздел скоро появится</span>
      </div>
    );
  }

  // Narrow routes carry their narrow in the URL; the index route `/`
  // has no narrow path and lands on the Combined feed (the empty
  // narrow).
  return <MessageFeed narrow={narrow ?? COMBINED_FEED_NARROW} />;
}
