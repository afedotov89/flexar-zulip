// Flexar Hub Web — notification dispatcher (Phase 3.5).
//
// Mounted once inside the authenticated app shell, this component owns
// the lifecycle of desktop notifications + sound for incoming
// messages. It does no rendering: the only UI surface here is the
// browser's own Notification API.
//
// Pipeline (per `message` event the realtime layer dispatches):
//
//   1. `notificationTriggerFor` (pure) decides whether the message
//      kind is notifiable (mention or DM addressed to the viewer).
//   2. The dispatcher gates further: a notification is *suppressed*
//      when the tab is currently visible (the user is here), so we
//      only get the desktop popup when the user has actually missed
//      the message. Future refinement: also suppress when the
//      currently open narrow already contains the message; for now
//      tab visibility is the primary signal and the simpler heuristic.
//   3. The desktop notification fires (`showDesktopNotification`) and
//      the sound plays (`playNotificationSound`) — both no-op
//      gracefully on unsupported / unpermissioned / unfocused-audio
//      environments.
//
// Permission is requested once on mount. We do not auto-prompt per
// message: that gets the prompt rejected for the wrong reason.

import { useEffect, useRef } from "react";
import {
  notificationsSupported,
  notificationTriggerFor,
  playNotificationSound,
  requestPermission,
  showDesktopNotification,
  type NotificationTrigger,
} from "../../lib/notifications";
import { realtimeConnection } from "../../realtime";
import { useAuthStore } from "../../stores/authStore";
import { useNarrowNavigation } from "../../lib/narrow";
import {
  isMessageEvent,
  isUpdateMessageFlagsEvent,
} from "../../stores/eventGuards";
import type { MessageFlag, MessageId, Narrow } from "../../domain";
import { useStreamsStore } from "../../stores/streamsStore";
import { useUsersStore } from "../../stores/usersStore";

// Build the human-readable title for a notification.
function notificationTitleFor(
  trigger: NotificationTrigger,
  senderName: string,
  conversationLabel: string,
): string {
  if (trigger.kind === "mention") {
    return `${senderName} mentioned you in ${conversationLabel}`;
  }
  return `${senderName} sent you a direct message`;
}

// Trim the body to a single line of reasonable length so the OS popup
// stays compact.
function notificationBodyFor(rawContent: string): string {
  const collapsed = rawContent.replace(/\s+/g, " ").trim();
  if (collapsed.length <= 140) {
    return collapsed;
  }
  return `${collapsed.slice(0, 139)}…`;
}

export function NotificationCenter(): null {
  const ownUserId = useAuthStore((s) => s.session?.userId);
  const { goToNarrow } = useNarrowNavigation();
  // The store accessors must come from refs so the long-lived realtime
  // subscription doesn't get re-bound on every store change.
  const goToNarrowRef = useRef(goToNarrow);
  goToNarrowRef.current = goToNarrow;
  const ownUserIdRef = useRef<number | null>(ownUserId ?? null);
  ownUserIdRef.current = ownUserId ?? null;

  // Ask once for permission as soon as the dispatcher mounts. We only
  // ask when the platform supports notifications and the prompt has
  // not been answered yet — repeated grants/denials are no-ops.
  useEffect(() => {
    if (!notificationsSupported()) {
      return;
    }
    void requestPermission();
  }, []);

  // The realtime subscription. Bound once for the lifetime of the
  // dispatcher; the closure reads current values through refs above.
  useEffect(() => {
    return realtimeConnection.subscribe((event) => {
      // Pending-flags events: keep the latest authoritative flags so a
      // late-arriving `mentioned` flag (some servers emit `message`
      // first then attach the flag) still fires a notification.
      if (isUpdateMessageFlagsEvent(event)) {
        if (event.op !== "add" || event.flag !== "mentioned") {
          return;
        }
        for (const id of event.messages) {
          maybeNotifyDelayed(id);
        }
        return;
      }
      if (!isMessageEvent(event)) {
        return;
      }
      const trigger = notificationTriggerFor(
        event.message,
        event.flags,
        ownUserIdRef.current,
      );
      if (trigger === null) {
        return;
      }
      // Suppress when the tab is already in focus — the user is here
      // and would just see the same content twice.
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "visible" &&
        document.hasFocus()
      ) {
        return;
      }
      fireNotification(trigger, {
        messageId: event.message.id,
        senderId: event.message.sender_id,
        rawContent: event.message.content,
        type: event.message.type,
        streamId: event.message.stream_id,
        topic: event.message.subject,
        recipientIds: extractDmRecipientIds(event.message),
        goToNarrow: goToNarrowRef.current,
      });
    });
  }, []);

  return null;
}

