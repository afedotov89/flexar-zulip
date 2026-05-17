// Flexar Hub Web — admin organization settings page (Phase 5.2).
//
// One screen with five sections — Profile, Messages, Access, Default
// channels — each binding a control to the realm-store snapshot
// (hydrated by `register` and folded by `realm` events) and writing
// through `apiClient.updateRealm`. Mirrors the personal-settings page
// (Phase 5.1) for visual rhythm and the autosave-vs-explicit-save
// rule: text inputs (name, description, waiting-period days) need a
// Save click; toggles and selects autosave on change.
//
// Default channels live in their own store (`useDefaultStreamsStore`,
// lazy-fetched on mount) and call the dedicated add/remove endpoints.
//
// Errors surface as a Banner; success is implicit — the realtime
// `realm` / `default_streams` event echoes the change back so the
// store updates the bound control without the page knowing.
//
// Icon upload, group-permission editing, and the rest of the org
// settings surface are deliberately out of scope this iteration; the
// underlying API methods for those have not landed yet.

import { useEffect, useMemo, useRef, useState } from "react";
import { Banner } from "../../../components/Banner";
import { Button } from "../../../components/Button";
import { Input } from "../../../components/Input";
import { Modal } from "../../../components/Modal";
import { Select } from "../../../components/Select";
import type { SelectOption } from "../../../components/Select";
import { Spinner } from "../../../components/Spinner";
import { Textarea } from "../../../components/Textarea";
import { Toggle } from "../../../components/Toggle";
import { apiClient } from "../../../api";
import type { UpdateRealmParams } from "../../../api";
import type { Realm, StreamId } from "../../../domain";
import { describeApiError } from "../../../lib/errors";
import { useStoresLoading } from "../../../lib/hooks/useRealtimeStatus";
import { useDefaultStreamsStore } from "../../../stores/defaultStreamsStore";
import { useRealmStore } from "../../../stores/realmStore";
import { useStreamsStore } from "../../../stores/streamsStore";
import styles from "./AdminOrganization.module.css";

// Values mirror the server's accepted seconds for the corresponding
// `realm.message_content_*_limit_seconds` settings; `0` is the server's
// "unlimited" sentinel.
const TIME_LIMIT_OPTIONS: SelectOption[] = [
  { value: "60", label: "60 секунд" },
  { value: "300", label: "5 минут" },
  { value: "600", label: "10 минут" },
  { value: "3600", label: "1 час" },
  { value: "86400", label: "1 день" },
  { value: "0", label: "Без ограничений" },
];

// Server's `message_retention_days` accepts `-1` for "forever" plus any
// positive integer. The UI keeps a small set of round-number presets;
// custom values are out of scope.
const RETENTION_OPTIONS: SelectOption[] = [
  { value: "-1", label: "Бессрочно" },
  { value: "30", label: "30 дней" },
  { value: "90", label: "90 дней" },
  { value: "180", label: "180 дней" },
  { value: "365", label: "365 дней" },
];

/** Pick the closest preset for a numeric setting; falls back to first. */
function selectedOptionValue(
  options: SelectOption[],
  current: number | undefined,
): string {
  if (current === undefined) {
    return options[0].value;
  }
  const asString = String(current);
  return options.some((option) => option.value === asString)
    ? asString
    : options[0].value;
}

