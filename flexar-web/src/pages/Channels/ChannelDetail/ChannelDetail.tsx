// Channel detail page (Phase 5.3) — `/channels/:id`.
//
// One-screen view of a single channel: metadata + admin settings +
// subscriber management + danger zone. Source of truth is the
// streams-store (`getStream` for the channel record, `getSubscription`
// for the viewer's subscriber list when subscribed). For a channel the
// viewer is not subscribed to, subscribers are fetched on demand via
// `apiClient.getChannelSubscribers` and held in local state — peer
// events still aren't observable here, so this view will not auto-
// update on add/remove from such channels (acceptable for an
// admin-only view; refresh on next mount).
//
// Admin gating: `useIsAdmin()` controls visibility of the Access
// section, the per-row remove buttons for other users, and the Danger
// zone. Non-admins still see Subscribe/Unsubscribe for themselves.
//
// All mutations go through the shared `apiClient.{updateChannel,
// subscribe, unsubscribe, archiveChannel}`. Realtime events fold the
// resulting `stream:update` / `subscription:peer_add|peer_remove` /
// `stream:delete` updates into the store, so most controls don't need
// optimistic juggling: spin the button while the request is in flight,
// surface errors via Banner.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiClient } from "../../../api";
import { Badge } from "../../../components/Badge";
import { Banner } from "../../../components/Banner";
import { Button } from "../../../components/Button";
import { Icon } from "../../../components/Icon";
import { Input } from "../../../components/Input";
import { Select } from "../../../components/Select";
import { Spinner } from "../../../components/Spinner";
import { Textarea } from "../../../components/Textarea";
import { Toggle } from "../../../components/Toggle";
import type { Stream, StreamId, Subscription, UserId } from "../../../domain";
import { describeApiError } from "../../../lib/errors";
import { useIsAdmin } from "../../../lib/hooks/useIsAdmin";
import { useStoresLoading } from "../../../lib/hooks/useRealtimeStatus";
import { useAuthStore } from "../../../stores/authStore";
import { useStreamsStore } from "../../../stores/streamsStore";
import { AddSubscriberInput } from "./AddSubscriberInput";
import { ArchiveChannelModal } from "./ArchiveChannelModal";
import { RemoveSubscriberConfirmModal } from "./RemoveSubscriberConfirmModal";
import { SubscriberList } from "./SubscriberList";
import styles from "./ChannelDetail.module.css";

// Retention preset options. `null` = inherit org default, `-1` = forever.
// We render `null` as the empty string and translate at the boundary.
const RETENTION_INHERIT = "__inherit__";
const RETENTION_FOREVER = "-1";

const retentionOptions = [
  { value: RETENTION_INHERIT, label: "Наследовать организацию" },
  { value: RETENTION_FOREVER, label: "Без срока" },
  { value: "30", label: "30 дней" },
  { value: "90", label: "90 дней" },
  { value: "365", label: "365 дней" },
];

function retentionToValue(days: number | null): string {
  if (days === null) {
    return RETENTION_INHERIT;
  }
  return String(days);
}

function valueToRetention(value: string): number | null {
  if (value === RETENTION_INHERIT) {
    return null;
  }
  return Number(value);
}

export function ChannelDetail(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const streamId = id !== undefined ? Number(id) : NaN;
  const isValidId = Number.isFinite(streamId) && streamId > 0;

  const stream = useStreamsStore((s) =>
    isValidId ? s.streams[streamId] : undefined,
  );
  const subscription = useStreamsStore((s) =>
    isValidId ? s.subscriptions[streamId] : undefined,
  );
  const storesLoading = useStoresLoading();
  const isAdmin = useIsAdmin();

  if (storesLoading && stream === undefined) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>
          <Spinner size="lg" />
        </div>
      </div>
    );
  }

  if (!isValidId || stream === undefined) {
    return <ChannelMissing />;
  }

  return (
    <ChannelDetailLoaded
      stream={stream}
      subscription={subscription}
      isAdmin={isAdmin}
    />
  );
}

