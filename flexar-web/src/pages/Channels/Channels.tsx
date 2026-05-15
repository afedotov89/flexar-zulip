// Browse channels page (Phase 5.5).
//
// Lists every channel the user can see (subscribed and not), with a
// per-row Subscribe / Unsubscribe button and a search filter. Realtime
// `subscription add | remove` events keep the buttons in sync without
// further wiring — the store reducers already fold the events.
//
// Optimistic / refresh policy: API call → wait for response → on
// success the realtime echo flips the row, on failure surface in a
// banner. The button enters a loading state during the round-trip.
//
// Out of scope for Phase 5.5: per-channel settings (notifications,
// pin, color), creating a new channel from this page (subscribe
// already creates one if the name is new), bulk-select.

import { useMemo, useState } from "react";
import { Banner } from "../../components/Banner";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { apiClient } from "../../api";
import type { Stream, StreamId } from "../../domain";
import { describeApiError } from "../../lib/errors";
import { useStreamsStore } from "../../stores/streamsStore";
import styles from "./Channels.module.css";

export function Channels(): React.JSX.Element {
  const streams = useStreamsStore((s) => s.streams);
  const subscriptions = useStreamsStore((s) => s.subscriptions);
  const [filter, setFilter] = useState("");
  const [busyStreamId, setBusyStreamId] = useState<StreamId | null>(null);
  const [error, setError] = useState<string | null>(null);

  const list = useMemo(() => {
    const visible = Object.values(streams);
    const trimmed = filter.trim().toLowerCase();
    const filtered =
      trimmed === ""
        ? visible
        : visible.filter(
            (s) =>
              s.name.toLowerCase().includes(trimmed) ||
              (s.description?.toLowerCase().includes(trimmed) ?? false),
          );
    // Subscribed first, then alphabetical inside each group.
    return [...filtered].sort((a, b) => {
      const subA = a.stream_id in subscriptions;
      const subB = b.stream_id in subscriptions;
      if (subA !== subB) {
        return subA ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  }, [streams, subscriptions, filter]);

  const handleSubscribe = async (stream: Stream): Promise<void> => {
    setBusyStreamId(stream.stream_id);
    setError(null);
    try {
      await apiClient.subscribe({ subscriptions: [{ name: stream.name }] });
    } catch (cause) {
      setError(describeApiError(cause, "Не удалось обновить подписку."));
    } finally {
      setBusyStreamId(null);
    }
  };

  const handleUnsubscribe = async (stream: Stream): Promise<void> => {
    setBusyStreamId(stream.stream_id);
    setError(null);
    try {
      await apiClient.unsubscribe({ subscriptions: [stream.name] });
    } catch (cause) {
      setError(describeApiError(cause, "Не удалось обновить подписку."));
    } finally {
      setBusyStreamId(null);
    }
  };

  return (
    <div className={styles.channels}>
      <header className={styles.header}>
        <h1 className={styles.heading}>Каналы</h1>
        <Input
          aria-label="Поиск канала"
          type="search"
          iconLeft="search"
          value={filter}
          onChange={(event) => setFilter(event.currentTarget.value)}
          placeholder="Поиск канала"
          className={styles.search}
        />
      </header>

      {error !== null && (
        <Banner tone="danger" onDismiss={() => setError(null)}>
          {error}
        </Banner>
      )}

      {list.length === 0 ? (
        <p className={styles.empty}>
          {filter.trim() === ""
            ? "Каналы не найдены."
            : "По запросу ничего не найдено."}
        </p>
      ) : (
        <ul className={styles.list} aria-label="Каналы">
          {list.map((stream) => {
            const subscribed = stream.stream_id in subscriptions;
            const busy = busyStreamId === stream.stream_id;
            return (
              <li key={stream.stream_id} className={styles.row}>
                <div className={styles.info}>
                  <span className={styles.name}>#{stream.name}</span>
                  {stream.description !== undefined && stream.description !== "" && (
                    <span className={styles.description}>
                      {stream.description}
                    </span>
                  )}
                </div>
                <Button
                  type="button"
                  variant={subscribed ? "ghost" : "primary"}
                  size="sm"
                  loading={busy}
                  onClick={() =>
                    void (subscribed
                      ? handleUnsubscribe(stream)
                      : handleSubscribe(stream))
                  }
                >
                  {subscribed ? "Отписаться" : "Подписаться"}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

