// The VIEWS section of the left sidebar (Phase 1.5).
//
// Lists the fixed built-in views from `src/lib/narrow` — Inbox, Recent,
// Combined feed, Mentions, Reactions, Starred, Drafts — as navigation
// rows. The active view is highlighted via `useCurrentView`; clicking a
// row navigates through the typed router path (`view.path`).
//
// Unread counts: the bucketed unread store gives a reliable *total*
// unread count, which is what the Combined feed badge shows. The other
// views' badges (e.g. a Mentions-only count) would need buckets the
// store does not keep yet — see HANDOFF flags — so they render without
// a badge rather than with a wrong number.
//
// Icons: `src/icons/` has no glyphs for these seven views, and the icon
// set is frozen (orchestrator-owned). Rather than misuse unrelated
// icons, the rows render with an empty leading spacer so they still
// align with the icon-bearing channel rows below. A proper built-in-
// view icon set is flagged for the orchestrator.

import { BUILTIN_VIEWS, useCurrentView } from "../../lib/narrow";
import { useUnreadStore } from "../../stores/unreadStore";
import { NavRow } from "./NavRow";
import { SidebarSection } from "./SidebarSection";

export interface ViewsSectionProps {
  /** Whether the section is expanded. */
  expanded: boolean;
  /** Toggle the section's expanded state. */
  onToggle: () => void;
}

export function ViewsSection({
  expanded,
  onToggle,
}: ViewsSectionProps): React.JSX.Element {
  const currentView = useCurrentView();
  const totalUnread = useUnreadStore((s) => s.getUnreadCount());

  return (
    <SidebarSection title="Виды" expanded={expanded} onToggle={onToggle}>
      {BUILTIN_VIEWS.map((view) => {
        // Only the Combined feed shows the grand-total unread badge;
        // the other views need counts the store does not bucket yet.
        const unreadCount = view.id === "combined" ? totalUnread : 0;
        return (
          <NavRow
            key={view.id}
            to={view.path}
            label={view.label}
            selected={currentView?.id === view.id}
            unreadCount={unreadCount}
            unreadLabel={
              unreadCount > 0
                ? `${unreadCount} непрочитанных`
                : undefined
            }
          />
        );
      })}
    </SidebarSection>
  );
}
