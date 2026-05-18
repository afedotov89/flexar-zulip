// Flexar Hub Web — regenerate-bot-api-key modal (capability sweep).
//
// Two-step flow: a confirm screen explaining that the old key stops
// working, then a success screen revealing the new key with a
// Copy / Download zuliprc affordance. The new key is the ONLY moment
// the user can capture it without regenerating again — Zulip's REST
// API has no "look up an existing bot's key" endpoint for
// non-admins (admins do have `GET /bots/{id}/api_key`, but we treat
// the new key as the canonical save point either way).

import { useState } from "react";
import { apiClient } from "../../../api";
import { Banner } from "../../../components/Banner";
import { Button } from "../../../components/Button";
import { Input } from "../../../components/Input";
import { Modal } from "../../../components/Modal";
import type { User } from "../../../domain";
import { describeApiError } from "../../../lib/errors";
import { downloadZuliprc } from "./botCredentials";
import styles from "./RegenerateBotKeyModal.module.css";

export interface RegenerateBotKeyModalProps {
  open: boolean;
  bot: User;
  realmUrl: string | undefined;
  onClose: () => void;
}

export function RegenerateBotKeyModal({
  open,
  bot,
  realmUrl,
  onClose,
}: RegenerateBotKeyModalProps): React.JSX.Element {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const reset = (): void => {
    setSubmitting(false);
    setError(null);
    setNewKey(null);
    setCopied(false);
  };

  const handleClose = (): void => {
    if (submitting) {
      return;
    }
    reset();
    onClose();
  };

  const regenerate = async (): Promise<void> => {
    if (submitting) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const key = await apiClient.regenerateBotApiKey(bot.user_id);
      setNewKey(key);
    } catch (cause) {
      setError(
        describeApiError(cause, "Не удалось перегенерировать ключ."),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const copy = async (): Promise<void> => {
    if (newKey === null) {
      return;
    }
    try {
      await navigator.clipboard.writeText(newKey);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Не удалось скопировать ключ. Скопируйте вручную.");
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={newKey === null ? "Сбросить ключ?" : "Новый ключ"}
      size="sm"
      dismissable={!submitting}
      footer={
        newKey === null ? (
          <>
            <Button
              variant="secondary"
              size="md"
              onClick={handleClose}
              disabled={submitting}
            >
              Отмена
            </Button>
            <Button
              variant="danger"
              size="md"
              onClick={() => void regenerate()}
              loading={submitting}
            >
              Сбросить
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" size="md" onClick={handleClose}>
              Закрыть
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() =>
                downloadZuliprc({
                  email: bot.email,
                  apiKey: newKey,
                  shortName:
                    bot.email.split("@")[0]?.replace(/-bot$/, "") ??
                    "bot",
                  realmUrl,
                })
              }
            >
              Скачать zuliprc
            </Button>
          </>
        )
      }
    >
      <div className={styles.body}>
        {newKey === null ? (
          <p className={styles.intro}>
            Старый API-ключ бота <strong>{bot.full_name}</strong> перестанет
            работать сразу после операции. Все интеграции, использующие
            старый ключ, нужно будет перенастроить.
          </p>
        ) : (
          <>
            <p className={styles.intro}>
              Ключ перегенерирован. Сохраните его — посмотреть снова
              невозможно, только перегенерировать.
            </p>
            <div className={styles.keyRow}>
              <Input id="regen-bot-key" value={newKey} readOnly />
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => void copy()}
              >
                {copied ? "Скопировано" : "Копировать"}
              </Button>
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
