// Permissions tab for the admin user-group detail page (Phase C4).
//
// Edits the six `can_*_group` settings on the group:
//   - can_manage_group
//   - can_join_group
//   - can_leave_group
//   - can_add_members_group
//   - can_remove_members_group
//   - can_mention_group
// Each setting is owned by a `GroupSettingPicker`; the tab maintains a
// local form bag mirroring the store values and only ships the keys
// that actually changed. Realtime `user_group:update` events fold the
// echo into the store, and a per-setting `useEffect` re-syncs the
// local form back to the store's authoritative value (mirrors the
// pattern used by Overview's name/description fields).
//
// Save policy: explicit "Сохранить" button, disabled while clean or
// saving. On click we compute the diff against the store value and
// only send the changed keys. Server-side validation errors surface
// as a single dismissable Banner; the button re-enables on failure.
//
// Read-only paths: system groups carry a banner + everything disabled
// + no Save (mirrors Overview); deactivated groups carry their own
// banner pointing to Overview's reactivate button. The two banners
// are mutually exclusive (system groups are never deactivated).
//
// Self-reference guard: `excludeNamedGroupIds={[group.id]}` is passed
// to every picker so the group can't be made to govern itself in
// "Группа" mode. The custom mode is unaffected — direct membership
// can still grant the permission to anyone.

import { useEffect, useState } from "react";
import { apiClient } from "../../../api";
import type { UpdateUserGroupSettingsParams } from "../../../api";
import { Banner } from "../../../components/Banner";
import { Button } from "../../../components/Button";
import { GroupSettingPicker } from "../../../components/GroupSettingPicker";
import type { GroupSettingValue, UserGroup } from "../../../domain";
import { describeApiError } from "../../../lib/errors";
import styles from "./PermissionsTab.module.css";

export interface PermissionsTabProps {
  group: UserGroup;
  caps: import("../../../lib/hooks/useGroupCapabilities").GroupCapabilities;
}

/**
 * The six editable permission settings, in display order. Each entry
 * ties the `UserGroup` field name (snake_case, matches the wire) to
 * the `UpdateUserGroupSettingsParams` key (camelCase, what the client
 * method expects) and to the operator-facing label / hint.
 */
interface SettingDef {
  field:
    | "can_manage_group"
    | "can_join_group"
    | "can_leave_group"
    | "can_add_members_group"
    | "can_remove_members_group"
    | "can_mention_group";
  paramKey: keyof UpdateUserGroupSettingsParams;
  label: string;
  hint: string;
}

const SETTINGS: SettingDef[] = [
  {
    field: "can_manage_group",
    paramKey: "canManageGroup",
    label: "Управление группой",
    hint: "Кто может переименовывать, редактировать описание и деактивировать.",
  },
  {
    field: "can_join_group",
    paramKey: "canJoinGroup",
    label: "Вступление в группу",
    hint: "Кто может присоединиться самостоятельно.",
  },
  {
    field: "can_leave_group",
    paramKey: "canLeaveGroup",
    label: "Выход из группы",
    hint: "Кто может выйти самостоятельно.",
  },
  {
    field: "can_add_members_group",
    paramKey: "canAddMembersGroup",
    label: "Добавление участников",
    hint: "Кто может добавлять других людей в группу.",
  },
  {
    field: "can_remove_members_group",
    paramKey: "canRemoveMembersGroup",
    label: "Удаление участников",
    hint: "Кто может удалять людей из группы.",
  },
  {
    field: "can_mention_group",
    paramKey: "canMentionGroup",
    label: "Упоминание группы",
    hint: "Кто может @-упоминать группу в сообщениях.",
  },
];

type FormState = Record<SettingDef["field"], GroupSettingValue>;

function initialFormFromGroup(group: UserGroup): FormState {
  return {
    can_manage_group: group.can_manage_group,
    can_join_group: group.can_join_group,
    can_leave_group: group.can_leave_group,
    can_add_members_group: group.can_add_members_group,
    can_remove_members_group: group.can_remove_members_group,
    can_mention_group: group.can_mention_group,
  };
}

/**
 * Value-equality for GroupSettingValue. `number` compares directly;
 * the object shape compares by member / subgroup arrays as ordered
 * lists (the server doesn't promise ordering, but our local edits
 * append, so order is stable within a session — and `JSON.stringify`
 * comparison keeps the dirty-check trivially correct).
 */
function settingsEqual(
  a: GroupSettingValue,
  b: GroupSettingValue,
): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function PermissionsTab({
  group,
  caps,
}: PermissionsTabProps): React.JSX.Element {
  const [form, setForm] = useState<FormState>(() => initialFormFromGroup(group));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Permission edits require full `can_manage_group`. System and
  // deactivated groups stay read-only as before.
  const readOnly =
    group.is_system_group || group.deactivated || !caps.canManage;

  // Per-setting re-sync: when the store's group value for a setting
  // changes (realtime echo, re-register snapshot, or another admin's
  // edit), pull it back into the local form. Keying on the actual
  // value (stringified for the object shape) ensures we don't reset
  // on every parent re-render.
  const groupSnapshot = initialFormFromGroup(group);
  const groupSnapshotKey = JSON.stringify(groupSnapshot);
  useEffect(() => {
    setForm(initialFormFromGroup(group));
    // groupSnapshotKey covers all six fields and changes only when one
    // of them differs structurally from the previous render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupSnapshotKey]);

  const dirtyFields = SETTINGS.filter(
    (s) => !settingsEqual(form[s.field], group[s.field]),
  );
  const dirty = dirtyFields.length > 0;

  const handleSubmit = async (): Promise<void> => {
    if (!dirty || saving || readOnly) {
      return;
    }
    setSaving(true);
    setError(null);
    const params: UpdateUserGroupSettingsParams = {};
    for (const s of dirtyFields) {
      params[s.paramKey] = form[s.field];
    }
    try {
      await apiClient.updateUserGroupSettings(group.id, params);
      // Success: realtime `user_group:update` will fold into the store
      // and the `useEffect` above re-syncs the form.
    } catch (cause) {
      setError(describeApiError(cause, "Не удалось сохранить настройки."));
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: SettingDef["field"]) =>
    (next: GroupSettingValue): void => {
      setForm((prev) => ({ ...prev, [field]: next }));
    };

  return (
    <div className={styles.tabPanel}>
      {group.is_system_group && (
        <Banner tone="info">
          Системная группа — права доступа неизменны.
        </Banner>
      )}
      {!group.is_system_group && group.deactivated && (
        <Banner tone="warning">
          Группа деактивирована — реактивируйте её на вкладке «Обзор»,
          чтобы редактировать права.
        </Banner>
      )}

      {error !== null && (
        <Banner tone="danger" onDismiss={() => setError(null)}>
          {error}
        </Banner>
      )}

      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit();
        }}
      >
        {SETTINGS.map((setting) => (
          <section key={setting.field} className={styles.setting}>
            <header className={styles.settingHeader}>
              <h2 className={styles.settingLabel}>{setting.label}</h2>
              <p className={styles.settingHint}>{setting.hint}</p>
            </header>
            <GroupSettingPicker
              value={form[setting.field]}
              onChange={updateField(setting.field)}
              disabled={readOnly || saving}
              aria-label={setting.label}
              excludeNamedGroupIds={[group.id]}
            />
          </section>
        ))}

        {!readOnly && (
          <div className={styles.actions}>
            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={saving}
              disabled={!dirty}
            >
              Сохранить
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}
