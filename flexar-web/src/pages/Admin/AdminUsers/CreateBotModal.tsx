// Flexar Hub Web — create-bot modal (capability sweep).
//
// Asks for the four pieces of info every Zulip bot needs (name,
// short name, type, and — for outgoing webhooks — the service URL +
// interface), submits via `apiClient.createBot`, and on success
// hands back the new API key for the success-screen step.
//
// Permission shape:
//   - A user in `can_create_bots_group` (or a realm admin) sees the
//     three bot types in a Select: Generic / Incoming webhook /
//     Outgoing webhook.
//   - A user with only `can_create_write_only_bots_group` doesn't
//     get to pick a type — the form is locked to Incoming webhook
//     (the only type the server will accept from them). The Type
//     row renders as a read-only line so they understand why.
//
// The server-side response includes the new API key in cleartext.
// We surface it once on a success screen with a Copy / Download
// zuliprc affordance — Zulip's REST API has no "look up an
// existing bot's key" endpoint for non-admins, so this is the only
// moment the user can save it without regenerating.

import { useState } from "react";
import { apiClient } from "../../../api";
import { Banner } from "../../../components/Banner";
import { Button } from "../../../components/Button";
import { Input } from "../../../components/Input";
import { Modal } from "../../../components/Modal";
import { Select } from "../../../components/Select";
import type { SelectOption } from "../../../components/Select";
import { BotTypeValues } from "../../../domain";
import type { BotType as BotTypeValue } from "../../../domain";
import { describeApiError } from "../../../lib/errors";
import type { AdminCapabilities } from "../../../lib/hooks/useAdminCapabilities";
import { downloadZuliprc, formatBotEmail } from "./botCredentials";
import styles from "./CreateBotModal.module.css";

export interface CreateBotModalProps {
  open: boolean;
  onClose: () => void;
  /**
   * Capabilities of the signed-in user, used to gate the Type
   * selector. Computed by the parent so we don't double-fire the
   * `useAdminCapabilities` selector.
   */
  capabilities: AdminCapabilities;
  /**
   * Realm slug used to format the bot's email (`<short_name>-bot@<slug>`)
   * for the zuliprc download. Pulled from the realm store by the
   * parent — passed in to keep this component free of store hooks.
   */
  realmUrl: string | undefined;
}

type AvailableType = "generic" | "incoming" | "outgoing";

const TYPE_TO_WIRE: Record<AvailableType, BotTypeValue> = {
  generic: BotTypeValues.Generic,
  incoming: BotTypeValues.IncomingWebhook,
  outgoing: BotTypeValues.OutgoingWebhook,
};

const FULL_TYPE_OPTIONS: SelectOption[] = [
  { value: "generic", label: "Универсальный" },
  { value: "incoming", label: "Incoming webhook" },
  { value: "outgoing", label: "Outgoing webhook" },
];

const INTERFACE_OPTIONS: SelectOption[] = [
  { value: "1", label: "Общий (Generic)" },
  { value: "2", label: "Slack-совместимый" },
];

// Local-part validator: Zulip's server requires the short_name to
// match `[A-Za-z0-9._-]+`. We mirror that here so the user gets the
// feedback before the round-trip.
const SHORT_NAME_PATTERN = /^[A-Za-z0-9._-]+$/;

interface SuccessState {
  fullName: string;
  shortName: string;
  apiKey: string;
  email: string;
}

