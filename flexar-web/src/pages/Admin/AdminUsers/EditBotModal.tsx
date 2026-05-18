// Flexar Hub Web — edit-bot modal (capability sweep).
//
// Lets the bot's owner (or an admin) rename it, and — for outgoing
// webhook bots — change the endpoint URL and the payload format.
// We deliberately keep the surface narrow: the upstream Zulip admin
// page exposes more knobs (avatar, default channels, ownership
// transfer) but the common need is "I fat-fingered the name" and
// "I redeployed my service on a new URL".
//
// Save calls `apiClient.updateBot` and lets the realtime
// `realm_user` event reconcile the directory.

import { useState } from "react";
import { apiClient } from "../../../api";
import { Banner } from "../../../components/Banner";
import { Button } from "../../../components/Button";
import { Input } from "../../../components/Input";
import { Modal } from "../../../components/Modal";
import { Select } from "../../../components/Select";
import type { SelectOption } from "../../../components/Select";
import type { User } from "../../../domain";
import { BotTypeValues } from "../../../domain";
import { describeApiError } from "../../../lib/errors";
import styles from "./EditBotModal.module.css";

export interface EditBotModalProps {
  open: boolean;
  bot: User;
  /**
   * Current outgoing-webhook endpoint URL, if any. The bot record
   * in `usersStore` doesn't carry it (Zulip exposes it only on the
   * `realm_bot` events / admin GET); the parent passes whatever it
   * knows, or `undefined` to leave the field empty.
   */
  initialPayloadUrl?: string;
  /** Same idea for the outgoing-webhook interface integer. */
  initialServiceInterface?: number;
  onClose: () => void;
}

const INTERFACE_OPTIONS: SelectOption[] = [
  { value: "1", label: "Общий (Generic)" },
  { value: "2", label: "Slack-совместимый" },
];

export function EditBotModal({
  open,
  bot,
  initialPayloadUrl,
  initialServiceInterface,
  onClose,
}: EditBotModalProps): React.JSX.Element {
  const [fullName, setFullName] = useState(bot.full_name);
  const [payloadUrl, setPayloadUrl] = useState(initialPayloadUrl ?? "");
  const [serviceInterface, setServiceInterface] = useState<"1" | "2">(
    String(initialServiceInterface ?? 1) === "2" ? "2" : "1",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOutgoing = bot.bot_type === BotTypeValues.OutgoingWebhook;
  const trimmedName = fullName.trim();
  const trimmedUrl = payloadUrl.trim();
  const nameDirty = trimmedName !== "" && trimmedName !== bot.full_name;
  const urlDirty =
    isOutgoing && trimmedUrl !== "" && trimmedUrl !== (initialPayloadUrl ?? "");
  const interfaceDirty =
    isOutgoing && Number(serviceInterface) !== (initialServiceInterface ?? 1);
  const dirty = nameDirty || urlDirty || interfaceDirty;

  const save = async (): Promise<void> => {
    if (!dirty || saving) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiClient.updateBot(bot.user_id, {
        fullName: nameDirty ? trimmedName : undefined,
        servicePayloadUrl: urlDirty ? trimmedUrl : undefined,
        serviceInterface: interfaceDirty
          ? Number(serviceInterface)
          : undefined,
      });
      onClose();
    } catch (cause) {
      setError(describeApiError(cause, "Не удалось сохранить изменения."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Изменить бота"
      size="sm"
      dismissable={!saving}
      footer={
        <>
          <Button
            variant="secondary"
            size="md"
            onClick={onClose}
            disabled={saving}
          >
            Отмена
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={() => void save()}
            loading={saving}
            disabled={!dirty}
          >
            Сохранить
          </Button>
        </>
      }
    >
      <div className={styles.form}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="edit-bot-name">
            Имя
          </label>
          <Input
            id="edit-bot-name"
            value={fullName}
            onChange={(event) => setFullName(event.currentTarget.value)}
            disabled={saving}
            maxLength={60}
            autoFocus
          />
        </div>
        {isOutgoing && (
          <>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="edit-bot-url">
                URL endpoint
              </label>
              <Input
                id="edit-bot-url"
                type="url"
                value={payloadUrl}
                onChange={(event) =>
                  setPayloadUrl(event.currentTarget.value)
                }
                disabled={saving}
                placeholder="https://example.com/zulip"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="edit-bot-interface">
                Формат payload
              </label>
              <Select
                id="edit-bot-interface"
                value={serviceInterface}
                onChange={(event) =>
                  setServiceInterface(
                    event.currentTarget.value as "1" | "2",
                  )
                }
                disabled={saving}
                options={INTERFACE_OPTIONS}
              />
            </div>
          </>
        )}
        {error !== null && (
          <Banner tone="danger" onDismiss={() => setError(null)}>
            {error}
          </Banner>
        )}
      </div>
    </Modal>
  );
}
