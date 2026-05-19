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
import { apiClient } from "../../api";
import { DropdownMenu } from "../../components/DropdownMenu";
import { IconButton } from "../../components/IconButton";
import type { Message, UserId } from "../../domain";
import { describeApiError } from "../../lib/errors";
import { useNarrowNavigation } from "../../lib/narrow";
import { useMessagesStore } from "../../stores/messagesStore";
import { useRealmStore } from "../../stores/realmStore";
import { useComposeFocusStore } from "../compose";
import { narrowForMessage } from "../messageFeed/narrowForMessage";
import type {
  DropdownMenuEntry,
  DropdownMenuItem,
} from "../../components/DropdownMenu";
import { buildMessageLink } from "./messageLink";
import { buildQuoteBlock } from "./quote";

export interface MessageActionsMenuProps {
  /** The message the menu acts on. */
  message: Message;
  /** Signed-in user's id, or `undefined` when the server did not report it. */
  viewerId: UserId | undefined;
  /** Switch the row into inline-edit mode. */
  onEditRequested: () => void;
  /** Open the delete confirmation modal. */
  onDeleteRequested: () => void;
  /** Open the edit-history modal (Phase 4.6). Only surfaced for edited messages. */
  onViewHistoryRequested: () => void;
  /** Surface a transient error (e.g. star/unstar / mark-unread REST failure). */
  onActionError: (message: string) => void;
  /** Surface a transient success notice (e.g. "Link copied"). */
  onActionNotice: (message: string) => void;
}

export function MessageActionsMenu({
  message,
  viewerId,
  onEditRequested,
  onDeleteRequested,
  onViewHistoryRequested,
  onActionError,
  onActionNotice,
}: MessageActionsMenuProps): React.JSX.Element {
  const flags = useMessagesStore((s) => s.getFlags(message.id));
  const applyOptimisticFlag = useMessagesStore((s) => s.applyOptimisticFlag);
  const realmUrl = useRealmStore((s) => s.realm?.realm_url);
  const allowEditing = useRealmStore(
    (s) => s.realm?.realm_allow_message_editing ?? true,
  );
  const editLimitSeconds = useRealmStore(
    (s) => s.realm?.realm_message_content_edit_limit_seconds ?? 0,
  );
  const isStarred = flags.includes("starred");
  const isOwnMessage =
    viewerId !== undefined && message.sender_id === viewerId;

  // The server enforces a per-realm content-edit window — and the
  // limit applies to everyone, admins included (only topic-only
  // edits have admin overrides on the Zulip side). Surface the same
  // rule in the menu so users don't get an "Время для редактирования
  // истекло" surprise after clicking Edit and waiting for the form
  // to load.
  //
  //   - `realm_allow_message_editing === false` → editing is off
  //     realm-wide, no matter who or when.
  //   - `realm_message_content_edit_limit_seconds === 0` → unlimited.
  //   - Otherwise → must be within the window from the message's
  //     send timestamp.
  const withinEditWindow =
    editLimitSeconds === 0 ||
    Date.now() / 1000 - message.timestamp <= editLimitSeconds;
  const canEdit = isOwnMessage && allowEditing && withinEditWindow;

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
        onActionError(describeApiError(cause));
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
      onActionError("Не удалось построить ссылку на сообщение.");
      return;
    }
    const clipboard = navigator.clipboard;
    if (clipboard === undefined) {
      // jsdom test runs and non-secure-context loads land here.
      onActionError("Буфер обмена недоступен в этом контексте.");
      return;
    }
    void clipboard
      .writeText(url)
      .then(() => onActionNotice("Ссылка скопирована"))
      .catch((cause: unknown) => onActionError(describeApiError(cause)));
  }, [message, onActionError, onActionNotice, realmUrl, viewerId]);

  // Quote-and-reply: fetch the Markdown source of the message, build
  // the Zulip-flavored quote block, navigate to the message's narrow,
  // and seed the compose textarea via `composeFocusSignal`.
  const { goToNarrow } = useNarrowNavigation();
  const requestComposeFocus = useComposeFocusStore((s) => s.requestFocus);
  const handleQuoteReply = useCallback(async (): Promise<void> => {
    try {
      const rawContent = await apiClient.getRawContent(message.id);
      const block = buildQuoteBlock({
        message,
        rawContent,
        realmUrl,
      });
      goToNarrow(narrowForMessage(message));
      // Microtask defer so the new ComposeBox mount sees the focus
      // signal — same pattern as the hover-toolbar reply.
      queueMicrotask(() => requestComposeFocus(block));
    } catch (cause) {
      onActionError(describeApiError(cause));
    }
  }, [message, realmUrl, goToNarrow, requestComposeFocus, onActionError]);

  const items: DropdownMenuEntry[] = [];
  // Star/Unstar — single toggle item; label and icon flip on state.
  items.push({
    id: "star-toggle",
    label: isStarred ? "Снять отметку" : "Отметить",
    icon: "star",
    onSelect: handleStarToggle,
  });
  items.push({
    id: "copy-link",
    label: "Копировать ссылку",
    onSelect: handleCopyLink,
  });
  items.push({
    id: "quote-reply",
    label: "Ответить с цитатой",
    icon: "quote",
    onSelect: () => void handleQuoteReply(),
  });
  items.push({
    id: "mark-unread",
    label: "Отметить непрочитанным отсюда",
    onSelect: handleMarkUnread,
  });
  // View edit history — only for messages that have actually been
  // edited (Phase 4.6). The server returns `last_edit_timestamp` on
  // those; on never-edited messages the field is absent.
  if (message.last_edit_timestamp !== undefined) {
    items.push({
      id: "view-history",
      label: "История правок",
      onSelect: onViewHistoryRequested,
    } satisfies DropdownMenuItem);
  }
  if (isOwnMessage) {
    items.push({ id: "sep-own", separator: true });
    if (canEdit) {
      items.push({
        id: "edit",
        label: "Редактировать",
        onSelect: onEditRequested,
      } satisfies DropdownMenuItem);
    }
    items.push({
      id: "delete",
      label: "Удалить сообщение",
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
          aria-label="Действия с сообщением"
        />
      }
      items={items}
      placement="bottom"
      aria-label="Действия с сообщением"
    />
  );
}
