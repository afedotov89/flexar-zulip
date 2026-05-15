// Flexar Hub Web — admin reusable-invite-link modal (Phase 5.4).
//
// Mints a multi-use invite URL via `apiClient.createReusableInviteLink`.
// On success the modal stays open and switches to a "copy this link"
// view, because once the user closes the modal they would have to dig
// the link out of the list to share it. Closing from the success view
// triggers the parent's refetch so the new row shows up.

import { useCallback, useState } from "react";
import { apiClient } from "../../../api";
import { Banner } from "../../../components/Banner";
import { Button } from "../../../components/Button";
import { Input } from "../../../components/Input";
import { Modal } from "../../../components/Modal";
import { Select } from "../../../components/Select";
import type { Role, StreamId } from "../../../domain";
import { RoleValues } from "../../../domain";
import { describeApiError } from "../../../lib/errors";
import { ChannelPicker } from "./ChannelPicker";
import {
  expirationOptions,
  parseExpiration,
  roleOptions,
} from "./inviteFormOptions";
import styles from "./CreateReusableInviteLinkModal.module.css";

export interface CreateReusableInviteLinkModalProps {
  open: boolean;
  /** Called on cancel and on successful close (after user copies). */
  onClose: () => void;
  /** Called after a link was successfully created. */
  onCreated: () => void;
}

const DEFAULT_EXPIRATION = "10080"; // 7 дней

export function CreateReusableInviteLinkModal({
  open,
  onClose,
  onCreated,
}: CreateReusableInviteLinkModalProps): React.JSX.Element {
  const [role, setRole] = useState<Role>(RoleValues.Member);
  const [expiration, setExpiration] = useState<string>(DEFAULT_EXPIRATION);
  const [streamIds, setStreamIds] = useState<ReadonlySet<StreamId>>(
    () => new Set<StreamId>(),
  );
  const [createdLink, setCreatedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const toggleStream = useCallback((streamId: StreamId) => {
    setStreamIds((current) => {
      const next = new Set(current);
      if (next.has(streamId)) {
        next.delete(streamId);
      } else {
        next.add(streamId);
      }
      return next;
    });
  }, []);

  const handleCreate = useCallback(async () => {
    if (isCreating) {
      return;
    }
    setIsCreating(true);
    setError(null);
    try {
      const link = await apiClient.createReusableInviteLink({
        inviteExpiresInMinutes: parseExpiration(expiration),
        inviteAs: role,
        streamIds: streamIds.size > 0 ? [...streamIds] : undefined,
      });
      setCreatedLink(link);
      setIsCreating(false);
      onCreated();
    } catch (cause) {
      setError(describeApiError(cause, "Не удалось создать ссылку."));
      setIsCreating(false);
    }
  }, [expiration, isCreating, onCreated, role, streamIds]);

  const handleCopy = useCallback(async () => {
    if (createdLink === null) {
      return;
    }
    try {
      await navigator.clipboard.writeText(createdLink);
      setCopied(true);
    } catch {
      // Clipboard can fail in insecure contexts; surface a hint but
      // don't treat it as an API error.
      setError("Не удалось скопировать ссылку. Скопируйте вручную.");
    }
  }, [createdLink]);

  const formMode = createdLink === null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={formMode ? "Создать ссылку" : "Ссылка готова"}
      size="md"
      dismissable={!isCreating}
      footer={
        formMode ? (
          <>
            <Button
              variant="secondary"
              size="md"
              onClick={onClose}
              disabled={isCreating}
            >
              Отмена
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => {
                void handleCreate();
              }}
              loading={isCreating}
            >
              Создать
            </Button>
          </>
        ) : (
          <Button variant="primary" size="md" onClick={onClose}>
            Закрыть
          </Button>
        )
      }
    >
      {formMode ? (
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            void handleCreate();
          }}
        >
          <div className={styles.field}>
            <label className={styles.label} htmlFor="create-link-role">
              Роль
            </label>
            <Select
              id="create-link-role"
              value={String(role)}
              onChange={(event) =>
                setRole(Number(event.currentTarget.value) as Role)
              }
              disabled={isCreating}
              options={roleOptions}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="create-link-expiration">
              Срок действия
            </label>
            <Select
              id="create-link-expiration"
              value={expiration}
              onChange={(event) => setExpiration(event.currentTarget.value)}
              disabled={isCreating}
              options={expirationOptions}
            />
          </div>

          <div className={styles.field}>
            <span className={styles.label}>Каналы (необязательно)</span>
            <ChannelPicker
              selected={streamIds}
              onToggle={toggleStream}
              disabled={isCreating}
            />
          </div>

          {error !== null && <Banner tone="danger">{error}</Banner>}
        </form>
      ) : (
        <div className={styles.successBody}>
          <p className={styles.helperText}>
            Поделитесь этой ссылкой с теми, кого хотите пригласить.
          </p>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="created-invite-link">
              Ссылка для приглашения
            </label>
            <div className={styles.linkRow}>
              <Input
                id="created-invite-link"
                value={createdLink ?? ""}
                readOnly
                onFocus={(event) => event.currentTarget.select()}
                className={styles.linkInput}
              />
              <Button
                variant="secondary"
                size="md"
                onClick={() => {
                  void handleCopy();
                }}
              >
                {copied ? "Скопировано" : "Скопировать"}
              </Button>
            </div>
          </div>
          {error !== null && <Banner tone="danger">{error}</Banner>}
        </div>
      )}
    </Modal>
  );
}