export function AdminOrganization(): React.JSX.Element {
  const realm = useRealmStore((s) => s.realm);
  const storesLoading = useStoresLoading();

  const defaultStreamIds = useDefaultStreamsStore((s) => s.defaultStreams);

  const [error, setError] = useState<string | null>(null);

  const submit = async (params: UpdateRealmParams): Promise<void> => {
    setError(null);
    try {
      await apiClient.updateRealm(params);
    } catch (cause) {
      setError(describeApiError(cause, "Не удалось сохранить настройки."));
    }
  };

  if (storesLoading || realm === null) {
    return (
      <div className={styles.page}>
        <h1 className={styles.heading}>Настройки организации</h1>
        <div className={styles.loading}>
          <Spinner aria-label="Загрузка настроек" />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Настройки организации</h1>
      {error !== null && (
        <Banner tone="danger" onDismiss={() => setError(null)}>
          {error}
        </Banner>
      )}

      <ProfileSection realm={realm} onSubmit={submit} />
      <MessagesSection realm={realm} onSubmit={submit} />
      <AccessSection realm={realm} onSubmit={submit} />
      <DefaultStreamsSection
        defaultStreamIds={defaultStreamIds}
        onError={setError}
      />
    </div>
  );
}

// --- Sections -------------------------------------------------------

interface SectionProps {
  realm: Realm;
  onSubmit: (params: UpdateRealmParams) => Promise<void>;
}

function ProfileSection({
  realm,
  onSubmit,
}: SectionProps): React.JSX.Element {
  const [name, setName] = useState(realm.realm_name ?? "");
  const [description, setDescription] = useState(realm.realm_description ?? "");
  const [savingName, setSavingName] = useState(false);
  const [savingDescription, setSavingDescription] = useState(false);

  // Sync inputs when the store updates from outside (realtime echo,
  // re-register, or another admin's edit).
  useEffect(() => {
    setName(realm.realm_name ?? "");
  }, [realm.realm_name]);
  useEffect(() => {
    setDescription(realm.realm_description ?? "");
  }, [realm.realm_description]);

  const trimmedName = name.trim();
  const dirtyName =
    trimmedName !== "" && trimmedName !== (realm.realm_name ?? "");
  const dirtyDescription = description !== (realm.realm_description ?? "");

  const saveName = async (): Promise<void> => {
    if (!dirtyName) {
      return;
    }
    setSavingName(true);
    await onSubmit({ name: trimmedName });
    setSavingName(false);
  };

  const saveDescription = async (): Promise<void> => {
    if (!dirtyDescription) {
      return;
    }
    setSavingDescription(true);
    await onSubmit({ description });
    setSavingDescription(false);
  };

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionHeading}>Профиль</h2>

      <div className={styles.row}>
        <label className={styles.label} htmlFor="org-name">
          Название организации
        </label>
        <div className={styles.controlInline}>
          <Input
            id="org-name"
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
            disabled={savingName}
            maxLength={40}
          />
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={() => void saveName()}
            loading={savingName}
            disabled={!dirtyName}
          >
            Сохранить
          </Button>
        </div>
      </div>

      <div className={styles.row}>
        <label className={styles.label} htmlFor="org-description">
          Описание
        </label>
        <Textarea
          id="org-description"
          value={description}
          onChange={(event) => setDescription(event.currentTarget.value)}
          disabled={savingDescription}
          rows={3}
        />
        <div className={styles.actions}>
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={() => void saveDescription()}
            loading={savingDescription}
            disabled={!dirtyDescription}
          >
            Сохранить
          </Button>
        </div>
      </div>

      <div className={styles.row}>
        <span className={styles.label}>Иконка</span>
        <RealmAssetPreview
          url={realm.realm_icon_url}
          alt="Иконка организации"
          previewClassName={styles.iconPreview}
          emptyLabel="Иконка не задана."
        />
        <RealmIconUploader />
      </div>

      <div className={styles.row}>
        <span className={styles.label}>Логотип (светлая тема)</span>
        <RealmAssetPreview
          url={realm.realm_logo_url}
          alt="Логотип организации, светлая тема"
          previewClassName={styles.logoPreview}
          emptyLabel="Логотип не задан."
        />
        <RealmLogoUploader night={false} />
      </div>

      <div className={styles.row}>
        <span className={styles.label}>Логотип (тёмная тема)</span>
        <RealmAssetPreview
          url={realm.realm_night_logo_url}
          alt="Логотип организации, тёмная тема"
          previewClassName={`${styles.logoPreview} ${styles.logoPreviewDark}`}
          emptyLabel="Логотип не задан."
        />
        <RealmLogoUploader night={true} />
      </div>
    </section>
  );
}