export function CreateBotModal({
  open,
  onClose,
  capabilities,
  realmUrl,
}: CreateBotModalProps): React.JSX.Element {
  // Pick the initial type based on what the user is actually
  // allowed to create. Generic-eligible users default to "generic";
  // write-only-only users land on "incoming" with no selector.
  const allowsFullPalette =
    capabilities.isRealmAdmin || capabilities.canCreateBots;
  const initialType: AvailableType = allowsFullPalette
    ? "generic"
    : "incoming";

  const [fullName, setFullName] = useState("");
  const [shortName, setShortName] = useState("");
  const [type, setType] = useState<AvailableType>(initialType);
  const [serviceUrl, setServiceUrl] = useState("");
  const [serviceInterface, setServiceInterface] = useState<"1" | "2">("1");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessState | null>(null);

  const reset = (): void => {
    setFullName("");
    setShortName("");
    setType(initialType);
    setServiceUrl("");
    setServiceInterface("1");
    setError(null);
    setSuccess(null);
  };

  const handleClose = (): void => {
    if (submitting) {
      return;
    }
    reset();
    onClose();
  };

  const trimmedFullName = fullName.trim();
  const trimmedShortName = shortName.trim();
  const trimmedServiceUrl = serviceUrl.trim();
  const shortNameValid =
    trimmedShortName !== "" && SHORT_NAME_PATTERN.test(trimmedShortName);
  const serviceUrlValid =
    type !== "outgoing" || trimmedServiceUrl !== "";
  const formValid =
    trimmedFullName !== "" && shortNameValid && serviceUrlValid;

  const submit = async (): Promise<void> => {
    if (!formValid || submitting) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await apiClient.createBot({
        fullName: trimmedFullName,
        shortName: trimmedShortName,
        botType: TYPE_TO_WIRE[type],
        payloadUrl: type === "outgoing" ? trimmedServiceUrl : undefined,
        interfaceType:
          type === "outgoing" ? Number(serviceInterface) : undefined,
      });
      setSuccess({
        fullName: trimmedFullName,
        shortName: trimmedShortName,
        apiKey: result.api_key,
        email: formatBotEmail(trimmedShortName, realmUrl),
      });
    } catch (cause) {
      setError(describeApiError(cause, "Не удалось создать бота."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={success !== null ? "Бот создан" : "Создать бота"}
      size="sm"
      dismissable={!submitting}
      footer={
        success !== null ? (
          <>
            <Button variant="secondary" size="md" onClick={handleClose}>
              Закрыть
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() =>
                downloadZuliprc({
                  email: success.email,
                  apiKey: success.apiKey,
                  shortName: success.shortName,
                  realmUrl,
                })
              }
            >
              Скачать zuliprc
            </Button>
          </>
        ) : (
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
              variant="primary"
              size="md"
              onClick={() => void submit()}
              loading={submitting}
              disabled={!formValid}
            >
              Создать
            </Button>
          </>
        )
      }
    >
      {success !== null ? (
        <CreateBotSuccess
          success={success}
          onError={setError}
          errorMessage={error}
        />
      ) : (
        <div className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="create-bot-name">
              Имя
            </label>
            <Input
              id="create-bot-name"
              value={fullName}
              onChange={(event) => setFullName(event.currentTarget.value)}
              disabled={submitting}
              maxLength={60}
              autoFocus
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="create-bot-short">
              Короткое имя
            </label>
            <Input
              id="create-bot-short"
              value={shortName}
              onChange={(event) => setShortName(event.currentTarget.value)}
              disabled={submitting}
              invalid={shortName !== "" && !shortNameValid}
              maxLength={60}
            />
            <span className={styles.hint}>
              Только латиница, цифры, точка, дефис и подчёркивание.
              {realmUrl !== undefined && trimmedShortName !== "" && (
                <>
                  {" "}
                  Email бота: {formatBotEmail(trimmedShortName, realmUrl)}.
                </>
              )}
            </span>
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="create-bot-type">
              Тип
            </label>
            {allowsFullPalette ? (
              <Select
                id="create-bot-type"
                value={type}
                onChange={(event) =>
                  setType(event.currentTarget.value as AvailableType)
                }
                disabled={submitting}
                options={FULL_TYPE_OPTIONS}
              />
            ) : (
              <span className={styles.lockedType}>
                Incoming webhook
                <span className={styles.hint}>
                  Ваши права позволяют создавать только этот тип.
                </span>
              </span>
            )}
          </div>
          {type === "outgoing" && (
            <>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="create-bot-url">
                  URL endpoint
                </label>
                <Input
                  id="create-bot-url"
                  type="url"
                  value={serviceUrl}
                  onChange={(event) =>
                    setServiceUrl(event.currentTarget.value)
                  }
                  disabled={submitting}
                  placeholder="https://example.com/zulip"
                />
              </div>
              <div className={styles.field}>
                <label
                  className={styles.label}
                  htmlFor="create-bot-interface"
                >
                  Формат payload
                </label>
                <Select
                  id="create-bot-interface"
                  value={serviceInterface}
                  onChange={(event) =>
                    setServiceInterface(
                      event.currentTarget.value as "1" | "2",
                    )
                  }
                  disabled={submitting}
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
      )}
    </Modal>
  );
}

interface CreateBotSuccessProps {
  success: SuccessState;
  errorMessage: string | null;
  onError: (message: string | null) => void;
}

function CreateBotSuccess({
  success,
  errorMessage,
  onError,
}: CreateBotSuccessProps): React.JSX.Element {
  const [copied, setCopied] = useState(false);
  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(success.apiKey);
      setCopied(true);
      onError(null);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      onError("Не удалось скопировать ключ. Скопируйте вручную из поля.");
    }
  };

  return (
    <div className={styles.success}>
      <p className={styles.successIntro}>
        Бот <strong>{success.fullName}</strong> создан. Сохраните API-ключ —
        его нельзя посмотреть позже, только перегенерировать.
      </p>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="create-bot-email">
          Email
        </label>
        <Input id="create-bot-email" value={success.email} readOnly />
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="create-bot-key">
          API key
        </label>
        <div className={styles.keyRow}>
          <Input id="create-bot-key" value={success.apiKey} readOnly />
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={() => void copy()}
          >
            {copied ? "Скопировано" : "Копировать"}
          </Button>
        </div>
      </div>
      {errorMessage !== null && (
        <Banner tone="danger" onDismiss={() => onError(null)}>
          {errorMessage}
        </Banner>
      )}
    </div>
  );
}
