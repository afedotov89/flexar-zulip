// Personal settings page (Phase 5.1; account-level controls added).
//
// Four blocks:
//   1. Профиль — display name + avatar upload
//   2. Безопасность — password change (POST /settings)
//   3. Предпочтения — 24-hour time, starred counters
//   4. Уведомления — sound + desktop + typing
//
// All bound to `useUserSettingsStore` (snapshot from register,
// refreshed by realtime `user_settings` events) and write through
// `apiClient.updateOwnSettings` for booleans, dedicated methods for
// avatar (`uploadOwnAvatar`) and password (`changeOwnPassword`).
//
// We intentionally implement avatar + password ourselves rather than
// linking to Zulip's web UI — this app is a full replacement of that
// surface (PRD §1.1), so falling back to it for any user-facing
// flow defeats the purpose.

import { useEffect, useRef, useState } from "react";
import { Avatar } from "../../components/Avatar";
import { Banner } from "../../components/Banner";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { Toggle } from "../../components/Toggle";
import { apiClient } from "../../api";
import type { UpdateOwnSettingsParams } from "../../api";
import { describeApiError } from "../../lib/errors";
import { useAuthStore } from "../../stores/authStore";
import { useUserSettingsStore } from "../../stores/userSettingsStore";
import { useUsersStore } from "../../stores/usersStore";
import styles from "./Settings.module.css";

/**
 * Accepted MIME types for the avatar input. Matches the realm-icon
 * uploader's list — Zulip's `/users/me/avatar` endpoint stores any
 * image MIME it can transcode, but limiting on the client side
 * filters out PDFs / videos in the file picker.
 */
const AVATAR_ACCEPT = "image/png,image/jpeg,image/gif,image/webp";

export function Settings(): React.JSX.Element {
  const session = useAuthStore((s) => s.session);
  const usersMap = useUsersStore((s) => s.users);
  const ownUser =
    session?.userId !== undefined ? usersMap[session.userId] : undefined;

  const settings = useUserSettingsStore((s) => s.settings);
  const [displayName, setDisplayName] = useState(ownUser?.full_name ?? "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Sync the controlled input when the store hydrates after a cold
  // mount (the page can be rendered before `realm_user` arrives).
  useEffect(() => {
    if (ownUser?.full_name !== undefined) {
      setDisplayName(ownUser.full_name);
    }
  }, [ownUser?.full_name]);

  const dirtyDisplayName =
    displayName.trim() !== "" && displayName.trim() !== ownUser?.full_name;

  const submit = async (params: UpdateOwnSettingsParams): Promise<void> => {
    setError(null);
    try {
      await apiClient.updateOwnSettings(params);
    } catch (cause) {
      setError(describeApiError(cause, "Не удалось обновить настройки."));
    }
  };

  const saveProfile = async (): Promise<void> => {
    if (!dirtyDisplayName) {
      return;
    }
    setSavingProfile(true);
    await submit({ fullName: displayName.trim() });
    setSavingProfile(false);
  };

  const toggleBoolean = (
    name: keyof UpdateOwnSettingsParams,
    next: boolean,
  ): void => {
    void submit({ [name]: next } as UpdateOwnSettingsParams);
  };

  const get = (name: string): boolean | undefined => {
    const value = settings[name];
    return typeof value === "boolean" ? value : undefined;
  };

  return (
    <div className={styles.settings}>
      <h1 className={styles.heading}>Настройки</h1>
      {error !== null && (
        <Banner tone="danger" onDismiss={() => setError(null)}>
          {error}
        </Banner>
      )}
      {notice !== null && (
        <Banner tone="success" onDismiss={() => setNotice(null)}>
          {notice}
        </Banner>
      )}

      <section className={styles.section}>
        <h2 className={styles.sectionHeading}>Профиль</h2>

        <AvatarRow
          user={ownUser}
          onError={setError}
          onUploaded={() => setNotice("Аватар обновлён.")}
        />

        <div className={styles.row}>
          <label className={styles.label} htmlFor="settings-display-name">
            Отображаемое имя
          </label>
          <div className={styles.controlInline}>
            <Input
              id="settings-display-name"
              value={displayName}
              onChange={(event) => setDisplayName(event.currentTarget.value)}
              disabled={savingProfile}
              maxLength={60}
            />
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={() => void saveProfile()}
              loading={savingProfile}
              disabled={!dirtyDisplayName}
            >
              Сохранить
            </Button>
          </div>
        </div>
        <p className={styles.muted}>Email: {session?.email ?? "—"}.</p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionHeading}>Безопасность</h2>
        <PasswordChangeForm
          onError={setError}
          onSuccess={() => setNotice("Пароль обновлён.")}
        />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionHeading}>Предпочтения</h2>
        <ToggleRow
          label="24-часовой формат времени"
          description="Показывать время в формате 14:30 вместо 2:30 PM."
          checked={get("twenty_four_hour_time") ?? false}
          onChange={(next) => toggleBoolean("twenty_four_hour_time", next)}
        />
        <ToggleRow
          label="Счётчик звёзд"
          description="Показывать число отмеченных сообщений в сайдбаре."
          checked={get("starred_message_counts") ?? true}
          onChange={(next) => toggleBoolean("starred_message_counts", next)}
        />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionHeading}>Уведомления</h2>
        <ToggleRow
          label="Десктопные уведомления"
          description="Показывать всплывающие уведомления операционной системы."
          checked={get("enable_desktop_notifications") ?? true}
          onChange={(next) =>
            toggleBoolean("enable_desktop_notifications", next)
          }
        />
        <ToggleRow
          label="Звук уведомлений"
          description="Воспроизводить звук при упоминании или личном сообщении."
          checked={get("enable_sounds") ?? true}
          onChange={(next) => toggleBoolean("enable_sounds", next)}
        />
        <ToggleRow
          label="Получать уведомления о наборе текста"
          description="Видеть «N печатает…» от других участников."
          checked={get("receives_typing_notifications") ?? true}
          onChange={(next) =>
            toggleBoolean("receives_typing_notifications", next)
          }
        />
      </section>
    </div>
  );
}