/**
 * Preview tile for a realm asset (icon / light logo / night logo).
 * Shows the image when the URL is set and loads OK, otherwise a
 * muted "not set" label. The broken-image fallback is local state
 * — re-armed whenever the URL changes (a successful upload bumps the
 * server-side version query and re-attempts the load).
 *
 * Used by three slots so the broken-on-error logic isn't pasted
 * three times. The icon and the two logos differ only in URL,
 * alt-text, and preview chrome.
 */
function RealmAssetPreview({
  url,
  alt,
  previewClassName,
  emptyLabel,
}: {
  url: string | undefined;
  alt: string;
  previewClassName: string;
  emptyLabel: string;
}): React.JSX.Element {
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    setBroken(false);
  }, [url]);
  if (url === undefined || url === "" || broken) {
    return <span className={styles.muted}>{emptyLabel}</span>;
  }
  return (
    <img
      src={url}
      alt={alt}
      className={previewClassName}
      onError={() => setBroken(true)}
    />
  );
}

/**
 * Tiny file-picker + status panel for `realm/icon` uploads. Lives
 * inside `ProfileSection` because the icon row is the natural place
 * for it; isolated as its own component so the upload state machine
 * (idle / uploading / error) doesn't leak into the section's props.
 *
 * On success, no local state-write is needed — the server emits a
 * `realm` event with the new `realm_icon_url`; `realmReducer` folds
 * it; the image above re-renders against the new URL.
 */
function RealmIconUploader(): React.JSX.Element {
  const [status, setStatus] = useState<
    { kind: "idle" } | { kind: "uploading" } | { kind: "error"; message: string }
  >({ kind: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);

  const onChoose = (): void => inputRef.current?.click();
  const onFile = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (file === undefined) {
      return;
    }
    setStatus({ kind: "uploading" });
    try {
      await apiClient.uploadRealmIcon({ file });
      setStatus({ kind: "idle" });
    } catch (cause) {
      setStatus({ kind: "error", message: describeApiError(cause) });
    }
  };

  return (
    <span className={styles.uploaderSlot}>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        // Visually-hidden file input — the button is the affordance.
        // Same pattern as the compose upload paperclip.
        hidden
        onChange={(event) => void onFile(event)}
      />
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={onChoose}
        loading={status.kind === "uploading"}
        disabled={status.kind === "uploading"}
      >
        Загрузить иконку
      </Button>
      {status.kind === "error" && (
        <span className={styles.errorText} role="alert">
          {status.message}
        </span>
      )}
    </span>
  );
}

/**
 * Same shape as `RealmIconUploader` but for `realm/logo`. `night`
 * selects the dark-theme variant — the server stores light and dark
 * logos separately and emits them on the realm as
 * `realm_logo_url` / `realm_night_logo_url`. Each variant is its
 * own slot in `ProfileSection`, so the admin can update one without
 * touching the other.
 */
function RealmLogoUploader({ night }: { night: boolean }): React.JSX.Element {
  const [status, setStatus] = useState<
    { kind: "idle" } | { kind: "uploading" } | { kind: "error"; message: string }
  >({ kind: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);

  const onChoose = (): void => inputRef.current?.click();
  const onFile = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (file === undefined) {
      return;
    }
    setStatus({ kind: "uploading" });
    try {
      await apiClient.uploadRealmLogo({ file, night });
      setStatus({ kind: "idle" });
    } catch (cause) {
      setStatus({ kind: "error", message: describeApiError(cause) });
    }
  };

  return (
    <span className={styles.uploaderSlot}>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        hidden
        onChange={(event) => void onFile(event)}
      />
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={onChoose}
        loading={status.kind === "uploading"}
        disabled={status.kind === "uploading"}
      >
        Загрузить логотип
      </Button>
      {status.kind === "error" && (
        <span className={styles.errorText} role="alert">
          {status.message}
        </span>
      )}
    </span>
  );
}

