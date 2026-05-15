// Flexar Hub Web — message actions dropdown (Phase 3.3).
//
// Wires the per-message hover-toolbar dots-vertical control to a
// `DropdownMenu` of actions. Five items in this phase, gated on
// ownership:
//
//   - Star / Unstar (label flips on the current `starred` flag)
//   - Copy link
//   - Mark unread
//   - Edit          (own messages only — `message.sender_id === viewerId`)
//   - Delete        (own messages only — danger styling)
//
// All write paths use the optimistic-then-REST pattern from
// `useReactionToggle` (Phase 3.2): apply the optimistic reducer first,
// fire the REST call, revert on failure. `onActionError` lets the
// parent (`MessageRow`) surface any failure as an inline `role="alert"`
// line near the toolbar.
//
// `Edit` and `Delete` are not network calls themselves — they switch
// the row into edit mode / open the confirm modal, both owned by the
// parent. The menu only emits the intent.
//
// PRD §8 / 3.3 lists more actions (View source, Move, Resolve topic,
// Quote and reply, …) — they are deliberately out of scope in this
// phase and tracked as a follow-up.

import { useCallback } from "react";
import { apiClient, isApiError } from "../../api";
import { DropdownMenu } from "../../components/DropdownMenu";
import { IconButton } from "../../components/IconButton";
import type { Message, UserId } from "../../domain";
import { useMessagesStore } from "../../stores/messagesStore";
import { useRealmStore } from "../../stores/realmStore";
import type {
  DropdownMenuEntry,
  DropdownMenuItem,
} from "../../components/DropdownMenu";
import { buildMessageLink } from "./messageLink";

export interface MessageActionsMenuProps {
  /** The message the menu acts on. */
  message: Message;
  /** Signed-in user's id, or `undefined` when the server did not report it. */
  viewerId: UserId | undefined;
  /** Switch the row into inline-edit mode. */
  onEditRequested: () => void;
  /** Open the delete confirmation modal. */
  onDeleteRequested: () => void;
  /** Surface a transient error (e.g. star/unstar / mark-unread REST failure). */
  onActionError: (message: string) => void;
  /** Surface a transient success notice (e.g. "Link copied"). */
  onActionNotice: (message: string) => void;
}

function describeError(error: unknown): string {
  if (isApiError(error)) {
    return error.body?.msg ?? error.message;
  }
  return error instanceof Error ? error.message : "Action failed.";
}

export function MessageActionsMenu({
  message,
  viewerId,
  onEditRequested,
  onDeleteRequested,
  onActionError,
  onActionNotice,
}: MessageActionsMenuProps): React.JSX.Element {
  const flags = useMessagesStore((s) => s.getFlags(message.id));
  const applyOptimisticFlag = useMessagesStore((s) => s.applyOptimisticFlag);
  const realmUrl = useRealmStore((s) => s.realm?.realm_url);

  const isStarred = flags.includes("starred");
  const isOwnMessage =
    viewerId !== undefined && message.sender_id === viewerId;

  const toggleFlag = useCallback(
    async (op: "add" | "remove", flag: string): Promise<void> => {
      const inverse: "add" | "remove" = op === "add" ? "remove" : "add";
      applyOptimisticFlag({ message_id: message.id, op, flag });
      try {
        await apiClient.updateMessageFlags({
          op,
          flag,
          messages: [message.id],
        });
      } catch (cause) {
        // Revert by running the inverse op through the same reducer.
        applyOptimisticFlag({
          message_id: message.id,
          op: inverse,
          flag,
        });
        onActionError(describeError(cause));
      }
    },
    [applyOptimisticFlag, message.id, onActionError],
  );

  const handleStarToggle = useCallback((): void => {
    void toggleFlag(isStarred ? "remove" : "add", "starred");
  }, [isStarred, toggleFlag]);

  const handleMarkUnread = useCallback((): void => {
    // Mark unread = remove the `read` flag. If the message isn't
    // currently read in the cache, the optimistic op is a no-op and
    // the server happily ignores it; either way the realtime event
    // arrives shortly after to reconcile.
    void toggleFlag("remove", "read");
  }, [toggleFlag]);

  const handleCopyLink = useCallback((): void => {
    const url = buildMessageLink(message, { realmUrl, viewerId });
    if (url === undefined) {
      onActionError("Could not build a link to this message.");
      return;
    }
    const clipboard = navigator.clipboard;
    if (clipboard === undefined) {
      // jsdom test runs and non-secure-context loads land here.
      onActionError("Clipboard is unavailable in this context.");
      return;
    }
    void clipboard
      .writeText(url)
      .then(() => onActionNotice("Link copied"))
      .catch((cause: unknown) => onActionError(describeError(cause)));
  }, [message, onActionError, onActionNotice, realmUrl, viewerId]);

  const items: DropdownMenuEntry[] = [];
  // Star/Unstar — single toggle item; label and icon flip on state.
  items.push({
    id: "star-toggle",
    label: isStarred ? "Unstar message" : "Star message",
    icon: "star",
    onSelect: handleStarToggle,
  });
  items.push({
    id: "copy-link",
    label: "Copy link to message",
    onSelect: handleCopyLink,
  });
  items.push({
    id: "mark-unread",
    label: "Mark as unread from here",
    onSelect: handleMarkUnread,
  });
  if (isOwnMessage) {
    items.push({ id: "sep-own", separator: true });
    items.push({
      id: "edit",
      label: "Edit message",
      onSelect: onEditRequested,
    } satisfies DropdownMenuItem);
    items.push({
      id: "delete",
      label: "Delete message",
      danger: true,
      onSelect: onDeleteRequested,
    } satisfies DropdownMenuItem);
  }

  return (
    <DropdownMenu
      trigger={
        <IconButton
          icon="dots-vertical"
          size="sm"
          variant="ghost"
          aria-label="More actions"
        />
      }
      items={items}
      placement="bottom"
      aria-label="Message actions"
    />
  );
}
