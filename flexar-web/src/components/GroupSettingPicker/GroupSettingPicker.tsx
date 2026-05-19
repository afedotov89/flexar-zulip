// Flexar Hub Web — GroupSettingPicker primitive (Phase C4).
//
// Controlled picker for a Zulip `GroupSettingValue`. A group-setting
// value is either a single user-group id ("any member of this group")
// or an explicit `{direct_members, direct_subgroups}` bundle ("these
// specific people and these specific subgroups"). The picker mirrors
// that two-shape value with a two-tab UI:
//
//   - "Группа" → render a Select of named groups; emits `number`.
//   - "Список людей и подгрупп" → render member + subgroup pickers;
//     emits the `{direct_members, direct_subgroups}` object.
//
// The picker is presentational: the parent owns the value and gets
// `onChange`. It pulls the user / group directories from the existing
// stores (so chip labels resolve without parent plumbing), and reuses
// `AddMemberInput` / `AddSubgroupInput` for the typeahead fields —
// promoted to a shared primitive here only because the permissions tab
// and channel-detail will both need it (orchestrator-approved).
//
// Mode-switch semantics: switching modes is a destructive intent
// signal — the user is telling us "I want to express this rule a
// different way". We don't try to preserve the orthogonal value across
// modes (that would silently smuggle the abandoned mode's data back on
// the next switch). Concretely:
//   - leaving "named" → emit an empty `{direct_members: [],
//     direct_subgroups: []}` (semantic "Никто", matches Zulip's empty-
//     group convention).
//   - leaving "custom" → emit the realm's "Никто" system-group id when
//     present, else the lowest-id system group as a safe default.
// The parent's dirty-check then catches the change and the user can
// Save (or revert by re-loading).

import { useMemo } from "react";
import { Avatar } from "../Avatar";
import { IconButton } from "../IconButton";
import { Select } from "../Select";
import type { SelectOption } from "../Select";
import { Tabs } from "../Tabs";
import type { TabItem } from "../Tabs";
import type {
  GroupSettingValue,
  User,
  UserGroup,
  UserId,
} from "../../domain";
import { useUserGroupsStore } from "../../stores/userGroupsStore";
import { useUsersStore } from "../../stores/usersStore";
import { AddMemberInput } from "../../pages/Admin/AdminGroups/AddMemberInput";
import { AddSubgroupInput } from "../../pages/Admin/AdminGroupDetail/AddSubgroupInput";
import styles from "./GroupSettingPicker.module.css";

export interface GroupSettingPickerProps {
  /** Current value — the parent owns this. */
  value: GroupSettingValue;
  /** Fired with the next value whenever the user makes a change. */
  onChange: (next: GroupSettingValue) => void;
  /** Disable interaction (e.g. system / deactivated group, saving). */
  disabled?: boolean;
  /** Accessible label, e.g. "Кто может добавлять участников". */
  "aria-label"?: string;
  /**
   * Group IDs to exclude from the "Группа" mode's Select (e.g. the
   * group being edited itself, to prevent self-reference). The
   * "Список людей и подгрупп" mode is unaffected — a permission can
   * still grant membership to anyone directly.
   */
  excludeNamedGroupIds?: ReadonlyArray<number>;
}

type Mode = "named" | "custom";

const MODE_TABS: TabItem[] = [
  { id: "named", label: "Группа" },
  { id: "custom", label: "Список людей и подгрупп" },
];

function isNamedValue(value: GroupSettingValue): value is number {
  return typeof value === "number";
}

/**
 * Pick a safe "empty" system group to fall back to when leaving the
 * custom mode. Prefers a group literally named `role:nobody` (Zulip's
 * canonical "Никто"), otherwise the lowest-id system group.
 */
function pickNobodyGroupId(groups: UserGroup[]): number | undefined {
  const nobody = groups.find(
    (g) => g.is_system_group && g.name === "role:nobody",
  );
  if (nobody !== undefined) {
    return nobody.id;
  }
  const systemGroups = groups.filter((g) => g.is_system_group);
  if (systemGroups.length === 0) {
    return undefined;
  }
  return systemGroups.reduce((min, g) => (g.id < min.id ? g : min)).id;
}

