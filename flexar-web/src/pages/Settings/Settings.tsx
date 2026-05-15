// Personal settings page (Phase 5.1).
//
// Single-screen layout with three blocks: Profile (display name),
// Preferences (24-hour time + theme already in navbar), Notifications
// (sound + desktop). Each control is bound to `useUserSettingsStore`
// (snapshot from register, refreshed by realtime `user_settings`
// events) and writes through `apiClient.updateOwnSettings`.
//
// The form is autosave-on-toggle for booleans and explicit-save for
// the display-name input, so a typo doesn't fire a request per
// keystroke. Errors surface as a Banner; success is implied by the
// realtime echo updating the store under the bound control.
//
// Account-level changes (password, API key) are deliberately not
// implemented here — those need careful safety treatment and link
// out to the canonical Zulip account screen instead.

import { useEffect, useState } from "react";
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

export function Settings(): React.JSX.Element {
  const session = useAuthStore((s) => s.session);
  const usersMap = useUsersStore((s) => s.users);
  const ownUser =
    session?.userId !== undefined ? usersMap[session.userId] : undefined;

  const settings = useUserSettingsStore((s) => s.settings);
  const [displayName, setDisplayName] = useState(ownUser?.full_name ?? "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      <section className={styles.section}>
        <h2 className={styles.sectionHeading}>Профиль</h2>
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
        <p className={styles.muted}>
          Email: {session?.email ?? "—"}.
          {" "}
          Смена пароля и аватара — через стандартный интерфейс Zulip.
        </p>
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

