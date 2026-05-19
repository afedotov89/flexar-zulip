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

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiClient } from "../../api";
import type { ChannelTopicsPolicyParam, UserGroup } from "../../api";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { Modal } from "../../components/Modal";
import { Radio } from "../../components/Radio";
import { Select } from "../../components/Select";
import { Textarea } from "../../components/Textarea";
import { describeApiError } from "../../lib/errors";
import styles from "./CreateChannelModal.module.css";

export interface CreateChannelModalProps {
  open: boolean;
  onClose: () => void;
}

type Privacy = "public" | "private";

const TOPICS_POLICY_OPTIONS: ReadonlyArray<{
  value: ChannelTopicsPolicyParam;
  label: string;
}> = [
  { value: "inherit", label: "Наследовать настройку организации" },
  { value: "disable_empty_topic", label: "Темы обязательны" },
  { value: "allow_empty_topic", label: "Темы необязательны" },
  { value: "empty_topic_only", label: "Без тем (общий чат)" },
];

// Posting-policy choices, mirroring the four system-group buckets the
// channel admin page exposes. Each value is the Zulip system-group
// `name` — resolved to its numeric ID at submit time via the user-
// groups list. Order goes most- to least-permissive. `role:nobody` is
// intentionally excluded — it would lock even admins out of the new
// channel.
const POSTING_GROUPS: ReadonlyArray<{ name: string; label: string }> = [
  { name: "role:everyone", label: "Все участники" },
  { name: "role:fullmembers", label: "Полные участники" },
  { name: "role:moderators", label: "Модераторы" },
  { name: "role:administrators", label: "Администраторы" },
];

const NAME_MAX = 60;
const DESCRIPTION_MAX = 1024;

export function CreateChannelModal({
  open,
  onClose,
}: CreateChannelModalProps): React.JSX.Element {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [privacy, setPrivacy] = useState<Privacy>("public");
  const [topicsPolicy, setTopicsPolicy] =
    useState<ChannelTopicsPolicyParam>("inherit");
  const [postingGroup, setPostingGroup] = useState<string>("role:everyone");
  const [userGroups, setUserGroups] = useState<UserGroup[] | undefined>(
    undefined,
  );
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Fetch the realm's user-groups once the modal opens so we can
  // resolve a posting-policy selection to its numeric ID at submit
  // time. The list is small and rarely changes; one fetch per open is
  // acceptable (no caching layer needed here).
  useEffect(() => {
    if (!open || userGroups !== undefined) {
      return;
    }
    let cancelled = false;
    apiClient
      .getUserGroups()
      .then((list) => {
        if (!cancelled) {
          setUserGroups(list);
        }
      })
      .catch(() => {
        // Non-fatal: the Select stays disabled and the channel is
        // created with the server's default posting policy.
      });
    return () => {
      cancelled = true;
    };
  }, [open, userGroups]);

  const sysGroupIdByName = useMemo(() => {
    const map = new Map<string, number>();
    for (const g of userGroups ?? []) {
      if (g.is_system_group) {
        map.set(g.name, g.id);
      }
    }
    return map;
  }, [userGroups]);

  const postingOptions = useMemo(
    () =>
      POSTING_GROUPS.map(({ name: groupName, label }) => ({
        value: groupName,
        label,
        disabled: !sysGroupIdByName.has(groupName),
      })),
    [sysGroupIdByName],
  );

  const reset = useCallback(() => {
    setName("");
    setDescription("");
    setPrivacy("public");
    setTopicsPolicy("inherit");
    setPostingGroup("role:everyone");
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
      // Resolve the chosen system-group name to its numeric ID. If the
      // groups list hasn't loaded yet (or the chosen group isn't a
      // system group on this server), omit the field — the channel is
      // then created with the server's default posting policy.
      const resolvedPostingGroup = sysGroupIdByName.get(postingGroup);
      await apiClient.createChannel({
        name: trimmedName,
        description: description.trim() === "" ? undefined : description.trim(),
        privacy,
        // Omit when "inherit" so the server applies its default rather
        // than receiving an explicit override that means "do nothing".
        topicsPolicy: topicsPolicy === "inherit" ? undefined : topicsPolicy,
        canSendMessageGroup: resolvedPostingGroup,
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
  }, [
    canSubmit,
    description,
    onClose,
    postingGroup,
    privacy,
    reset,
    sysGroupIdByName,
    topicsPolicy,
    trimmedName,
  ]);

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

        <div
          className={styles.radioGroup}
          role="radiogroup"
          aria-labelledby="create-channel-privacy-label"
        >
          <span className={styles.label} id="create-channel-privacy-label">
            Доступ
          </span>
          <div className={styles.radioStack}>
            <Radio
              label="Публичный — виден всем участникам организации"
              name="create-channel-privacy"
              value="public"
              checked={privacy === "public"}
              onChange={() => setPrivacy("public")}
              disabled={isCreating}
            />
            <Radio
              label="Приватный — только по приглашению"
              name="create-channel-privacy"
              value="private"
              checked={privacy === "private"}
              onChange={() => setPrivacy("private")}
              disabled={isCreating}
            />
          </div>
        </div>

        <div
          className={styles.radioGroup}
          role="radiogroup"
          aria-labelledby="create-channel-topics-policy-label"
        >
          <span className={styles.label} id="create-channel-topics-policy-label">
            Темы
          </span>
          <div className={styles.radioStack}>
            {TOPICS_POLICY_OPTIONS.map((option) => (
              <Radio
                key={option.value}
                label={option.label}
                name="create-channel-topics-policy"
                value={option.value}
                checked={topicsPolicy === option.value}
                onChange={() => setTopicsPolicy(option.value)}
                disabled={isCreating}
              />
            ))}
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="create-channel-posting-group">
            Кто может писать в канал
          </label>
          <Select
            id="create-channel-posting-group"
            value={postingGroup}
            options={postingOptions}
            disabled={isCreating || userGroups === undefined}
            onChange={(event) => setPostingGroup(event.currentTarget.value)}
          />
          <span className={styles.hint}>
            Чтобы получился «канал-объявления» (как в Telegram), выберите
            «Администраторы» — остальные смогут только читать.
          </span>
        </div>

        {error !== null && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
