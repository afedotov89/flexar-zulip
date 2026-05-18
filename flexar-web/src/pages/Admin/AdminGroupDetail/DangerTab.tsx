// Danger zone tab for the admin user-group detail page (Phase C5).
//
// Surfaces the deactivate-group action. Two upstream states short-
// circuit the body to a single info banner:
//   - System group → deactivation is server-side forbidden.
//   - Already deactivated → reactivation lives in the Overview banner.
//
// For a normal active group, the tab scans the live channels +
// user-groups directories for references to this group (via
// `findGroupUsages`). Any reference is a hard blocker: the server
// refuses to deactivate a group still wired into permissions, so we
// pre-empt the failure with a "cannot deactivate" banner that lists
// the blockers one-by-one and disables the destructive button.
//
// When there are no blockers, "Деактивировать" opens
// `DeactivateGroupConfirmModal`; confirmation calls
// `apiClient.deactivateUserGroup(group.id)`. Success is implicit — the
// realtime `user_group:update` echo folds `deactivated: true` into the
// store; the Overview banner appears and the page becomes read-only.
// On failure, the modal stays open with an inline error banner and
// the action re-enables.

import { useMemo, useState } from "react";
import { Banner } from "../../../components/Banner";
import { Button } from "../../../components/Button";
import { Icon } from "../../../components/Icon";
import type { UserGroup } from "../../../domain";
import {
  findGroupUsages,
  type GroupUsage,
} from "../../../lib/userGroups";
import { useStreamsStore } from "../../../stores/streamsStore";
import { useUserGroupsStore } from "../../../stores/userGroupsStore";
import { DeactivateGroupConfirmModal } from "./DeactivateGroupConfirmModal";
import styles from "./DangerTab.module.css";

export interface DangerTabProps {
  group: UserGroup;
  caps: import("../../../lib/hooks/useGroupCapabilities").GroupCapabilities;
}

export function DangerTab({
  group,
  caps,
}: DangerTabProps): React.JSX.Element {
  const streams = useStreamsStore((s) => s.streams);
  const groups = useUserGroupsStore((s) => s.userGroups);

  const usages = useMemo<GroupUsage[]>(
    () =>
      findGroupUsages(group.id, {
        channels: Object.values(streams),
        groups: Object.values(groups),
      }),
    [group.id, streams, groups],
  );

  return (
    <div className={styles.tabPanel}>
      <h2 className={styles.sectionHeading}>Опасная зона</h2>
      <DangerBody group={group} usages={usages} caps={caps} />
    </div>
  );
}

interface DangerBodyProps {
  group: UserGroup;
  usages: GroupUsage[];
  caps: import("../../../lib/hooks/useGroupCapabilities").GroupCapabilities;
}

function DangerBody({
  group,
  usages,
  caps,
}: DangerBodyProps): React.JSX.Element {
  if (group.is_system_group) {
    return (
      <Banner tone="info">
        Системная группа — деактивация недоступна.
      </Banner>
    );
  }
  if (group.deactivated) {
    return (
      <Banner tone="info">
        Группа уже деактивирована. Реактивируйте на вкладке «Обзор».
      </Banner>
    );
  }
  if (!caps.canManage) {
    // The route gate + group-detail page gate let the user see this
    // page, but deactivation needs full `can_manage_group` — fail
    // closed here so a member without manage rights doesn't see
    // a button that would 403.
    return (
      <Banner tone="info">
        Деактивация доступна только пользователям с правом
        «Управление группой».
      </Banner>
    );
  }
  return <DeactivateSection group={group} usages={usages} />;
}

interface DeactivateSectionProps {
  group: UserGroup;
  usages: GroupUsage[];
}

function DeactivateSection({
  group,
  usages,
}: DeactivateSectionProps): React.JSX.Element {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const blocked = usages.length > 0;

  return (
    <section className={styles.section}>
      <h3 className={styles.subheading}>Деактивировать группу</h3>
      <p className={styles.hint}>
        После деактивации группа исчезнет из списков, но её история
        сохраняется. Реактивировать можно на вкладке «Обзор».
      </p>

      {blocked && <CannotDeactivateBanner usages={usages} />}

      <div className={styles.actions}>
        <Button
          type="button"
          variant="danger"
          size="md"
          disabled={blocked}
          onClick={() => setConfirmOpen(true)}
        >
          Деактивировать
        </Button>
      </div>

      {confirmOpen && (
        <DeactivateGroupConfirmModal
          open={confirmOpen}
          groupId={group.id}
          groupName={group.name}
          onClose={() => setConfirmOpen(false)}
        />
      )}
    </section>
  );
}

interface CannotDeactivateBannerProps {
  usages: GroupUsage[];
}

function CannotDeactivateBanner({
  usages,
}: CannotDeactivateBannerProps): React.JSX.Element {
  return (
    <Banner tone="warning" title="Деактивация недоступна">
      <p className={styles.bannerLead}>
        Группа используется в следующих местах:
      </p>
      <ul className={styles.usageList} aria-label="Где используется группа">
        {usages.map((usage, index) => (
          <li
            key={`${usage.kind}-${usage.id}-${usage.setting}-${index}`}
            className={styles.usageRow}
          >
            <Icon
              name={usage.kind === "channel" ? "hash" : "users"}
              size="sm"
            />
            <span className={styles.usageName}>{usage.name}</span>
            <span className={styles.usageSetting}>— {usage.setting}</span>
          </li>
        ))}
      </ul>
      <p className={styles.bannerHint}>
        Сначала уберите эту группу из настроек выше.
      </p>
    </Banner>
  );
}
