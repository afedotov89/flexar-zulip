// Flexar Hub Web — Drafts page (Phase 2.4).
//
// The dedicated screen for the Drafts special view (`/drafts`). Lists
// every locally saved compose draft, recency-desc, and lets the user
// either jump back into a draft's conversation (where the compose box
// restores its content) or delete the draft outright.
//
// Data source: `useDraftsStore` (local-only — drafts never round-trip
// through the server). Destination labels resolve through
// `useStreamsStore` / `useUsersStore` for human-readable names.
//
// Click semantics: clicking the row body navigates to the destination's
// narrow via `useNarrowNavigation`. The compose box mounted on that
// page picks the draft up from the store on its mount/narrow effect
// (see `ComposeBox`'s restoration logic). The delete control is its
// own button so the click does not bubble through the row.
//
// Accessibility: the list is a real `<ul>` of `<li>` rows; each row's
// open action is a `<button>` (no surrounding link), so keyboard focus
// and screen readers see two distinct controls per row — "open" and
// "delete this draft".

import { useCallback, useMemo } from "react";
import { IconButton } from "../../components/IconButton";
import type { Narrow, UserId } from "../../domain";
import { useNarrowNavigation } from "../../lib/narrow";
import {
  useDraftsStore,
  type Draft,
  type DraftDestination,
} from "../../stores/draftsStore";
import { useStreamsStore } from "../../stores/streamsStore";
import { useUsersStore } from "../../stores/usersStore";
import styles from "./Drafts.module.css";

/** Maximum characters of body shown in the row preview. */
const PREVIEW_CHARS = 100;

export function Drafts(): React.JSX.Element {
  // Subscribe to the underlying map so a save/delete re-renders this
  // page; `listDrafts()` is a derived view computed once per render.
  const draftsMap = useDraftsStore((s) => s.drafts);
  const deleteDraftAction = useDraftsStore((s) => s.deleteDraft);
  // Subscribe to the underlying maps so the destination label re-renders
  // once the stores hydrate after a cold load. Selecting only the action
  // function (`getStream`/`getUser`) gives a stable reference that does
  // NOT re-render on store changes — the labels would freeze on the
  // fallback ("Channel {id}" / "User {id}") snapshotted at first paint.
  const streamsMap = useStreamsStore((s) => s.streams);
  const usersMap = useUsersStore((s) => s.users);
  const getStream = useCallback(
    (id: number): { name: string } | undefined => streamsMap[id],
    [streamsMap],
  );
  const getUser = useCallback(
    (id: number): { full_name: string } | undefined => usersMap[id],
    [usersMap],
  );
  const { goToNarrow } = useNarrowNavigation();

  const drafts = useMemo(
    () =>
      Object.values(draftsMap).sort((a, b) => {
        if (b.updatedAt !== a.updatedAt) {
          return b.updatedAt - a.updatedAt;
        }
        return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
      }),
    [draftsMap],
  );

  if (drafts.length === 0) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyTitle}>No drafts yet</p>
        <p className={styles.emptyHint}>
          Drafts you start in a conversation will appear here so you can
          finish them later.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.drafts}>
      <h1 className={styles.heading}>Drafts</h1>
      <ul className={styles.list} aria-label="Drafts">
        {drafts.map((draft) => (
          <DraftRow
            key={draft.key}
            draft={draft}
            destinationLabel={describeDestination(
              draft.destination,
              getStream,
              getUser,
            )}
            preview={previewOf(draft.content)}
            onOpen={() => goToNarrow(narrowFor(draft.destination))}
            onDelete={() => deleteDraftAction(draft.key)}
          />
        ))}
      </ul>
    </div>
  );
}

interface DraftRowProps {
  draft: Draft;
  destinationLabel: string;
  preview: string;
  onOpen: () => void;
  onDelete: () => void;
}

function DraftRow({
  draft,
  destinationLabel,
  preview,
  onOpen,
  onDelete,
}: DraftRowProps): React.JSX.Element {
  return (
    <li className={styles.row}>
      <button
        type="button"
        className={styles.openButton}
        onClick={onOpen}
        aria-label={`Open draft for ${destinationLabel}`}
      >
        <span className={styles.destination}>{destinationLabel}</span>
        <span className={styles.preview}>{preview}</span>
        <span className={styles.timestamp}>
          {formatTimestamp(draft.updatedAt)}
        </span>
      </button>
      <IconButton
        icon="close"
        variant="ghost"
        size="sm"
        aria-label={`Delete draft for ${destinationLabel}`}
        onClick={onDelete}
        className={styles.deleteButton}
      />
    </li>
  );
}

// Render a one-line human label for the draft's destination. Channels
// and DM participants resolve through their respective stores; unknown
// ids fall back to a numeric placeholder so the row never looks broken.
function describeDestination(
  destination: DraftDestination,
  getStream: (id: number) => { name: string } | undefined,
  getUser: (id: UserId) => { full_name: string } | undefined,
): string {
  if (destination.type === "channel") {
    const channel =
      getStream(destination.streamId)?.name ??
      `Channel ${destination.streamId}`;
    if (destination.topic === "") {
      return `# ${channel}`;
    }
    return `# ${channel} > ${destination.topic}`;
  }
  const names = destination.recipientIds.map(
    (id) => getUser(id)?.full_name ?? `User ${id}`,
  );
  return `Direct message to: ${names.join(", ")}`;
}

// Build the narrow for a draft's destination so clicking the row lands
// the user in the same conversation context the draft was authored in.
function narrowFor(destination: DraftDestination): Narrow {
  if (destination.type === "channel") {
    if (destination.topic === "") {
      return [{ operator: "channel", operand: destination.streamId }];
    }
    return [
      { operator: "channel", operand: destination.streamId },
      { operator: "topic", operand: destination.topic },
    ];
  }
  return [
    { operator: "dm", operand: [...destination.recipientIds] },
  ];
}

// Trim the body to the preview length, collapsing whitespace so a
// multi-line draft renders on a single row without leaking newlines.
function previewOf(content: string): string {
  const collapsed = content.replace(/\s+/g, " ").trim();
  if (collapsed.length <= PREVIEW_CHARS) {
    return collapsed;
  }
  return `${collapsed.slice(0, PREVIEW_CHARS - 1)}…`;
}

// Render the timestamp as a localised short string. Recency is the
// primary signal here; absolute precision is not needed.
function formatTimestamp(updatedAtMs: number): string {
  return new Date(updatedAtMs).toLocaleString();
}