function MessagesSection({
  realm,
  onSubmit,
}: SectionProps): React.JSX.Element {
  const allowEditing = realm.realm_allow_message_editing ?? true;
  const editLimit = selectedOptionValue(
    TIME_LIMIT_OPTIONS,
    realm.realm_message_content_edit_limit_seconds,
  );
  const deleteLimit = selectedOptionValue(
    TIME_LIMIT_OPTIONS,
    realm.realm_message_content_delete_limit_seconds,
  );
  const retention = selectedOptionValue(
    RETENTION_OPTIONS,
    realm.realm_message_retention_days,
  );

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionHeading}>Сообщения</h2>

      <div className={styles.row}>
        <Toggle
          label="Разрешить редактирование сообщений"
          checked={allowEditing}
          onChange={(event) =>
            void onSubmit({
              allow_message_editing: event.currentTarget.checked,
            })
          }
        />
        <span className={styles.muted}>
          Авторы смогут изменять отправленные сообщения.
        </span>
      </div>

      <div className={styles.row}>
        <label className={styles.label} htmlFor="org-edit-limit">
          Ограничение времени редактирования
        </label>
        <Select
          id="org-edit-limit"
          value={editLimit}
          options={TIME_LIMIT_OPTIONS}
          disabled={!allowEditing}
          onChange={(event) =>
            void onSubmit({
              message_content_edit_limit_seconds: Number(
                event.currentTarget.value,
              ),
            })
          }
        />
      </div>

      <div className={styles.row}>
        <label className={styles.label} htmlFor="org-delete-limit">
          Ограничение времени удаления
        </label>
        <Select
          id="org-delete-limit"
          value={deleteLimit}
          options={TIME_LIMIT_OPTIONS}
          onChange={(event) =>
            void onSubmit({
              message_content_delete_limit_seconds: Number(
                event.currentTarget.value,
              ),
            })
          }
        />
      </div>

      <div className={styles.row}>
        <label className={styles.label} htmlFor="org-retention">
          Хранение сообщений
        </label>
        <Select
          id="org-retention"
          value={retention}
          options={RETENTION_OPTIONS}
          onChange={(event) =>
            void onSubmit({
              message_retention_days: Number(event.currentTarget.value),
            })
          }
        />
      </div>
    </section>
  );
}

function AccessSection({ realm, onSubmit }: SectionProps): React.JSX.Element {
  const inviteRequired = realm.realm_invite_required ?? false;
  const storedWaitingPeriod = realm.realm_waiting_period_threshold ?? 0;
  const [waitingPeriod, setWaitingPeriod] = useState(String(storedWaitingPeriod));
  const [savingWaitingPeriod, setSavingWaitingPeriod] = useState(false);

  useEffect(() => {
    setWaitingPeriod(String(storedWaitingPeriod));
  }, [storedWaitingPeriod]);

  const parsed = Number(waitingPeriod);
  const validWaitingPeriod =
    waitingPeriod !== "" && Number.isFinite(parsed) && parsed >= 0;
  const dirtyWaitingPeriod =
    validWaitingPeriod && parsed !== storedWaitingPeriod;

  const saveWaitingPeriod = async (): Promise<void> => {
    if (!dirtyWaitingPeriod) {
      return;
    }
    setSavingWaitingPeriod(true);
    await onSubmit({ waiting_period_threshold: parsed });
    setSavingWaitingPeriod(false);
  };

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionHeading}>Доступ</h2>

      <div className={styles.row}>
        <Toggle
          label="Требовать приглашение для регистрации"
          checked={inviteRequired}
          onChange={(event) =>
            void onSubmit({ invite_required: event.currentTarget.checked })
          }
        />
        <span className={styles.muted}>
          Без приглашения создать аккаунт нельзя.
        </span>
      </div>

      <div className={styles.row}>
        <label className={styles.label} htmlFor="org-waiting-period">
          Период ожидания для новых пользователей (дни)
        </label>
        <div className={styles.controlInline}>
          <Input
            id="org-waiting-period"
            type="number"
            inputMode="numeric"
            min={0}
            value={waitingPeriod}
            onChange={(event) => setWaitingPeriod(event.currentTarget.value)}
            disabled={savingWaitingPeriod}
            invalid={!validWaitingPeriod}
          />
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={() => void saveWaitingPeriod()}
            loading={savingWaitingPeriod}
            disabled={!dirtyWaitingPeriod}
          >
            Сохранить
          </Button>
        </div>
        <span className={styles.muted}>
          До истечения срока новый аккаунт не получит права полноправного
          участника.
        </span>
      </div>
    </section>
  );
}

