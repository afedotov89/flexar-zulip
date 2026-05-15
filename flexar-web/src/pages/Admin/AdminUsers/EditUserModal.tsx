// Flexar Hub Web — admin user edit modal (Phase 5.4).
//
// Renders a small form for renaming a user and changing their
// organization role. Save writes optimistically into `useUsersStore`,
// then calls `apiClient.updateUser`. On REST failure the snapshotted
// user record is restored and the inline error surfaces so the admin
// can retry or cancel. The modal stays mounted across the in-flight
// request — closing only happens on success or explicit cancel.

import { useCallback, useState } from "react";
import { apiClient } from "../../../api";
import { Button } from "../../../components/Button";
import { Input } from "../../../components/Input";
import { Modal } from "../../../components/Modal";
import { Select } from "../../../components/Select";
import type { SelectOption } from "../../../components/Select";
import type { Role, User } from "../../../domain";
import { RoleValues } from "../../../domain";
import { describeApiError } from "../../../lib/errors";
import { useUsersStore } from "../../../stores/usersStore";
import styles from "./EditUserModal.module.css";

export interface EditUserModalProps {
  /** Whether the modal is open. Controlled. */
  open: boolean;
  /** The user being edited. */
  user: User;
  /** Called when the modal is dismissed (success, cancel, backdrop). */
  onClose: () => void;
}

const roleOptions: SelectOption[] = [
  { value: String(RoleValues.Owner), label: "Владелец" },
  { value: String(RoleValues.Administrator), label: "Администратор" },
  { value: String(RoleValues.Moderator), label: "Модератор" },
  { value: String(RoleValues.Member), label: "Участник" },
  { value: String(RoleValues.Guest), label: "Гость" },
];

export function EditUserModal({
  open,
  user,
  onClose,
}: EditUserModalProps): React.JSX.Element {
  const [fullName, setFullName] = useState(user.full_name);
  const [role, setRole] = useState<Role>(user.role);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const dirty =
    fullName.trim() !== "" &&
    (fullName.trim() !== user.full_name || role !== user.role);

  const handleSave = useCallback(async () => {
    if (isSaving || !dirty) {
      return;
    }
    const trimmedName = fullName.trim();
    // Snapshot the directory entry so we can restore it on failure.
    const snapshot = useUsersStore.getState().users[user.user_id];
    if (snapshot === undefined) {
      // The user vanished from the directory between mount and save —
      // surface as an error rather than firing a doomed request.
      setError("Пользователь больше не доступен.");
      return;
    }
    const params: { fullName?: string; role?: number } = {};
    if (trimmedName !== user.full_name) {
      params.fullName = trimmedName;
    }
    if (role !== user.role) {
      params.role = role;
    }
    setIsSaving(true);
    setError(null);
    // Optimistic write into the directory.
    useUsersStore.setState((state) => ({
      users: {
        ...state.users,
        [user.user_id]: { ...snapshot, full_name: trimmedName, role },
      },
    }));
    try {
      await apiClient.updateUser(user.user_id, params);
      setIsSaving(false);
      onClose();
    } catch (cause) {
      // Revert the optimistic write.
      useUsersStore.setState((state) => ({
        users: { ...state.users, [user.user_id]: snapshot },
      }));
      setError(describeApiError(cause, "Не удалось сохранить изменения."));
      setIsSaving(false);
    }
  }, [dirty, fullName, isSaving, onClose, role, user.full_name, user.role, user.user_id]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Изменить пользователя"
      size="sm"
      dismissable={!isSaving}
      footer={
        <>
          <Button
            variant="secondary"
            size="md"
            onClick={onClose}
            disabled={isSaving}
          >
            Отмена
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={() => {
              void handleSave();
            }}
            loading={isSaving}
            disabled={!dirty}
          >
            Сохранить
          </Button>
        </>
      }
    >
      <div className={styles.form}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="edit-user-name">
            Имя
          </label>
          <Input
            id="edit-user-name"
            value={fullName}
            onChange={(event) => setFullName(event.currentTarget.value)}
            disabled={isSaving}
            maxLength={60}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="edit-user-role">
            Роль
          </label>
          <Select
            id="edit-user-role"
            value={String(role)}
            onChange={(event) =>
              setRole(Number(event.currentTarget.value) as Role)
            }
            disabled={isSaving}
            options={roleOptions}
          />
        </div>
        {error !== null && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
