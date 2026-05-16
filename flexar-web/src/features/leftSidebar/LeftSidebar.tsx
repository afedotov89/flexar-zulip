// The left navigation sidebar (Phase 1.5).
//
// The app shell's left column: a filter input over three collapsible
// sections — VIEWS (built-in views), Direct messages, and Channels
// (each channel with its unread topics nested). It composes the UI
// primitives (`Input`, `ScrollArea`, `Skeleton`, `IconButton`, …) and
// this feature's own subcomponents, wired to the Phase 1.3 server-state
// stores and the Phase 1.4 narrow hooks.
//
// State owned here:
//   - which of the three sections are expanded (section collapse);
//   - the filter query, applied live to the DM and channel lists.
// Per-channel topic-list collapse lives in `ChannelsSection`.
//
// Data states:
//   - loading  — stores not hydrated yet (no register snapshot): the
//                sections are replaced with skeleton rows.
//   - empty    — handled inside each section (no DMs, no channels, or
//                a filter that matches nothing).
//   - populated — the normal case.

import { useState } from "react";
import { Input } from "../../components/Input";
import { ScrollArea } from "../../components/ScrollArea";
import { Skeleton } from "../../components/Skeleton";
import { ChannelsSection } from "./ChannelsSection";
import { DirectMessagesSection } from "./DirectMessagesSection";
import { ViewsSection } from "./ViewsSection";
import { useStoresLoading } from "../../lib/hooks/useRealtimeStatus";
import { useStreamsStore } from "../../stores/streamsStore";
import styles from "./LeftSidebar.module.css";

// The three collapsible sections, for the section-expanded state map.
type SectionId = "views" | "dms" | "channels";

// A handful of skeleton rows shown while the stores hydrate.
function LoadingRows(): React.JSX.Element {
  return (
    <div className={styles.loading} aria-hidden="true">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Skeleton key={i} variant="text" width="full" height="md" />
      ))}
    </div>
  );
}

export function LeftSidebar(): React.JSX.Element {
  // Show skeletons only while BOTH conditions hold: realtime hasn't
  // hydrated yet AND the streams cache is empty. `useStreamsStore`
  // persists to localStorage (Phase 2-redesign), so after a hard
  // reload the cached channels render immediately while the realtime
  // register catches up in the background.
  const realtimeLoading = useStoresLoading();
  const streamsCount = useStreamsStore(
    (s) => Object.keys(s.subscriptions).length,
  );
  const loading = realtimeLoading && streamsCount === 0;

  // Every section starts expanded.
  const [expanded, setExpanded] = useState<Record<SectionId, boolean>>({
    views: true,
    dms: true,
    channels: true,
  });

  function toggleSection(id: SectionId): void {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  // The raw filter text; sections receive it lowercased for matching.
  const [filter, setFilter] = useState("");
  const filterQuery = filter.trim().toLowerCase();

  return (
    <nav className={styles.sidebar} aria-label="Каналы и навигация">
      <div className={styles.filter}>
        <Input
          type="search"
          size="sm"
          iconLeft="search"
          placeholder="Фильтр"
          aria-label="Фильтр каналов и личных сообщений"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          disabled={loading}
        />
      </div>

      <ScrollArea className={styles.scroll}>
        {loading ? (
          <LoadingRows />
        ) : (
          <div className={styles.sections}>
            <ViewsSection
              expanded={expanded.views}
              onToggle={() => toggleSection("views")}
            />
            <DirectMessagesSection
              expanded={expanded.dms}
              onToggle={() => toggleSection("dms")}
              filterQuery={filterQuery}
            />
            <ChannelsSection
              expanded={expanded.channels}
              onToggle={() => toggleSection("channels")}
              filterQuery={filterQuery}
            />
          </div>
        )}
      </ScrollArea>
    </nav>
  );
}