interface DefaultStreamsSectionProps {
  defaultStreamIds: StreamId[];
  onError: (message: string | null) => void;
}

function DefaultStreamsSection({
  defaultStreamIds,
  onError,
}: DefaultStreamsSectionProps): React.JSX.Element {
  const streamsMap = useStreamsStore((s) => s.streams);
  const [busyStreamId, setBusyStreamId] = useState<StreamId | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [picked, setPicked] = useState<string>("");
  const [adding, setAdding] = useState(false);

  const sortedDefaults = useMemo(() => {
    return [...defaultStreamIds].sort((a, b) => {
      const aName = streamsMap[a]?.name ?? "";
      const bName = streamsMap[b]?.name ?? "";
      return aName.localeCompare(bName, undefined, { sensitivity: "base" });
    });
  }, [defaultStreamIds, streamsMap]);

  const candidateOptions = useMemo<SelectOption[]>(() => {
    const defaultsSet = new Set(defaultStreamIds);
    const all = Object.values(streamsMap);
    const candidates = all
      .filter((stream) => !defaultsSet.has(stream.stream_id))
      .sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      );
    return candidates.map((stream) => ({
      value: String(stream.stream_id),
      label: stream.name,
    }));
  }, [defaultStreamIds, streamsMap]);

  const remove = async (streamId: StreamId): Promise<void> => {
    onError(null);
    setBusyStreamId(streamId);
    try {
      await apiClient.removeDefaultStream(streamId);
    } catch (cause) {
      onError(describeApiError(cause, "Не удалось удалить канал."));
    } finally {
      setBusyStreamId(null);
    }
  };

  const closeAddModal = (): void => {
    setAddModalOpen(false);
    setPicked("");
  };

  const add = async (): Promise<void> => {
    if (picked === "") {
      return;
    }
    onError(null);
    setAdding(true);
    try {
      await apiClient.addDefaultStream(Number(picked));
      closeAddModal();
    } catch (cause) {
      onError(describeApiError(cause, "Не удалось добавить канал."));
    } finally {
      setAdding(false);
    }
  };

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionHeading}>Каналы по умолчанию</h2>
      <p className={styles.muted}>
        Новые пользователи автоматически подписываются на эти каналы.
      </p>

      {sortedDefaults.length === 0 ? (
        <p className={styles.muted}>Список пуст.</p>
      ) : (
        <ul className={styles.streamList} aria-label="Каналы по умолчанию">
          {sortedDefaults.map((streamId) => {
            const stream = streamsMap[streamId];
            const label = stream?.name ?? `Канал #${streamId}`;
            return (
              <li key={streamId} className={styles.streamRow}>
                <span className={styles.streamName}>{label}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void remove(streamId)}
                  loading={busyStreamId === streamId}
                  disabled={busyStreamId !== null}
                >
                  Удалить
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <div className={styles.actions}>
        <Button
          type="button"
          variant="secondary"
          size="md"
          onClick={() => setAddModalOpen(true)}
          disabled={candidateOptions.length === 0}
        >
          Добавить канал
        </Button>
      </div>

      <Modal
        open={addModalOpen}
        onClose={closeAddModal}
        title="Добавить канал по умолчанию"
        size="sm"
        footer={
          <>
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={closeAddModal}
              disabled={adding}
            >
              Отмена
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={() => void add()}
              loading={adding}
              disabled={picked === ""}
            >
              Добавить
            </Button>
          </>
        }
      >
        <div className={styles.row}>
          <label className={styles.label} htmlFor="org-add-default-stream">
            Канал
          </label>
          <Select
            id="org-add-default-stream"
            value={picked}
            options={candidateOptions}
            placeholder="Выберите канал"
            onChange={(event) => setPicked(event.currentTarget.value)}
          />
        </div>
      </Modal>
    </section>
  );
}
