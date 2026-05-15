// Flexar Hub Web — admin send-invite modal (Phase 5.4).
//
// Form for emailing one or more invitations. Email addresses come in
// as free-form text (comma- or newline-separated), get parsed into a
// list, and the Submit button stays disabled until every parsed token
// looks like an email. Role + expiration use the shared Select option
// lists from `inviteFormOptions`; channel auto-subscribe goes through
// the in-directory `ChannelPicker` (a vertical Checkbox list, no
// typeahead — small organisations only).
//
// On success the parent refetches `apiClient.getInvites()` to pick up
// the new rows; there is no realtime event for invites.

import { useCallback, useMemo, useState } from "react";
import { apiClient } from "../../../api";
import { Banner } from "../../../components/Banner";
import { Button } from "../../../components/Button";
import { Modal } from "../../../components/Modal";
import { Select } from "../../../components/Select";
import { Textarea } from "../../../components/Textarea";
import type { Role, StreamId } from "../../../domain";
import { RoleValues } from "../../../domain";
import { describeApiError } from "../../../lib/errors";
import { ChannelPicker } from "./ChannelPicker";
import {
  allValidEmails,
  expirationOptions,
  parseEmails,
  parseExpiration,
  roleOptions,
} from "./inviteFormOptions";
import styles from "./SendInviteModal.module.css";

export interface SendInviteModalProps {
  open: boolean;
  /** Called on cancel and on backdrop dismiss. */
  onClose: () => void;
  /** Called after a successful send so the parent can refetch. */
  onSent: () => void;
}

const DEFAULT_EXPIRATION = "10080"; // 7 дней

export function SendInviteModal({
  open,
  onClose,
  onSent,
}: SendInviteModalProps): React.JSX.Element {
  const [emails, setEmails] = useState("");
  const [role, setRole] = useState<Role>(RoleValues.Member);
  const [expiration, setExpiration] = useState<string>(DEFAULT_EXPIRATION);
  const [streamIds, setStreamIds] = useState<ReadonlySet<StreamId>>(
    () => new Set<StreamId>(),
  );
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const parsedEmails = useMemo(() => parseEmails(emails), [emails]);
  const canSubmit = !isSending && allValidEmails(parsedEmails);

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

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) {
      return;
    }
    setIsSending(true);
    setError(null);
    try {
      await apiClient.sendInvites({
        inviteeEmails: parsedEmails,
        inviteExpiresInMinutes: parseExpiration(expiration),
        inviteAs: role,
        streamIds: streamIds.size > 0 ? [...streamIds] : undefined,
      });
      setIsSending(false);
      onSent();
      onClose();
    } catch (cause) {
      setError(describeApiError(cause, "Не удалось отправить приглашения."));
      setIsSending(false);
    }
  }, [canSubmit, expiration, onClose, onSent, parsedEmails, role, streamIds]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Отправить приглашение"
      size="md"
      dismissable={!isSending}
      footer={
        <>
          <Button
            variant="secondary"
            size="md"
            onClick={onClose}
            disabled={isSending}
          >
            Отмена
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={() => {
              void handleSubmit();
            }}
            loading={isSending}
            disabled={!canSubmit}
          >
            Отправить
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
          <label className={styles.label} htmlFor="send-invite-emails">
            Email-адреса (по одному на строке или через запятую)
          </label>
          <Textarea
            id="send-invite-emails"
            value={emails}
            onChange={(event) => setEmails(event.currentTarget.value)}
            disabled={isSending}
            rows={4}
            placeholder="alice@example.com, bob@example.com"
            autoFocus
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="send-invite-role">
            Роль
          </label>
          <Select
            id="send-invite-role"
            value={String(role)}
            onChange={(event) =>
              setRole(Number(event.currentTarget.value) as Role)
            }
            disabled={isSending}
            options={roleOptions}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="send-invite-expiration">
            Срок действия
          </label>
          <Select
            id="send-invite-expiration"
            value={expiration}
            onChange={(event) => setExpiration(event.currentTarget.value)}
            disabled={isSending}
            options={expirationOptions}
          />
        </div>

        <div className={styles.field}>
          <span className={styles.label}>Каналы (необязательно)</span>
          <ChannelPicker
            selected={streamIds}
            onToggle={toggleStream}
            disabled={isSending}
          />
        </div>

        {error !== null && <Banner tone="danger">{error}</Banner>}
      </form>
    </Modal>
  );
}