export function GroupSettingPicker({
  value,
  onChange,
  disabled = false,
  "aria-label": ariaLabel,
  excludeNamedGroupIds,
}: GroupSettingPickerProps): React.JSX.Element {
  const groupDirectory = useUserGroupsStore((s) => s.userGroups);
  const usersMap = useUsersStore((s) => s.users);

  const allGroups = useMemo(
    () => Object.values(groupDirectory),
    [groupDirectory],
  );

  const mode: Mode = isNamedValue(value) ? "named" : "custom";

  const handleModeChange = (next: Mode): void => {
    if (next === mode || disabled) {
      return;
    }
    if (next === "custom") {
      // Leaving "named" → empty list ≡ Zulip's "Никто".
      onChange({ direct_members: [], direct_subgroups: [] });
    } else {
      // Leaving "custom" → fall back to the safest system group.
      const fallback = pickNobodyGroupId(allGroups);
      if (fallback !== undefined) {
        onChange(fallback);
      }
    }
  };

  return (
    <div className={styles.root} aria-label={ariaLabel}>
      <Tabs
        tabs={MODE_TABS}
        activeId={mode}
        onChange={(id) => handleModeChange(id as Mode)}
        aria-label={
          ariaLabel !== undefined ? `${ariaLabel}: режим` : "Режим"
        }
      >
        {(activeId) =>
          activeId === "named" ? (
            <NamedBody
              value={isNamedValue(value) ? value : null}
              groups={allGroups}
              excludeNamedGroupIds={excludeNamedGroupIds}
              disabled={disabled}
              onChange={onChange}
            />
          ) : (
            <CustomBody
              value={
                isNamedValue(value)
                  ? { direct_members: [], direct_subgroups: [] }
                  : value
              }
              groupDirectory={groupDirectory}
              usersMap={usersMap}
              disabled={disabled}
              onChange={onChange}
            />
          )
        }
      </Tabs>
    </div>
  );
}

interface NamedBodyProps {
  value: number | null;
  groups: UserGroup[];
  excludeNamedGroupIds: ReadonlyArray<number> | undefined;
  disabled: boolean;
  onChange: (next: GroupSettingValue) => void;
}

function NamedBody({
  value,
  groups,
  excludeNamedGroupIds,
  disabled,
  onChange,
}: NamedBodyProps): React.JSX.Element {
  // Group the option list: system groups first (alpha), then custom
  // groups (alpha). System groups use their raw `role:*` name so
  // admins recognise them; custom groups use the operator-given name.
  const excluded = useMemo(
    () => new Set(excludeNamedGroupIds ?? []),
    [excludeNamedGroupIds],
  );

  const options = useMemo<SelectOption[]>(() => {
    const system: SelectOption[] = [];
    const custom: SelectOption[] = [];
    const sorted = [...groups].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
    for (const g of sorted) {
      if (excluded.has(g.id)) {
        continue;
      }
      if (g.deactivated) {
        continue;
      }
      const opt: SelectOption = { value: String(g.id), label: g.name };
      if (g.is_system_group) {
        system.push(opt);
      } else {
        custom.push(opt);
      }
    }
    return [...system, ...custom];
  }, [groups, excluded]);

  const knownIds = useMemo(
    () => new Set(options.map((o) => Number(o.value))),
    [options],
  );

  // If the server set `value` to an id we don't have (deleted group,
  // or one excluded by this picker's `excludeNamedGroupIds`), surface
  // the situation as a placeholder so the admin re-picks rather than
  // silently saving a stale id.
  const valueIsKnown = value !== null && knownIds.has(value);
  const selectValue = valueIsKnown ? String(value) : "";

  return (
    <div className={styles.namedBody}>
      <Select
        aria-label="Выбрать группу"
        value={selectValue}
        placeholder={
          valueIsKnown ? undefined : "(удалена — выберите заново)"
        }
        disabled={disabled}
        options={options}
        onChange={(event) => {
          const raw = event.currentTarget.value;
          if (raw === "") {
            return;
          }
          onChange(Number(raw));
        }}
      />
    </div>
  );
}

interface CustomBodyProps {
  value: { direct_members: UserId[]; direct_subgroups: number[] };
  groupDirectory: Record<number, UserGroup>;
  usersMap: Record<UserId, User>;
  disabled: boolean;
  onChange: (next: GroupSettingValue) => void;
}