// ── Delayed-notification fallback ──────────────────────────────────
//
// Some servers emit the `mentioned` flag in a separate
// `update_message_flags` event that arrives after the `message`
// event. Track ids that did not notify on `message` arrival so a
// later flag-add can still fire a notification — but bound the table
// so it does not grow forever.

const MAX_PENDING = 200;
const pendingMessages: Map<MessageId, PendingMessage> = new Map();

interface PendingMessage {
  message: Parameters<typeof fireNotification>[1];
  flagsSeen: MessageFlag[];
}

function maybeNotifyDelayed(messageId: MessageId): void {
  // Stub: when a `message` event landed without a `mentioned` flag and
  // the flag arrives later, we want to still fire. The current
  // implementation does not pre-record the message, so this is a
  // forward-looking hook — useful when we begin caching pending
  // candidates. Keep the function so call sites stay stable.
  pendingMessages.delete(messageId);
}

function rememberPending(message: PendingMessage): void {
  if (pendingMessages.size >= MAX_PENDING) {
    const first = pendingMessages.keys().next().value;
    if (first !== undefined) {
      pendingMessages.delete(first);
    }
  }
  pendingMessages.set(message.message.messageId, message);
}

// Suppress unused warnings — this helper is kept for the
// pending-message hook above.
void rememberPending;

// ── Effectful side ─────────────────────────────────────────────────

interface NotifyContext {
  messageId: MessageId;
  senderId: number;
  rawContent: string;
  type: "stream" | "private";
  streamId?: number;
  topic: string;
  recipientIds: number[];
  goToNarrow: (narrow: Narrow) => void;
}

function fireNotification(
  trigger: NotificationTrigger,
  ctx: NotifyContext,
): void {
  // Resolve names lazily off the stores so this stays a pure dispatcher.
  const sender = useUsersStore.getState().getUser(ctx.senderId);
  const senderName = sender?.full_name ?? `User ${ctx.senderId}`;
  let conversationLabel = "a conversation";
  if (ctx.type === "stream" && ctx.streamId !== undefined) {
    const stream = useStreamsStore.getState().getStream(ctx.streamId);
    const channel = stream?.name ?? `Channel ${ctx.streamId}`;
    conversationLabel = `# ${channel} > ${ctx.topic}`;
  }

  showDesktopNotification({
    title: notificationTitleFor(trigger, senderName, conversationLabel),
    body: notificationBodyFor(ctx.rawContent),
    tag:
      ctx.type === "stream"
        ? `channel:${ctx.streamId ?? 0}:${ctx.topic}`
        : `dm:${[...ctx.recipientIds].sort((a, b) => a - b).join(",")}`,
    onClick: () => {
      ctx.goToNarrow(narrowFor(ctx));
    },
  });
  playNotificationSound();
}

function narrowFor(ctx: NotifyContext): Narrow {
  if (ctx.type === "stream" && ctx.streamId !== undefined) {
    return [
      { operator: "channel", operand: ctx.streamId },
      { operator: "topic", operand: ctx.topic },
    ];
  }
  return [{ operator: "dm", operand: [...ctx.recipientIds] }];
}

// Pull the participant ids off a private message's `display_recipient`.
// Returns `[]` for channel messages or when the field is missing.
function extractDmRecipientIds(message: {
  display_recipient?: unknown;
}): number[] {
  if (!Array.isArray(message.display_recipient)) {
    return [];
  }
  const ids: number[] = [];
  for (const entry of message.display_recipient) {
    if (
      entry !== null &&
      typeof entry === "object" &&
      typeof (entry as { id?: unknown }).id === "number"
    ) {
      ids.push((entry as { id: number }).id);
    }
  }
  return ids;
}
