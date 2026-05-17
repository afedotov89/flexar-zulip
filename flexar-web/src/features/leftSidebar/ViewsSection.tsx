// The VIEWS section of the left sidebar (Phase 1.5, completed in 1.5a).
//
// Lists the fixed built-in views from `src/lib/narrow` — Inbox, Recent,
// Combined feed, Mentions, Reactions, Starred, Drafts — as navigation
// rows. The active view is highlighted via `useCurrentView`; clicking a
// row navigates through the typed router path (`view.path`).
//
// Unread counts: the bucketed unread store gives a reliable *total*
// unread count (the Combined feed badge) and, since 1.5a, a `mentions`
// bucket count (the Mentions badge). The other views have no unread
// concept — Starred in particular is not an "unread" notion — so they
// render without a badge.
//
// Icons: each view carries an `icon` name from the Flexar Hub icon set
// (`src/icons/`), rendered in the row's leading slot so the VIEWS rows
// align with the icon-bearing channel rows below.

import { BUILTIN_VIEWS, useCurrentView } from "../../lib/narrow";
import { useUnreadStore } from "../../stores/unreadStore";
import { Icon } from "../../components/Icon";
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
  const mentionsCount = useUnreadStore((s) => s.getMentionsCount());

  return (
    <SidebarSection title="Виды" expanded={expanded} onToggle={onToggle}>
      {BUILTIN_VIEWS.map((view) => {
        // The Combined feed shows the grand-total unread badge and
        // Mentions shows its own bucket count. Other views have no
        // unread concept and render badge-less.
        let unreadCount = 0;
        if (view.id === "combined") {
          unreadCount = totalUnread;
        } else if (view.id === "mentions") {
          unreadCount = mentionsCount;
        }
        return (
          <NavRow
            key={view.id}
            to={view.path}
            label={view.label}
            leading={<Icon name={view.icon} size="sm" />}
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
