// Flexar Hub Web — admin revoke-invite confirmation modal (Phase 5.4).
//
// Confirmation step in front of `apiClient.revokeInvite`. The parent
// owns the `invites` array, so the optimistic removal + restore-on-
// failure logic lives there; this modal just gathers the user's
// confirmation, runs the supplied async `onConfirm`, and surfaces
// any thrown error inline so the user can retry or cancel.

import { useCallback, useState } from "react";
import type { Invite } from "../../../api";
import { Banner } from "../../../components/Banner";
import { Button } from "../../../components/Button";
import { Modal } from "../../../components/Modal";
import { describeApiError } from "../../../lib/errors";

export interface RevokeInviteConfirmModalProps {
  open: boolean;
  /** The invitation being revoked. */
  invite: Invite;
  /** Called on cancel and on successful confirm. */
  onClose: () => void;
  /**
   * Run by the modal when the user confirms. The parent is expected to
   * call `apiClient.revokeInvite`, do its optimistic update, and rethrow
   * any caught error so the modal can render it.
   */
  onConfirm: () => Promise<void>;
}

export function RevokeInviteConfirmModal({
  open,
  invite,
  onClose,
  onConfirm,
}: RevokeInviteConfirmModalProps): React.JSX.Element {
  const [error, setError] = useState<string | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  const handleConfirm = useCallback(async () => {
    if (isRevoking) {
      return;
    }
    setIsRevoking(true);
    setError(null);
    try {
      await onConfirm();
      setIsRevoking(false);
      onClose();
    } catch (cause) {
      setError(describeApiError(cause, "Не удалось отозвать приглашение."));
      setIsRevoking(false);
    }
  }, [isRevoking, onClose, onConfirm]);

  const target = invite.is_multiuse
    ? "многоразовую ссылку"
    : `приглашение для ${invite.email ?? "—"}`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Отозвать приглашение?"
      size="sm"
      dismissable={!isRevoking}
      footer={
        <>
          <Button
            variant="secondary"
            size="md"
            onClick={onClose}
            disabled={isRevoking}
          >
            Отмена
          </Button>
          <Button
            variant="danger"
            size="md"
            onClick={() => {
              void handleConfirm();
            }}
            loading={isRevoking}
          >
            Отозвать
          </Button>
        </>
      }
    >
      <p>Отозвать {target}?</p>
      {error !== null && <Banner tone="danger">{error}</Banner>}
    </Modal>
  );
}