function CustomBody({
  value,
  groupDirectory,
  usersMap,
  disabled,
  onChange,
}: CustomBodyProps): React.JSX.Element {
  const handleAddMember = (userId: UserId): void => {
    if (value.direct_members.includes(userId)) {
      return;
    }
    onChange({
      direct_members: [...value.direct_members, userId],
      direct_subgroups: value.direct_subgroups,
    });
  };

  const handleRemoveMember = (userId: UserId): void => {
    onChange({
      direct_members: value.direct_members.filter((id) => id !== userId),
      direct_subgroups: value.direct_subgroups,
    });
  };

  const handleAddSubgroup = (groupId: number): void => {
    if (value.direct_subgroups.includes(groupId)) {
      return;
    }
    onChange({
      direct_members: value.direct_members,
      direct_subgroups: [...value.direct_subgroups, groupId],
    });
  };

  const handleRemoveSubgroup = (groupId: number): void => {
    onChange({
      direct_members: value.direct_members,
      direct_subgroups: value.direct_subgroups.filter((id) => id !== groupId),
    });
  };

  const memberRows = useMemo(
    () =>
      value.direct_members.map((userId) => ({
        userId,
        user: usersMap[userId],
      })),
    [value.direct_members, usersMap],
  );

  const subgroupRows = useMemo(
    () =>
      value.direct_subgroups.map((groupId) => ({
        groupId,
        group: groupDirectory[groupId],
      })),
    [value.direct_subgroups, groupDirectory],
  );

  const isEmpty =
    value.direct_members.length === 0 && value.direct_subgroups.length === 0;

  return (
    <div className={styles.customBody}>
      <section className={styles.section}>
        <h3 className={styles.sectionHeading}>Конкретные пользователи</h3>
        {disabled ? (
          <fieldset disabled className={styles.disabledFieldset}>
            <AddMemberInput
              existingIds={value.direct_members}
              onSelect={handleAddMember}
            />
          </fieldset>
        ) : (
          <AddMemberInput
            existingIds={value.direct_members}
            onSelect={handleAddMember}
          />
        )}
        {memberRows.length > 0 && (
          <ul className={styles.list} aria-label="Выбранные пользователи">
            {memberRows.map(({ userId, user }) => {
              const displayName =
                user?.full_name ?? `Пользователь #${userId}`;
              return (
                <li key={userId} className={styles.row}>
                  <Avatar
                    src={user?.avatar_url ?? undefined}
                    name={displayName}
                    size="sm"
                  />
                  <span className={styles.text}>
                    <span className={styles.name}>{displayName}</span>
                    {user?.email !== undefined && (
                      <span className={styles.email}>{user.email}</span>
                    )}
                  </span>
                  <IconButton
                    icon="close"
                    aria-label={`Убрать ${displayName}`}
                    variant="ghost"
                    size="sm"
                    disabled={disabled}
                    onClick={() => handleRemoveMember(userId)}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionHeading}>Конкретные подгруппы</h3>
        {disabled ? (
          <fieldset disabled className={styles.disabledFieldset}>
            <AddSubgroupInput
              excludedIds={value.direct_subgroups}
              onSelect={handleAddSubgroup}
            />
          </fieldset>
        ) : (
          <AddSubgroupInput
            excludedIds={value.direct_subgroups}
            onSelect={handleAddSubgroup}
          />
        )}
        {subgroupRows.length > 0 && (
          <ul className={styles.list} aria-label="Выбранные подгруппы">
            {subgroupRows.map(({ groupId, group }) => {
              const missing = group === undefined;
              const displayName = group?.name ?? "(удалена)";
              const memberCount = group?.members.length;
              return (
                <li
                  key={groupId}
                  className={
                    missing
                      ? `${styles.row} ${styles.rowMissing}`
                      : styles.row
                  }
                >
                  <span className={styles.text}>
                    <span className={styles.name}>{displayName}</span>
                    {memberCount !== undefined && (
                      <span className={styles.meta}>{memberCount} чел.</span>
                    )}
                  </span>
                  <IconButton
                    icon="close"
                    aria-label={`Убрать подгруппу ${displayName}`}
                    variant="ghost"
                    size="sm"
                    disabled={disabled}
                    onClick={() => handleRemoveSubgroup(groupId)}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {isEmpty && <p className={styles.emptyHint}>Никто</p>}
    </div>
  );
}