interface ToggleRowProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: ToggleRowProps): React.JSX.Element {
  return (
    <div className={styles.row}>
      <div className={styles.labelGroup}>
        <Toggle
          label={label}
          checked={checked}
          onChange={(event) => onChange(event.currentTarget.checked)}
        />
        {description !== undefined && (
          <span className={styles.muted}>{description}</span>
        )}
      </div>
    </div>
  );
}

interface AvatarRowProps {
  user: import("../../domain").User | undefined;
  onError: (message: string) => void;
  onUploaded: () => void;
}

function AvatarRow({
  user,
  onError,
  onUploaded,
}: AvatarRowProps): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const choose = (): void => {
    inputRef.current?.click();
  };

  const onFileChosen = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const file = event.currentTarget.files?.[0];
    // Clear the input so the same file can be re-picked after an error.
    event.currentTarget.value = "";
    if (file === undefined) {
      return;
    }
    setUploading(true);
    try {
      await apiClient.uploadOwnAvatar({ file });
      onUploaded();
    } catch (cause) {
      onError(describeApiError(cause, "Не удалось загрузить аватар."));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={styles.avatarRow}>
      <Avatar
        size="lg"
        name={user?.full_name ?? "?"}
        src={user?.avatar_url ?? undefined}
      />
      <div className={styles.avatarControls}>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={choose}
          loading={uploading}
        >
          {user?.avatar_url ? "Сменить аватар" : "Загрузить аватар"}
        </Button>
        <span className={styles.avatarHint}>
          PNG, JPEG, GIF или WebP. Изменение применится через несколько секунд.
        </span>
        <input
          ref={inputRef}
          type="file"
          accept={AVATAR_ACCEPT}
          hidden
          onChange={(event) => void onFileChosen(event)}
        />
      </div>
    </div>
  );
}

interface PasswordChangeFormProps {
  onError: (message: string) => void;
  onSuccess: () => void;
}

function PasswordChangeForm({
  onError,
  onSuccess,
}: PasswordChangeFormProps): React.JSX.Element {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [mismatch, setMismatch] = useState(false);

  const reset = (): void => {
    setOldPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setMismatch(false);
  };

  const submit = async (
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    if (saving) {
      return;
    }
    if (newPassword.length === 0 || oldPassword.length === 0) {
      return;
    }
    if (newPassword !== confirmPassword) {
      setMismatch(true);
      return;
    }
    setSaving(true);
    try {
      await apiClient.changeOwnPassword({ oldPassword, newPassword });
      reset();
      onSuccess();
    } catch (cause) {
      onError(describeApiError(cause, "Не удалось изменить пароль."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      className={styles.passwordForm}
      onSubmit={(event) => void submit(event)}
    >
      <div className={styles.passwordField}>
        <label className={styles.label} htmlFor="settings-old-password">
          Текущий пароль
        </label>
        <Input
          id="settings-old-password"
          type="password"
          autoComplete="current-password"
          value={oldPassword}
          onChange={(event) => setOldPassword(event.currentTarget.value)}
          disabled={saving}
        />
      </div>
      <div className={styles.passwordField}>
        <label className={styles.label} htmlFor="settings-new-password">
          Новый пароль
        </label>
        <Input
          id="settings-new-password"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(event) => {
            setNewPassword(event.currentTarget.value);
            setMismatch(false);
          }}
          disabled={saving}
        />
      </div>
      <div className={styles.passwordField}>
        <label className={styles.label} htmlFor="settings-confirm-password">
          Подтвердите новый пароль
        </label>
        <Input
          id="settings-confirm-password"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => {
            setConfirmPassword(event.currentTarget.value);
            setMismatch(false);
          }}
          disabled={saving}
        />
        {mismatch && (
          <span className={styles.passwordFieldError}>
            Подтверждение не совпадает с новым паролем.
          </span>
        )}
      </div>
      <div className={styles.passwordSubmit}>
        <Button
          type="submit"
          variant="primary"
          size="md"
          loading={saving}
          disabled={
            oldPassword.length === 0 ||
            newPassword.length === 0 ||
            confirmPassword.length === 0
          }
        >
          Изменить пароль
        </Button>
      </div>
    </form>
  );
}
