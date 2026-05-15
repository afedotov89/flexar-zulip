// Confirm modal for archiving a channel (Phase 5.3).
//
// Archive is the closest thing Zulip has to "delete a channel": the
// channel object stays, messages stay (per retention policy), but it
// disappears from non-archived listings and members can no longer
// post or subscribe. Reactivation requires a server admin, so this
// modal warns explicitly and gates the action behind a `Button danger`
// confirm. On success the parent navigates back to `/channels`.

import { useState } from "react";
import { apiClient } from "../../../api";
import { Button } from "../../../components/Button";
import { Modal } from "../../../components/Modal";
import type { Stream } from "../../../domain";
import { describeApiError } from "../../../lib/errors";
import styles from "./ArchiveChannelModal.module.css";

export interface ArchiveChannelModalProps {
  open: boolean;
  stream: Stream;
  onClose: () => void;
  onSuccess: () => void;
}

export function ArchiveChannelModal({
  open,
  stream,
  onClose,
  onSuccess,
}: ArchiveChannelModalProps): React.JSX.Element {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleConfirm = async (): Promise<void> => {
    if (busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiClient.archiveChannel(stream.stream_id);
      setBusy(false);
      onSuccess();
    } catch (cause) {
      setError(describeApiError(cause, "Не удалось архивировать канал."));
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Архивировать канал?"
      size="sm"
      dismissable={!busy}
      footer={
        <>
          <Button
            variant="secondary"
            size="md"
            onClick={onClose}
            disabled={busy}
          >
            Отмена
          </Button>
          <Button
            variant="danger"
            size="md"
            onClick={() => {
              void handleConfirm();
            }}
            loading={busy}
          >
            Архивировать
          </Button>
        </>
      }
    >
      <p className={styles.body}>
        Канал «{stream.name}» исчезнет из списка каналов. Сообщения
        сохраняются, но участники больше не смогут писать в канал и
        подписываться на него. Восстановление возможно только через
        администратора сервера.
      </p>
      {error !== null && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </Modal>
  );
}
