// Flexar Hub Web — admin user-group detail page (Phases C1-C5 —
// tabbed shell + Overview / Members / Subgroups / Permissions / Danger
// zone tabs).
//
// Five-tab shell — Обзор / Участники / Подгруппы / Права / Опасная
// зона — controlled locally. Overview is wired here: rename +
// description with an explicit Save (mirrors AdminOrganization's text-
// field rule), plus the meta strip (members / subgroups / status)
// inside the tab body. The four other bodies live in `MembersTab` /
// `SubgroupsTab` / `PermissionsTab` / `DangerTab` (C2-C5).
//
// System groups are read-only on every tab: the Overview form fields
// are disabled, Save is hidden, and a top-of-page Banner spells it
// out. Deactivated groups are read-only too — the Overview tab carries
// a "Реактивировать" affordance (calls `updateUserGroup({deactivated:
// false})`), and other tabs' bodies will fall back to a banner in
// later phases. The two banners are mutually exclusive (system groups
// are never deactivated).
//
// Save flow: dirty-check trimmed name / description against the store
// values; the button is disabled while clean, while saving, and when
// the trimmed name would be empty. On submit we send only the keys
// that actually differ. Success is implicit — the realtime
// `user_group:update` event folds back through the store, the
// `useEffect` re-syncs the local form, and the button drops back to
// disabled. Errors surface as a Banner; no autosave.

import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiClient } from "../../../api";
import { Badge } from "../../../components/Badge";
import { Banner } from "../../../components/Banner";
import { Button } from "../../../components/Button";
import { EmptyState } from "../../../components/EmptyState";
import { Input } from "../../../components/Input";
import { Tabs } from "../../../components/Tabs";
import type { TabItem } from "../../../components/Tabs";
import { Textarea } from "../../../components/Textarea";
import type { UserGroup } from "../../../domain";
import { describeApiError } from "../../../lib/errors";
import {
  useGroupCapabilities,
  type GroupCapabilities,
} from "../../../lib/hooks/useGroupCapabilities";
import { useUserGroupsStore } from "../../../stores/userGroupsStore";
import { DangerTab } from "./DangerTab";
import { MembersTab } from "./MembersTab";
import { PermissionsTab } from "./PermissionsTab";
import { SubgroupsTab } from "./SubgroupsTab";
import styles from "./AdminGroupDetail.module.css";

// Mirror CreateGroupModal's limits so the create-and-edit story stays
// symmetric (NAME_MAX=100 / DESCRIPTION_MAX=1024 are Zulip's
// documented user-group bounds; the server enforces them too).
const NAME_MAX = 100;
const DESCRIPTION_MAX = 1024;

type TabId = "overview" | "members" | "subgroups" | "permissions" | "danger";

const tabs: TabItem[] = [
  { id: "overview", label: "Обзор" },
  { id: "members", label: "Участники" },
  { id: "subgroups", label: "Подгруппы" },
  { id: "permissions", label: "Права" },
  { id: "danger", label: "Опасная зона" },
];

