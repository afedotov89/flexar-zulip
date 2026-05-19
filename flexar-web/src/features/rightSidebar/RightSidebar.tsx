// The right contextual sidebar (Phase 1.8).
//
// The app shell's right column: a filter input over a scrolling stack
// of people sections. What sections appear is driven by the current
// narrow (`useCurrentNarrow` → `resolveRightSidebarContext`):
//
//   - viewing a channel (channel or channel+topic narrow) → a "this
//     channel" section listing that channel's subscribers, above the
//     full organization directory;
//   - viewing a DM → a "this conversation" section listing the DM's
//     participants, above the full directory;
//   - anywhere else (combined feed, special views, search, a
//     malformed narrow) → just the full organization directory.
//
// All visible sections share one live, client-side name filter.
//
// ── Data sources ────────────────────────────────────────────────────
//
// People come from `usersStore`; their presence dots from
// `presenceStore` (subscribed to the `presences` map so a presence
// event re-renders the lists). Channel subscribers come from the
// viewer's `Subscription.subscribers` (or `partial_subscribers` for
// very large channels) in `streamsStore` — i.e. the register
// snapshot's subscriber data; ids are resolved to people through
// `usersStore`. A channel the viewer is not subscribed to, or one
// whose snapshot carried no subscriber list, shows an empty contextual
// section rather than a wrong one.
//
// State owned here: the filter query. Ordering and filtering are the
// pure `userList` helpers; narrow → context resolution is the pure
// `narrowContext` helper — both unit-tested separately.

import { useMemo, useState } from "react";
import type { User } from "../../domain";
import { useCurrentNarrow } from "../../lib/narrow";
import { presenceStatus } from "../../lib/presence";
import { usePresenceStore } from "../../stores/presenceStore";
import { useStreamsStore } from "../../stores/streamsStore";
import { useUsersStore } from "../../stores/usersStore";
import { Input } from "../../components/Input";
import { ScrollArea } from "../../components/ScrollArea";
import { Skeleton } from "../../components/Skeleton";
import { resolveRightSidebarContext } from "./narrowContext";
import { UserSection } from "./UserSection";
import { filterUsers, orderUsers } from "./userList";
import { useStoresLoading } from "../../lib/hooks/useRealtimeStatus";
import styles from "./RightSidebar.module.css";

// A handful of skeleton rows shown while the stores hydrate.
function LoadingRows(): React.JSX.Element {
  return (
    <div className={styles.loading} aria-hidden="true">
      {[0, 1, 2, 3, 4, 5].map((index) => (
        <Skeleton key={index} variant="text" width="full" height="md" />
      ))}
    </div>
  );
}

export function RightSidebar(): React.JSX.Element {
  // The whole user directory and presence map — subscribed as the
  // stable store objects, so a `realm_user` / `presence` event
  // re-renders without the selector looping the store.
  const users = useUsersStore((state) => state.users);
  // Show skeletons only while BOTH conditions hold: realtime hasn't
  // hydrated AND the users cache is empty. `useUsersStore` persists
  // to localStorage (Phase 2-redesign), so a hard reload renders the
  // cached directory immediately while register catches up.
  const realtimeLoading = useStoresLoading();
  const loading = realtimeLoading && Object.keys(users).length === 0;
  const presences = usePresenceStore((state) => state.presences);
  const getPresence = usePresenceStore((state) => state.getPresence);
  const getSubscription = useStreamsStore((state) => state.getSubscription);

  const currentNarrow = useCurrentNarrow();
  const context = useMemo(
    () => resolveRightSidebarContext(currentNarrow),
    [currentNarrow],
  );

  // The raw filter text; the pure `filterUsers` helper trims and
  // lowercases it.
  const [filter, setFilter] = useState("");

  // Resolve a user id to its coarse presence status, against the
  // current wall clock. Recomputed when the presence map changes so
  // ordering reflects live presence; `Date.now()` is read fresh on
  // each render — presence dots elsewhere do the same.
  const presenceStatusOf = useMemo(() => {
    const now = Date.now() / 1000;
    return (userId: number) => presenceStatus(presences[userId], now);
  }, [presences]);

  // The full organization directory, ordered then filtered.
  const directoryEntries = useMemo(() => {
    const ordered = orderUsers(Object.values(users), presenceStatusOf);
    return filterUsers(ordered, filter);
  }, [users, presenceStatusOf, filter]);

  // The contextual section's people — channel subscribers or DM
  // participants — resolved from the narrow context, then ordered and
  // filtered the same way. `undefined` means "no contextual section".
  const contextEntries = useMemo(() => {
    let contextUsers: User[];
    if (context.kind === "channel") {
      const subscription = getSubscription(context.streamId);
      const subscriberIds =
        subscription?.subscribers ??
        subscription?.partial_subscribers ??
        [];
      contextUsers = subscriberIds
        .map((id) => users[id])
        .filter((user): user is User => user !== undefined);
    } else if (context.kind === "dm") {
      contextUsers = context.participantIds
        .map((id) => users[id])
        .filter((user): user is User => user !== undefined);
    } else {
      return undefined;
    }
    const ordered = orderUsers(contextUsers, presenceStatusOf);
    return filterUsers(ordered, filter);
  }, [context, users, getSubscription, presenceStatusOf, filter]);

  return (
    <div className={styles.sidebar}>
      <div className={styles.filter}>
        <Input
          type="search"
          size="sm"
          iconLeft="search"
          placeholder="Имя или email"
          aria-label="Фильтр участников по имени или email"
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
            {context.kind === "channel" && contextEntries !== undefined && (
              <UserSection
                title="В этом канале"
                entries={contextEntries}
                getPresence={getPresence}
                emptyLabel={
                  filter.trim() === ""
                    ? "Нет данных об участниках канала"
                    : "Ничего не найдено"
                }
              />
            )}
            {context.kind === "dm" && contextEntries !== undefined && (
              <UserSection
                title="В этом разговоре"
                entries={contextEntries}
                getPresence={getPresence}
                emptyLabel={
                  filter.trim() === ""
                    ? "Нет участников"
                    : "Ничего не найдено"
                }
              />
            )}
            <UserSection
              title="Участники организации"
              entries={directoryEntries}
              getPresence={getPresence}
              emptyLabel={
                Object.keys(users).length === 0
                  ? "Нет участников"
                  : "Ничего не найдено"
              }
            />
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