function ChannelMissing(): React.JSX.Element {
  return (
    <div className={styles.page}>
      <Banner tone="danger" title="Канал не найден">
        Возможно, канал был удалён или вы не имеете к нему доступа.
      </Banner>
      <div>
        <Link to="/channels" className={styles.backLink}>
          ← Назад к каналам
        </Link>
      </div>
    </div>
  );
}

interface LoadedProps {
  stream: Stream;
  subscription: Subscription | undefined;
  isAdmin: boolean;
}

function ChannelDetailLoaded({
  stream,
  subscription,
  isAdmin,
}: LoadedProps): React.JSX.Element {
  const session = useAuthStore((s) => s.session);
  const ownUserId = session?.userId;
  const navigate = useNavigate();

  const [error, setError] = useState<string | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<UserId | null>(null);

  // Subscribers: viewer-subscribed → from the subscription record
  // (live-updated by peer events). Otherwise → fetch once via REST.
  const subscribers = useResolvedSubscribers(
    stream.stream_id,
    subscription,
    setError,
  );

  const handleArchiveSuccess = useCallback(() => {
    setArchiveOpen(false);
    navigate("/channels");
  }, [navigate]);

  const handleRemove = useCallback(
    async (userId: UserId): Promise<void> => {
      setError(null);
      try {
        await apiClient.unsubscribe({
          subscriptions: [stream.name],
          principals: [userId],
        });
        setRemoveTarget(null);
      } catch (cause) {
        setError(describeApiError(cause, "Не удалось убрать подписчика."));
      }
    },
    [stream.name],
  );

  const isSubscribed = subscription !== undefined;

  return (
    <div className={styles.page}>
      <nav className={styles.breadcrumb} aria-label="Хлебные крошки">
        <Link to="/channels" className={styles.breadcrumbLink}>
          Каналы
        </Link>
        <span aria-hidden="true" className={styles.breadcrumbSep}>
          /
        </span>
        <span className={styles.breadcrumbCurrent}>{stream.name}</span>
      </nav>

      <header className={styles.titleRow}>
        <Icon name="hash" size="md" className={styles.titleIcon} />
        <h1 className={styles.title}>{stream.name}</h1>
        {stream.invite_only && <Badge variant="neutral">Приватный</Badge>}
        {stream.is_archived && <Badge variant="danger">Архивирован</Badge>}
      </header>

      {stream.description !== "" && (
        <p className={styles.description}>{stream.description}</p>
      )}

      {error !== null && (
        <Banner tone="danger" onDismiss={() => setError(null)}>
          {error}
        </Banner>
      )}

      <InfoSection stream={stream} onError={setError} />

      {isAdmin && <AccessSection stream={stream} onError={setError} />}

      <SubscribersSection
        stream={stream}
        subscribers={subscribers}
        isAdmin={isAdmin}
        isSubscribed={isSubscribed}
        ownUserId={ownUserId}
        onRequestRemove={setRemoveTarget}
        onError={setError}
      />

      {isAdmin && (
        <section className={styles.section}>
          <h2 className={styles.sectionHeading}>Опасная зона</h2>
          <p className={styles.muted}>
            Архивированный канал больше не виден участникам и не появляется в
            списках. Сообщения сохраняются по политике хранения; восстановить
            канал может только администратор сервера.
          </p>
          <div>
            <Button
              type="button"
              variant="danger"
              size="md"
              onClick={() => setArchiveOpen(true)}
            >
              Архивировать канал
            </Button>
          </div>
        </section>
      )}

      <ArchiveChannelModal
        open={archiveOpen}
        stream={stream}
        onClose={() => setArchiveOpen(false)}
        onSuccess={handleArchiveSuccess}
      />

      {removeTarget !== null && (
        <RemoveSubscriberConfirmModal
          open={removeTarget !== null}
          userId={removeTarget}
          isSelf={removeTarget === ownUserId}
          onClose={() => setRemoveTarget(null)}
          onConfirm={() => handleRemove(removeTarget)}
        />
      )}
    </div>
  );
}

