// Create channel modal (Phase 5.3).
//
// Small create-channel form on top of the browse-channels page. Wires
// `apiClient.createChannel` with name + description + privacy. The
// realtime `stream:create` + `subscription:add` events echo the new
// channel into `streamsStore`, so on success this modal just closes and
// the row appears in the list a tick later — there is no need to
// refetch or to navigate. We keep the call minimal: the optional
// `principals` / `announce` knobs are deferred to a later iteration
// (creator is the single subscriber by default).
//
// Privacy choice is two-way (Public / Private). The third Zulip
// privacy mode `web_public` is intentionally hidden — it is rare and
// has security implications; we expose it only via the detail page
// admin toggles.

import { useCallback, useState } from "react";
import { apiClient } from "../../api";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { Modal } from "../../components/Modal";
import { Radio } from "../../components/Radio";
import { Textarea } from "../../components/Textarea";
import { describeApiError } from "../../lib/errors";
import styles from "./CreateChannelModal.module.css";

export interface CreateChannelModalProps {
  open: boolean;
  onClose: () => void;
}

type Privacy = "public" | "private";

const NAME_MAX = 60;
const DESCRIPTION_MAX = 1024;

export function CreateChannelModal({
  open,
  onClose,
}: CreateChannelModalProps): React.JSX.Element {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [privacy, setPrivacy] = useState<Privacy>("public");
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const reset = useCallback(() => {
    setName("");
    setDescription("");
    setPrivacy("public");
    setError(null);
  }, []);

  const handleClose = useCallback(() => {
    if (isCreating) {
      return;
    }
    reset();
    onClose();
  }, [isCreating, onClose, reset]);

  const trimmedName = name.trim();
  const canSubmit = trimmedName !== "" && !isCreating;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) {
      return;
    }
    setIsCreating(true);
    setError(null);
    try {
      await apiClient.createChannel({
        name: trimmedName,
        description: description.trim() === "" ? undefined : description.trim(),
        privacy,
      });
      // Success: realtime `stream:create` + `subscription:add` will
      // populate the streams-store. Close and clear local state.
      reset();
      setIsCreating(false);
      onClose();
    } catch (cause) {
      setError(describeApiError(cause, "Не удалось создать канал."));
      setIsCreating(false);
    }
  }, [canSubmit, description, onClose, privacy, reset, trimmedName]);

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Создать канал"
      size="md"
      dismissable={!isCreating}
      footer={
        <>
          <Button
            variant="secondary"
            size="md"
            onClick={handleClose}
            disabled={isCreating}
          >
            Отмена
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={() => {
              void handleSubmit();
            }}
            loading={isCreating}
            disabled={!canSubmit}
          >
            Создать
          </Button>
        </>
      }
    >
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit();
        }}
      >
        <div className={styles.field}>
          <label className={styles.label} htmlFor="create-channel-name">
            Название
          </label>
          <Input
            id="create-channel-name"
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
            maxLength={NAME_MAX}
            placeholder="например, маркетинг"
            disabled={isCreating}
            autoFocus
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="create-channel-description">
            Описание
          </label>
          <Textarea
            id="create-channel-description"
            value={description}
            onChange={(event) => setDescription(event.currentTarget.value)}
            maxLength={DESCRIPTION_MAX}
            placeholder="Кратко о назначении канала (необязательно)."
            disabled={isCreating}
            rows={3}
          />
        </div>

        <fieldset className={styles.privacy} disabled={isCreating}>
          <legend className={styles.label}>Доступ</legend>
          <Radio
            label="Публичный — виден всем участникам организации"
            name="create-channel-privacy"
            value="public"
            checked={privacy === "public"}
            onChange={() => setPrivacy("public")}
          />
          <Radio
            label="Приватный — только по приглашению"
            name="create-channel-privacy"
            value="private"
            checked={privacy === "private"}
            onChange={() => setPrivacy("private")}
          />
        </fieldset>

        {error !== null && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
