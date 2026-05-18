// Create user-group modal (Phase B3).
//
// Mirrors `pages/Channels/CreateChannelModal.tsx` in structure: small
// form (name + description + initial members) on top of
// `apiClient.createUserGroup`. The realtime `user_group:add` event
// folds the new group into `useUserGroupsStore`, so on success the
// modal just closes and the row appears in the list a tick later — no
// optimistic push, no refetch.
//
// Members are an optional initial set picked via the inline
// `AddMemberInput` typeahead (active non-bot users, suppressing those
// already chosen). The user can submit with zero members — an admin-
// only group is legitimate. System groups are deliberately not
// surfaced here: a brand-new group's roster is per-user only.

import { useCallback, useMemo, useState } from "react";
import { apiClient } from "../../../api";
import { Avatar } from "../../../components/Avatar";
import { Button } from "../../../components/Button";
import { IconButton } from "../../../components/IconButton";
import { Input } from "../../../components/Input";
import { Modal } from "../../../components/Modal";
import { Textarea } from "../../../components/Textarea";
import type { UserId } from "../../../domain";
import { describeApiError } from "../../../lib/errors";
import { useUsersStore } from "../../../stores/usersStore";
import { AddMemberInput } from "./AddMemberInput";
import styles from "./CreateGroupModal.module.css";

export interface CreateGroupModalProps {
  open: boolean;
  onClose: () => void;
}

// Zulip's documented limits for user-group name/description. The
// server enforces these too, but capping `maxLength` client-side keeps
// the failure modes inside the field rather than as a banner.
const NAME_MAX = 100;
const DESCRIPTION_MAX = 1024;

export function CreateGroupModal({
  open,
  onClose,
}: CreateGroupModalProps): React.JSX.Element {
  const usersMap = useUsersStore((s) => s.users);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [memberIds, setMemberIds] = useState<UserId[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setName("");
    setDescription("");
    setMemberIds([]);
    setSubmitError(null);
  }, []);

  const handleClose = useCallback(() => {
    if (submitting) {
      return;
    }
    reset();
    onClose();
  }, [submitting, onClose, reset]);

  const trimmedName = name.trim();
  const canSubmit = trimmedName !== "" && !submitting;

  const handleAddMember = useCallback((userId: UserId) => {
    setMemberIds((prev) =>
      prev.includes(userId) ? prev : [...prev, userId],
    );
  }, []);

  const handleRemoveMember = useCallback((userId: UserId) => {
    setMemberIds((prev) => prev.filter((id) => id !== userId));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) {
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await apiClient.createUserGroup({
        name: trimmedName,
        description: description.trim(),
        members: memberIds,
      });
      // Success: realtime `user_group:add` will fold into the store.
      reset();
      setSubmitting(false);
      onClose();
    } catch (cause) {
      setSubmitError(describeApiError(cause, "Не удалось создать группу."));
      setSubmitting(false);
    }
  }, [canSubmit, description, memberIds, onClose, reset, trimmedName]);

  // Resolve selected ids → user records once per render so the chip
  // list can show avatars + names without each chip re-walking the
  // map. Unknown ids (race with `realm_user/remove`) fall back to a
  // placeholder label rather than disappearing silently.
  const selectedRows = useMemo(
    () =>
      memberIds.map((id) => ({
        userId: id,
        user: usersMap[id],
      })),
    [memberIds, usersMap],
  );

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Создать группу"
      size="md"
      dismissable={!submitting}
      footer={
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
            onClick={() => {
              void handleSubmit();
            }}
            loading={submitting}
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
          <label className={styles.label} htmlFor="create-group-name">
            Название
          </label>
          <Input
            id="create-group-name"
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
            maxLength={NAME_MAX}
            placeholder="например, продуктовая команда"
            disabled={submitting}
            autoFocus
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="create-group-description">
            Описание
          </label>
          <Textarea
            id="create-group-description"
            value={description}
            onChange={(event) => setDescription(event.currentTarget.value)}
            maxLength={DESCRIPTION_MAX}
            placeholder="Кратко о назначении группы (необязательно)."
            disabled={submitting}
            rows={3}
          />
        </div>

        <div className={styles.field}>
          <span className={styles.label}>Участники</span>
          <AddMemberInput
            existingIds={memberIds}
            onSelect={handleAddMember}
          />
          {selectedRows.length > 0 && (
            <ul className={styles.chipList} aria-label="Выбранные участники">
              {selectedRows.map(({ userId, user }) => {
                const displayName = user?.full_name ?? `Пользователь #${userId}`;
                return (
                  <li key={userId} className={styles.chip}>
                    <Avatar
                      src={user?.avatar_url ?? undefined}
                      name={displayName}
                      size="sm"
                    />
                    <span className={styles.chipName}>{displayName}</span>
                    <IconButton
                      icon="close"
                      aria-label={`Убрать ${displayName} из группы`}
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveMember(userId)}
                      disabled={submitting}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {submitError !== null && (
          <p className={styles.error} role="alert">
            {submitError}
          </p>
        )}
      </form>
    </Modal>
  );
}
