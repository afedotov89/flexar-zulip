// Flexar Hub Web — admin invitations management page (Phase 5.4).
//
// Lists every pending or active invitation in the realm and exposes
// the four mutations: send per-email invites, mint a reusable link,
// resend (per-email only), and revoke. There is no realtime event for
// invitations, so the page fetches `apiClient.getInvites` on mount
// and refetches after each successful mutation.
//
// Tab filter: Все / По email / Ссылки. Per-row actions branch on
// `invite.is_multiuse`: per-email rows offer Resend + Revoke; reusable
// links offer Copy link + Revoke. Revoke is wrapped in a confirm
// modal that runs the parent-supplied async, so optimistic removal +
// restore-on-failure stays in this file.

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Invite } from "../../../api";
import { apiClient } from "../../../api";
import { Badge } from "../../../components/Badge";
import { Banner } from "../../../components/Banner";
import { Button } from "../../../components/Button";
import { IconButton } from "../../../components/IconButton";
import { Spinner } from "../../../components/Spinner";
import { Tabs } from "../../../components/Tabs";
import type { TabItem } from "../../../components/Tabs";
import type { Role } from "../../../domain";
import { describeApiError } from "../../../lib/errors";
import { useUsersStore } from "../../../stores/usersStore";
import { CreateReusableInviteLinkModal } from "./CreateReusableInviteLinkModal";
import { RevokeInviteConfirmModal } from "./RevokeInviteConfirmModal";
import { SendInviteModal } from "./SendInviteModal";
import {
  badgeVariantForRole,
  formatExpiry,
  roleLabels,
} from "./inviteFormOptions";
import styles from "./AdminInvites.module.css";

type FilterTab = "all" | "email" | "link";

const tabs: TabItem[] = [
  { id: "all", label: "Все" },
  { id: "email", label: "По email" },
  { id: "link", label: "Ссылки" },
];

export function AdminInvites(): React.JSX.Element {
  const usersMap = useUsersStore((s) => s.users);

  const [invites, setInvites] = useState<Invite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [resendingId, setResendingId] = useState<number | null>(null);
  const [resendBanner, setResendBanner] = useState<string | null>(null);
  const [copiedLinkId, setCopiedLinkId] = useState<number | null>(null);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<Invite | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const list = await apiClient.getInvites();
      setInvites(list);
    } catch (cause) {
      setLoadError(describeApiError(cause, "Не удалось загрузить приглашения."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const visible = useMemo(() => {
    const filtered = invites.filter((invite) => {
      if (activeTab === "email") {
        return !invite.is_multiuse;
      }
      if (activeTab === "link") {
        return invite.is_multiuse;
      }
      return true;
    });
    // Newest first; the backend already orders by id but we sort
    // explicitly to keep the UI stable across optimistic edits.
    return [...filtered].sort((a, b) => b.invited - a.invited);
  }, [activeTab, invites]);

  const handleResend = useCallback(
    async (invite: Invite) => {
      setResendingId(invite.id);
      setResendBanner(null);
      try {
        await apiClient.resendInvite(invite.id);
      } catch (cause) {
        setResendBanner(
          describeApiError(cause, "Не удалось повторно отправить приглашение."),
        );
      } finally {
        setResendingId(null);
      }
    },
    [],
  );

  const handleCopyLink = useCallback(async (invite: Invite) => {
    if (invite.link_url === undefined) {
      return;
    }
    try {
      await navigator.clipboard.writeText(invite.link_url);
      setCopiedLinkId(invite.id);
    } catch {
      // Surface a visible failure rather than silently doing nothing.
      setResendBanner("Не удалось скопировать ссылку. Скопируйте вручную.");
    }
  }, []);

  // Wrapped for the revoke modal: optimistic removal here, restore on
  // throw so the modal's catch block can render the API message.
  const performRevoke = useCallback(
    async (invite: Invite) => {
      const snapshot = invites;
      setInvites((current) => current.filter((item) => item.id !== invite.id));
      try {
        await apiClient.revokeInvite(invite.id);
      } catch (cause) {
        setInvites(snapshot);
        throw cause;
      }
    },
    [invites],
  );

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.heading}>Приглашения</h1>
        <div className={styles.headerActions}>
          <Button
            variant="secondary"
            size="md"
            onClick={() => setShowLinkModal(true)}
          >
            Создать ссылку
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={() => setShowSendModal(true)}
          >
            Отправить приглашение
          </Button>
        </div>
      </header>

      {loadError !== null && <Banner tone="danger">{loadError}</Banner>}
      {resendBanner !== null && (
        <Banner tone="danger" onDismiss={() => setResendBanner(null)}>
          {resendBanner}
        </Banner>
      )}

      <Tabs
        tabs={tabs}
        activeId={activeTab}
        onChange={(id) => setActiveTab(id as FilterTab)}
        aria-label="Фильтр по типу приглашения"
      >
        {() =>
          isLoading ? (
            <div className={styles.loading}>
              <Spinner aria-label="Загрузка приглашений" />
            </div>
          ) : visible.length === 0 ? (
            <p className={styles.empty}>Активных приглашений нет.</p>
          ) : (
            <ul className={styles.list} aria-label="Приглашения">
              {visible.map((invite) => {
                const inviter =
                  invite.invited_by_user_id !== undefined
                    ? (usersMap[invite.invited_by_user_id]?.full_name ??
                      "Неизвестно")
                    : "Неизвестно";
                const target = invite.is_multiuse
                  ? "Многоразовая ссылка"
                  : (invite.email ?? "—");
                const role = invite.invited_as as Role;
                const roleLabel = roleLabels[role] ?? "—";
                return (
                  <li key={invite.id} className={styles.row}>
                    <div className={styles.info}>
                      <span className={styles.target}>{target}</span>
                      <span className={styles.meta}>
                        {formatExpiry(invite.expiry_date)} · от {inviter}
                      </span>
                    </div>
                    <span className={styles.badgeSlot}>
                      <Badge variant="neutral">
                        {invite.is_multiuse ? "Ссылка" : "Email"}
                      </Badge>
                      <Badge variant={badgeVariantForRole(role)}>
                        {roleLabel}
                      </Badge>
                    </span>
                    <div className={styles.actions}>
                      {invite.is_multiuse ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            void handleCopyLink(invite);
                          }}
                          disabled={invite.link_url === undefined}
                        >
                          {copiedLinkId === invite.id
                            ? "Скопировано"
                            : "Скопировать ссылку"}
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            void handleResend(invite);
                          }}
                          loading={resendingId === invite.id}
                        >
                          Отправить снова
                        </Button>
                      )}
                      <IconButton
                        icon="trash"
                        aria-label="Отозвать приглашение"
                        variant="ghost"
                        size="sm"
                        onClick={() => setRevokeTarget(invite)}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )
        }
      </Tabs>

      {showSendModal && (
        <SendInviteModal
          open={true}
          onClose={() => setShowSendModal(false)}
          onSent={() => {
            void refetch();
          }}
        />
      )}
      {showLinkModal && (
        <CreateReusableInviteLinkModal
          open={true}
          onClose={() => {
            setShowLinkModal(false);
            void refetch();
          }}
          onCreated={() => {
            // Refetch happens on close so the new row is visible once
            // the user actually returns to the list.
          }}
        />
      )}
      {revokeTarget !== null && (
        <RevokeInviteConfirmModal
          open={true}
          invite={revokeTarget}
          onClose={() => setRevokeTarget(null)}
          onConfirm={() => performRevoke(revokeTarget)}
        />
      )}
    </div>
  );
}
