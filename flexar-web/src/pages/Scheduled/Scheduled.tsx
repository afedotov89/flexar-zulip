// Flexar Hub Web — Scheduled messages page (Phase 4.5).
//
// The dedicated screen for the Scheduled special view (`/scheduled`).
// Lists every undelivered scheduled message the server holds for the
// user, ordered by delivery time ascending, and lets the user cancel
// a scheduled message outright.
//
// Editing in-place is intentionally minimal in this phase: the page
// shows the destination + body + delivery time and a cancel button;
// re-scheduling or rewriting the body happens by cancelling and
// re-composing. A richer inline editor can land later without
// changing this page's contract.
//
// Data source: `useScheduledMessagesStore` (server-side bag, hydrated
// lazily via `loadScheduledMessages`). Realtime events keep it fresh,
// so a successful schedule from the compose box appears here without
// a manual reload.

import { useEffect } from "react";
import { Banner } from "../../components/Banner";
import { IconButton } from "../../components/IconButton";
import { Spinner } from "../../components/Spinner";
import { apiClient } from "../../api";
import type { ScheduledMessage, UserId } from "../../domain";
import { useRealmStore } from "../../stores/realmStore";
import { useScheduledMessagesStore } from "../../stores/scheduledMessagesStore";
import { useStreamsStore } from "../../stores/streamsStore";
import { useUsersStore } from "../../stores/usersStore";
import styles from "./Scheduled.module.css";

/** Maximum characters of body shown in the row preview. */
const PREVIEW_CHARS = 200;

export function Scheduled(): React.JSX.Element {
  const messagesMap = useScheduledMessagesStore((s) => s.scheduledMessages);
  const loadStatus = useScheduledMessagesStore((s) => s.loadStatus);
  const loadScheduledMessages = useScheduledMessagesStore(
    (s) => s.loadScheduledMessages,
  );
  const list = useScheduledMessagesStore((s) => s.list);

  const streamsMap = useStreamsStore((s) => s.streams);
  const usersMap = useUsersStore((s) => s.users);
  const emptyTopicDisplayName = useRealmStore(
    (s) => s.realm?.realm_empty_topic_display_name,
  );

  // Trigger the bootstrap fetch on first mount, AND every time the
  // store's loadStatus drops back to "idle" (which happens whenever a
  // realtime re-register fires `wireStore.hydrate` and resets the
  // bag). Without the `loadStatus` dependency the page would race
  // with the initial register: the fetch would land first, the
  // register-time hydrate would clear it, and the user would see an
  // empty list despite the server holding data.
  useEffect(() => {
    if (loadStatus === "idle") {
      void loadScheduledMessages();
    }
  }, [loadStatus, loadScheduledMessages]);

  const messages = list();

  // Subscribing to `messagesMap` (above) is what makes this page
  // re-render when the store changes; `list()` reads through the
  // current snapshot and is recomputed each render.
  void messagesMap;

  if (loadStatus === "loading" && messages.length === 0) {
    return (
      <div className={styles.empty}>
        <Spinner />
      </div>
    );
  }

  if (loadStatus === "error" && messages.length === 0) {
    return (
      <div className={styles.empty}>
        <Banner tone="danger">
          Не удалось загрузить отложенные сообщения. Попробуйте обновить
          страницу.
        </Banner>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyTitle}>Нет отложенных сообщений</p>
        <p className={styles.emptyHint}>
          Запланируйте сообщение через кнопку с часами в окне отправки —
          оно появится здесь до момента доставки.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.scheduled}>
      <h1 className={styles.heading}>Отложенные сообщения</h1>
      {loadStatus === "error" && (
        <Banner tone="warning">
          Список мог устареть — обновление не удалось.
        </Banner>
      )}
      <ul className={styles.list} aria-label="Отложенные сообщения">
        {messages.map((message) => (
          <ScheduledRow
            key={message.scheduled_message_id}
            message={message}
            destinationLabel={describeDestination(
              message,
              (id) => streamsMap[id]?.name,
              (id) => usersMap[id]?.full_name,
              emptyTopicDisplayName,
            )}
          />
        ))}
      </ul>
    </div>
  );
}

interface ScheduledRowProps {
  message: ScheduledMessage;
  destinationLabel: string;
}

function ScheduledRow({
  message,
  destinationLabel,
}: ScheduledRowProps): React.JSX.Element {
  const onDelete = (): void => {
    // Optimistic-by-event: the realtime `remove` event will drop the
    // entry from the store. The server is the source of truth here;
    // showing a confirmation dialog would slow down the common case.
    void apiClient
      .deleteScheduledMessage(message.scheduled_message_id)
      .catch(() => {
        // Surfacing the failure is left to a later iteration; the
        // worst case is the row stays visible until reload.
      });
  };

  return (
    <li className={styles.row} data-failed={message.failed || undefined}>
      <div className={styles.body}>
        <div className={styles.headerRow}>
          <span className={styles.destination}>{destinationLabel}</span>
          <span className={styles.deliveryTime}>
            {formatDelivery(message.scheduled_delivery_timestamp)}
          </span>
        </div>
        {message.failed && (
          <span className={styles.failedTag}>
            Сервер не смог доставить — отредактируйте время и сохраните заново.
          </span>
        )}
        <p className={styles.preview}>{previewOf(message.content)}</p>
      </div>
      <IconButton
        icon="trash"
        variant="ghost"
        size="sm"
        aria-label={`Отменить отложенное сообщение в ${destinationLabel}`}
        onClick={onDelete}
        className={styles.deleteButton}
      />
    </li>
  );
}

/**
 * Render a one-line label for the scheduled message's destination.
 * Mirrors `Drafts`' `describeDestination` but keys off the wire
 * `to`/`type`/`topic` shape rather than the local Draft type.
 *
 * The empty topic (`topic === ""`) is the realm's "(no topic)"
 * channel-default — the realm sets a friendly display name in
 * `realm_empty_topic_display_name` (e.g. "general chat"). Render
 * that when present, falling back to `(no topic)` so the row stays
 * readable.
 */
function describeDestination(
  message: ScheduledMessage,
  getStreamName: (id: number) => string | undefined,
  getUserName: (id: UserId) => string | undefined,
  emptyTopicDisplayName: string | undefined,
): string {
  if (message.type === "stream") {
    const streamId =
      typeof message.to === "number" ? message.to : message.to[0] ?? 0;
    const channelName = getStreamName(streamId) ?? `Канал ${streamId}`;
    const topic = message.topic ?? "";
    const displayedTopic =
      topic === "" ? (emptyTopicDisplayName ?? "(без темы)") : topic;
    return `# ${channelName} > ${displayedTopic}`;
  }
  const recipients = Array.isArray(message.to) ? message.to : [message.to];
  const names = recipients.map(
    (id) => getUserName(id) ?? `User ${id}`,
  );
  return `Личное сообщение: ${names.join(", ")}`;
}

/** Trim multi-line content to a single-line preview. */
function previewOf(content: string): string {
  const collapsed = content.replace(/\s+/g, " ").trim();
  if (collapsed.length <= PREVIEW_CHARS) {
    return collapsed;
  }
  return `${collapsed.slice(0, PREVIEW_CHARS - 1)}…`;
}

/** Render the delivery timestamp as a localised short string. */
function formatDelivery(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleString();
}