// Resolve the current subscriber list. When the viewer is subscribed,
// the streams-store carries it via the `Subscription.subscribers`
// field (kept fresh by `peer_add`/`peer_remove`). For channels the
// viewer is not subscribed to, fetch on mount via REST and stash in
// local state. Returns `undefined` while a fetch is in flight (so
// the section can render a spinner if it cares).
function useResolvedSubscribers(
  streamId: StreamId,
  subscription: Subscription | undefined,
  onError: (message: string) => void,
): UserId[] | undefined {
  const [fetched, setFetched] = useState<UserId[] | undefined>(undefined);
  const subscribed = subscription !== undefined;

  useEffect(() => {
    if (subscribed) {
      // Live source available; nothing to fetch.
      return;
    }
    let cancelled = false;
    apiClient
      .getChannelSubscribers(streamId)
      .then((list) => {
        if (!cancelled) {
          setFetched(list);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          onError(
            describeApiError(cause, "Не удалось загрузить список подписчиков."),
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [streamId, subscribed, onError]);

  if (subscribed) {
    return subscription.subscribers ?? subscription.partial_subscribers ?? [];
  }
  return fetched;
}

// --- Sections ------------------------------------------------------

interface InfoSectionProps {
  stream: Stream;
  onError: (message: string | null) => void;
}

function InfoSection({ stream, onError }: InfoSectionProps): React.JSX.Element {
  const [name, setName] = useState(stream.name);
  const [description, setDescription] = useState(stream.description);
  const [savingName, setSavingName] = useState(false);
  const [savingDescription, setSavingDescription] = useState(false);

  // Sync local state when the store changes from underneath us
  // (e.g. another client edits the channel).
  useEffect(() => {
    setName(stream.name);
  }, [stream.name]);
  useEffect(() => {
    setDescription(stream.description);
  }, [stream.description]);

  const trimmedName = name.trim();
  const dirtyName = trimmedName !== "" && trimmedName !== stream.name;
  const dirtyDescription = description !== stream.description;

  const handleSaveName = async (): Promise<void> => {
    if (!dirtyName) {
      return;
    }
    setSavingName(true);
    onError(null);
    try {
      await apiClient.updateChannel(stream.stream_id, { newName: trimmedName });
    } catch (cause) {
      onError(describeApiError(cause, "Не удалось переименовать канал."));
    } finally {
      setSavingName(false);
    }
  };

  const handleSaveDescription = async (): Promise<void> => {
    if (!dirtyDescription) {
      return;
    }
    setSavingDescription(true);
    onError(null);
    try {
      await apiClient.updateChannel(stream.stream_id, { description });
    } catch (cause) {
      onError(describeApiError(cause, "Не удалось обновить описание."));
    } finally {
      setSavingDescription(false);
    }
  };

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionHeading}>Информация</h2>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="channel-name">
          Название
        </label>
        <div className={styles.controlInline}>
          <Input
            id="channel-name"
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
            maxLength={60}
            disabled={savingName}
          />
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={() => void handleSaveName()}
            loading={savingName}
            disabled={!dirtyName}
          >
            Сохранить
          </Button>
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="channel-description">
          Описание
        </label>
        <Textarea
          id="channel-description"
          value={description}
          onChange={(event) => setDescription(event.currentTarget.value)}
          maxLength={1024}
          disabled={savingDescription}
          rows={3}
        />
        <div>
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={() => void handleSaveDescription()}
            loading={savingDescription}
            disabled={!dirtyDescription}
          >
            Сохранить описание
          </Button>
        </div>
      </div>
    </section>
  );
}

interface AccessSectionProps {
  stream: Stream;
  onError: (message: string | null) => void;
}

function AccessSection({
  stream,
  onError,
}: AccessSectionProps): React.JSX.Element {
  const submit = useCallback(
    async (
      label: string,
      params: Parameters<typeof apiClient.updateChannel>[1],
    ): Promise<void> => {
      onError(null);
      try {
        await apiClient.updateChannel(stream.stream_id, params);
      } catch (cause) {
        onError(describeApiError(cause, label));
      }
    },
    [stream.stream_id, onError],
  );

  const retentionValue = retentionToValue(stream.message_retention_days);

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionHeading}>Доступ</h2>

      <div className={styles.field}>
        <Toggle
          label="Приватный канал"
          checked={stream.invite_only}
          onChange={(event) =>
            void submit("Не удалось изменить приватность.", {
              isPrivate: event.currentTarget.checked,
            })
          }
        />
        <span className={styles.muted}>
          В приватный канал участники добавляются только по приглашению.
        </span>
      </div>

      <div className={styles.field}>
        <Toggle
          label="История доступна новым подписчикам"
          checked={stream.history_public_to_subscribers}
          onChange={(event) =>
            void submit("Не удалось изменить настройку истории.", {
              historyPublicToSubscribers: event.currentTarget.checked,
            })
          }
        />
        <span className={styles.muted}>
          Если выключено, новый подписчик видит только сообщения, отправленные
          после момента подписки.
        </span>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="channel-retention">
          Срок хранения сообщений
        </label>
        <Select
          id="channel-retention"
          value={retentionValue}
          options={retentionOptions}
          onChange={(event) =>
            void submit("Не удалось изменить срок хранения.", {
              messageRetentionDays: valueToRetention(event.currentTarget.value),
            })
          }
        />
      </div>
    </section>
  );
}

interface SubscribersSectionProps {
  stream: Stream;
  subscribers: UserId[] | undefined;
  isAdmin: boolean;
  isSubscribed: boolean;
  ownUserId: UserId | undefined;
  onRequestRemove: (userId: UserId) => void;
  onError: (message: string | null) => void;
}

function SubscribersSection({
  stream,
  subscribers,
  isAdmin,
  isSubscribed,
  ownUserId,
  onRequestRemove,
  onError,
}: SubscribersSectionProps): React.JSX.Element {
  const [busy, setBusy] = useState(false);

  const handleSelfSubscribe = async (): Promise<void> => {
    setBusy(true);
    onError(null);
    try {
      await apiClient.subscribe({ subscriptions: [{ name: stream.name }] });
    } catch (cause) {
      onError(describeApiError(cause, "Не удалось подписаться на канал."));
    } finally {
      setBusy(false);
    }
  };

  const handleSelfUnsubscribe = async (): Promise<void> => {
    setBusy(true);
    onError(null);
    try {
      await apiClient.unsubscribe({ subscriptions: [stream.name] });
    } catch (cause) {
      onError(describeApiError(cause, "Не удалось отписаться от канала."));
    } finally {
      setBusy(false);
    }
  };

  const handleAddSubscriber = async (userId: UserId): Promise<void> => {
    onError(null);
    try {
      await apiClient.subscribe({
        subscriptions: [{ name: stream.name }],
        principals: [userId],
      });
    } catch (cause) {
      onError(describeApiError(cause, "Не удалось добавить подписчика."));
    }
  };

  // The viewer can manage other subscribers when admin, or when
  // subscribed (Zulip lets channel members add others by default).
  const canManage = isAdmin || isSubscribed;

  const count = useMemo(() => {
    if (subscribers !== undefined) {
      return subscribers.length;
    }
    return stream.subscriber_count;
  }, [stream.subscriber_count, subscribers]);

  return (
    <section className={styles.section}>
      <header className={styles.subscribersHeader}>
        <h2 className={styles.sectionHeading}>Подписчики ({count})</h2>
        <div>
          {isSubscribed ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void handleSelfUnsubscribe()}
              loading={busy}
            >
              Отписаться
            </Button>
          ) : (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => void handleSelfSubscribe()}
              loading={busy}
            >
              Подписаться
            </Button>
          )}
        </div>
      </header>

      {canManage && (
        <AddSubscriberInput
          existingIds={subscribers ?? []}
          onSelect={handleAddSubscriber}
        />
      )}

      <SubscriberList
        subscribers={subscribers}
        canRemoveOthers={isAdmin}
        ownUserId={ownUserId}
        onRequestRemove={onRequestRemove}
      />
    </section>
  );
}

