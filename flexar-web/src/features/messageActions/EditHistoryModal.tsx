// Flexar Hub Web — message edit-history viewer (Phase 4.6).
//
// Opens a `Modal` listing every edit snapshot the server returns from
// `GET /messages/{id}/history`. Each snapshot row carries the
// editor's name, the timestamp, and a one-line description of what
// changed (content / topic / channel / multiple). Clicking a content
// snapshot reveals the previous content so a user can compare.
//
// The fetch happens once per modal open; if the user closes and
// re-opens, we refetch (the message could have been edited in the
// background). Failures surface inline as a `Banner`.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Banner } from "../../components/Banner";
import { Modal } from "../../components/Modal";
import { Spinner } from "../../components/Spinner";
import { apiClient, isApiError } from "../../api";
import type { Message, MessageEdit, StreamId } from "../../domain";
import { useStreamsStore } from "../../stores/streamsStore";
import { useUsersStore } from "../../stores/usersStore";
import styles from "./EditHistoryModal.module.css";

export interface EditHistoryModalProps {
  /** The message whose history is being shown. */
  message: Message;
  /** Whether the modal is open. */
  open: boolean;
  /** Called when the user requests to close (Esc, scrim, X). */
  onClose: () => void;
}

function describeError(error: unknown): string {
  if (isApiError(error)) {
    return error.body?.msg ?? error.message;
  }
  return error instanceof Error ? error.message : "Failed to load history.";
}

export function EditHistoryModal({
  message,
  open,
  onClose,
}: EditHistoryModalProps): React.JSX.Element {
  const [history, setHistory] = useState<MessageEdit[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getUser = useUsersStore((s) => s.getUser);
  const getStream = useStreamsStore((s) => s.getStream);

  // Fetch on every open (the message may have been edited again in
  // the background). The cleanup flag drops a stale response if the
  // user closes the modal mid-flight.
  useEffect(() => {
    if (!open) {
      setHistory(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiClient
      .getMessageHistory(message.id)
      .then((entries) => {
        if (cancelled) {
          return;
        }
        setHistory(entries);
      })
      .catch((cause: unknown) => {
        if (cancelled) {
          return;
        }
        setError(describeError(cause));
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, message.id]);

  const channelName = useCallback(
    (id: StreamId | undefined): string => {
      if (id === undefined) {
        return "";
      }
      return getStream(id)?.name ?? `Channel ${id}`;
    },
    [getStream],
  );

  // Server returns the snapshots in chronological order; render
  // newest-first so the most recent change is at the top.
  const ordered = useMemo(
    () =>
      history === null
        ? []
        : [...history].sort((a, b) => b.timestamp - a.timestamp),
    [history],
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit history"
      size="md"
      dismissable
    >
      <div className={styles.body}>
        {loading && (
          <div className={styles.loading} role="status">
            <Spinner size="sm" aria-label="Loading edit history" /> Loading…
          </div>
        )}
        {error !== null && (
          <Banner tone="danger" onDismiss={undefined}>
            {error}
          </Banner>
        )}
        {!loading && error === null && history !== null && (
          <ul className={styles.list} aria-label="Edit history">
            {ordered.map((entry) => (
              <li key={entry.timestamp} className={styles.row}>
                <div className={styles.rowHead}>
                  <span className={styles.rowAuthor}>
                    {entry.user_id === null
                      ? "Unknown"
                      : (getUser(entry.user_id)?.full_name ?? `User ${entry.user_id}`)}
                  </span>
                  <span className={styles.rowTime}>
                    {formatTimestamp(entry.timestamp)}
                  </span>
                </div>
                <div className={styles.rowSummary}>
                  {summariseEntry(entry, channelName)}
                </div>
                {entry.prev_content !== undefined && (
                  <details className={styles.diff}>
                    <summary className={styles.diffSummary}>
                      Previous content
                    </summary>
                    <pre className={styles.diffPre}>{entry.prev_content}</pre>
                  </details>
                )}
              </li>
            ))}
            {ordered.length === 0 && (
              <li className={styles.empty}>This message has no edit history.</li>
            )}
          </ul>
        )}
      </div>
    </Modal>
  );
}

// Human-readable description of what an edit changed.
export function summariseEntry(
  entry: MessageEdit,
  channelName: (id: StreamId | undefined) => string,
): string {
  const parts: string[] = [];
  if (entry.prev_content !== undefined) {
    parts.push("edited content");
  }
  if (entry.prev_topic !== undefined) {
    parts.push(
      `moved from topic "${entry.prev_topic}" to "${entry.topic ?? ""}"`,
    );
  }
  if (entry.prev_stream !== undefined) {
    const fromName = channelName(entry.prev_stream);
    const toName = channelName(entry.stream);
    parts.push(`moved from #${fromName} to #${toName}`);
  }
  if (parts.length === 0) {
    return "Original message";
  }
  return parts.join(" · ");
}

function formatTimestamp(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleString();
}