export function AdminGroupDetail(): React.JSX.Element {
  const { id: rawId } = useParams<{ id: string }>();
  const groupId = rawId !== undefined ? Number.parseInt(rawId, 10) : NaN;
  const group = useUserGroupsStore((s) =>
    Number.isInteger(groupId) ? s.getUserGroup(groupId) : undefined,
  );
  const caps = useGroupCapabilities(group);

  const [activeTab, setActiveTab] = useState<TabId>("overview");

  if (group === undefined) {
    return (
      <section className={styles.page}>
        <Link to="/admin/groups" className={styles.backLink}>
          ← К списку групп
        </Link>
        <EmptyState
          tone="muted"
          icon="users"
          title="Группа не найдена"
          description="Возможно, она была удалена или ещё не пришла в snapshot."
        />
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <Link to="/admin/groups" className={styles.backLink}>
        ← К списку групп
      </Link>

      <header className={styles.header}>
        <h1 className={styles.heading}>
          {group.name}
          {group.is_system_group && (
            <Badge variant="neutral">Системная</Badge>
          )}
        </h1>
        {group.is_system_group ? (
          <Banner tone="info">
            Системная группа — редактирование недоступно.
          </Banner>
        ) : group.deactivated ? (
          <DeactivatedBanner group={group} caps={caps} />
        ) : !caps.canSeeDetail ? (
          // Capability gate: user has no power on this group and
          // isn't a member. Detail page renders, but everything is
          // read-only and a banner explains why. The route gate
          // (`RequireAdminAccess`) doesn't see this case — it only
          // checks whether the user has ANY admin-adjacent power,
          // not whether they have power on THIS specific group.
          <Banner tone="info">
            У вас нет прав на эту группу — страница доступна только
            для просмотра.
          </Banner>
        ) : null}
      </header>

      <Tabs
        tabs={tabs}
        activeId={activeTab}
        onChange={(id) => setActiveTab(id as TabId)}
        aria-label="Разделы группы"
      >
        {(id) => <TabBody id={id as TabId} group={group} caps={caps} />}
      </Tabs>
    </section>
  );
}

interface TabBodyProps {
  id: TabId;
  group: UserGroup;
  caps: GroupCapabilities;
}

function TabBody({ id, group, caps }: TabBodyProps): React.JSX.Element {
  switch (id) {
    case "overview":
      return <OverviewTab group={group} caps={caps} />;
    case "members":
      return <MembersTab group={group} caps={caps} />;
    case "subgroups":
      return <SubgroupsTab group={group} caps={caps} />;
    case "permissions":
      return <PermissionsTab group={group} caps={caps} />;
    case "danger":
      return <DangerTab group={group} caps={caps} />;
  }
}

interface OverviewTabProps {
  group: UserGroup;
  caps: GroupCapabilities;
}

function OverviewTab({ group, caps }: OverviewTabProps): React.JSX.Element {
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset local form whenever the store's group changes (realtime
  // `user_group:update` echo, re-register snapshot, or another admin's
  // edit). Keying on the actual store values rather than `group`
  // itself avoids a no-op reset on every parent re-render.
  useEffect(() => {
    setName(group.name);
  }, [group.name]);
  useEffect(() => {
    setDescription(group.description);
  }, [group.description]);

  // System groups are read-only by policy; non-managers also can't
  // rename or change the description — the API would refuse anyway.
  const readOnly = group.is_system_group || !caps.canManage;
  const trimmedName = name.trim();
  const trimmedDescription = description.trim();
  const nameChanged = trimmedName !== group.name;
  const descriptionChanged = trimmedDescription !== group.description;
  const dirty =
    trimmedName !== "" && (nameChanged || descriptionChanged);

  const handleSubmit = async (): Promise<void> => {
    if (!dirty || saving) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiClient.updateUserGroup(group.id, {
        ...(nameChanged ? { name: trimmedName } : {}),
        ...(descriptionChanged ? { description: trimmedDescription } : {}),
      });
      // Success: realtime `user_group:update` will fold into the
      // store and our `useEffect`s will re-sync the inputs.
    } catch (cause) {
      setError(describeApiError(cause, "Не удалось сохранить изменения."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.tabPanel}>
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
        <div className={styles.field}>
          <label className={styles.label} htmlFor="group-name">
            Название
          </label>
          <Input
            id="group-name"
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
            maxLength={NAME_MAX}
            disabled={readOnly || saving}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="group-description">
            Описание
          </label>
          <Textarea
            id="group-description"
            value={description}
            onChange={(event) => setDescription(event.currentTarget.value)}
            maxLength={DESCRIPTION_MAX}
            disabled={readOnly || saving}
            rows={3}
          />
        </div>

        <dl className={styles.metaList}>
          <div className={styles.metaItem}>
            <dt className={styles.metaLabel}>Прямых участников</dt>
            <dd className={styles.metaValue}>{group.members.length}</dd>
          </div>
          <div className={styles.metaItem}>
            <dt className={styles.metaLabel}>Прямых подгрупп</dt>
            <dd className={styles.metaValue}>
              {group.direct_subgroup_ids.length}
            </dd>
          </div>
          <div className={styles.metaItem}>
            <dt className={styles.metaLabel}>Состояние</dt>
            <dd className={styles.metaValue}>
              {group.deactivated ? "Деактивирована" : "Активна"}
            </dd>
          </div>
        </dl>

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

interface DeactivatedBannerProps {
  group: UserGroup;
  caps: GroupCapabilities;
}

function DeactivatedBanner({
  group,
  caps,
}: DeactivatedBannerProps): React.JSX.Element {
  const [reactivating, setReactivating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReactivate = async (): Promise<void> => {
    setReactivating(true);
    setError(null);
    try {
      await apiClient.updateUserGroup(group.id, { deactivated: false });
      // Success: realtime `user_group:update` flips `deactivated`
      // back to `false`; the banner unmounts on the next render.
    } catch (cause) {
      setError(describeApiError(cause, "Не удалось реактивировать группу."));
      setReactivating(false);
    }
  };

  return (
    <Banner tone="warning" title="Группа деактивирована">
      <div className={styles.reactivateRow}>
        <span>Восстановите активность, чтобы продолжить редактирование.</span>
        {caps.canManage && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            loading={reactivating}
            onClick={() => void handleReactivate()}
          >
            Реактивировать
          </Button>
        )}
      </div>
      {error !== null && <p className={styles.reactivateError}>{error}</p>}
    </Banner>
  );
}
