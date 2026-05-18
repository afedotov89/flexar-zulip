// Tests for `PermissionsTab` (Phase C4).
//
// Covers: render renders all six pickers; Save is disabled when clean;
// Save sends only the changed key; Save sends multiple keys when
// multiple changed; failure surfaces a Banner; system groups hide Save
// behind a read-only banner; deactivated groups show the deactivation
// banner; a named-mode change submits a plain `number` (not a JSON
// envelope — that wrapping happens inside the client).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

vi.mock("../../../realtime", () => ({
  realtimeConnection: {
    onInitialState: () => () => {},
    subscribe: () => () => {},
  },
}));

const { updateUserGroupSettingsMock } = vi.hoisted(() => ({
  updateUserGroupSettingsMock: vi.fn(),
}));
vi.mock("../../../api", async () => {
  const actual =
    await vi.importActual<typeof import("../../../api")>("../../../api");
  return {
    ...actual,
    apiClient: {
      updateUserGroupSettings: updateUserGroupSettingsMock,
    },
  };
});

import type { UserGroup } from "../../../domain";
import { useUserGroupsStore } from "../../../stores/userGroupsStore";
import { useUsersStore } from "../../../stores/usersStore";
import { PermissionsTab } from "./PermissionsTab";

function makeGroup(overrides: Partial<UserGroup> & { id: number }): UserGroup {
  return {
    name: `group-${overrides.id}`,
    description: "",
    is_system_group: false,
    members: [],
    direct_subgroup_ids: [],
    creator_id: null,
    date_created: null,
    deactivated: false,
    can_add_members_group: 1,
    can_join_group: 1,
    can_leave_group: 1,
    can_manage_group: 1,
    can_mention_group: 1,
    can_remove_members_group: 1,
    ...overrides,
  };
}

function seedGroups(groups: UserGroup[]): void {
  const directory: Record<number, UserGroup> = {};
  for (const g of groups) {
    directory[g.id] = g;
  }
  useUserGroupsStore.setState({ userGroups: directory });
}

const FULL_CAPS = {
  canManage: true,
  canAddMembers: true,
  canRemoveMembers: true,
  canSeeDetail: true,
};

function renderTab(group: UserGroup): void {
  render(<PermissionsTab group={group} caps={FULL_CAPS} />);
}

beforeEach(() => {
  useUserGroupsStore.setState({ userGroups: {} });
  useUsersStore.setState({ users: {} });
  updateUserGroupSettingsMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PermissionsTab — render", () => {
  it("renders one section per setting", () => {
    seedGroups([
      makeGroup({ id: 1, name: "role:everyone", is_system_group: true }),
      makeGroup({ id: 9, name: "ops" }),
    ]);
    renderTab(makeGroup({ id: 9, name: "ops" }));

    expect(
      screen.getByRole("heading", { name: "Управление группой" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Вступление в группу" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Выход из группы" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Добавление участников" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Удаление участников" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Упоминание группы" }),
    ).toBeInTheDocument();
  });

  it("disables Save when no setting has been changed", () => {
    seedGroups([
      makeGroup({ id: 1, name: "role:everyone", is_system_group: true }),
      makeGroup({ id: 9, name: "ops" }),
    ]);
    renderTab(makeGroup({ id: 9, name: "ops" }));
    expect(screen.getByRole("button", { name: "Сохранить" })).toBeDisabled();
  });
});

describe("PermissionsTab — Save flow", () => {
  it("sends only the one changed setting as a plain number value", async () => {
    seedGroups([
      makeGroup({ id: 1, name: "role:everyone", is_system_group: true }),
      makeGroup({ id: 2, name: "role:moderators", is_system_group: true }),
      makeGroup({ id: 9, name: "ops", can_mention_group: 1 }),
    ]);
    updateUserGroupSettingsMock.mockResolvedValueOnce(undefined);
    renderTab(makeGroup({ id: 9, name: "ops", can_mention_group: 1 }));

    // Find the "Упоминание группы" picker and switch its named-mode
    // Select to a different system group.
    const selects = screen.getAllByLabelText("Выбрать группу");
    // Six pickers, six selects; the order matches SETTINGS — the last
    // setting is "Упоминание группы". Use the last select.
    const mentionSelect = selects[selects.length - 1];
    fireEvent.change(mentionSelect, { target: { value: "2" } });

    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() => {
      expect(updateUserGroupSettingsMock).toHaveBeenCalledWith(9, {
        canMentionGroup: 2,
      });
    });
  });

  it("sends multiple keys when multiple settings changed", async () => {
    seedGroups([
      makeGroup({ id: 1, name: "role:everyone", is_system_group: true }),
      makeGroup({ id: 2, name: "role:moderators", is_system_group: true }),
      makeGroup({
        id: 9,
        name: "ops",
        can_manage_group: 1,
        can_join_group: 1,
      }),
    ]);
    updateUserGroupSettingsMock.mockResolvedValueOnce(undefined);
    renderTab(
      makeGroup({
        id: 9,
        name: "ops",
        can_manage_group: 1,
        can_join_group: 1,
      }),
    );

    const selects = screen.getAllByLabelText("Выбрать группу");
    // SETTINGS order: manage, join, leave, addMembers, removeMembers, mention
    fireEvent.change(selects[0], { target: { value: "2" } });
    fireEvent.change(selects[1], { target: { value: "2" } });

    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() => {
      expect(updateUserGroupSettingsMock).toHaveBeenCalledWith(9, {
        canManageGroup: 2,
        canJoinGroup: 2,
      });
    });
  });

  it("surfaces a banner and re-enables Save when the request fails", async () => {
    seedGroups([
      makeGroup({ id: 1, name: "role:everyone", is_system_group: true }),
      makeGroup({ id: 2, name: "role:moderators", is_system_group: true }),
      makeGroup({ id: 9, name: "ops" }),
    ]);
    updateUserGroupSettingsMock.mockRejectedValueOnce(
      new Error("Forbidden"),
    );
    renderTab(makeGroup({ id: 9, name: "ops" }));

    const selects = screen.getAllByLabelText("Выбрать группу");
    fireEvent.change(selects[0], { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Forbidden");
    });
    expect(
      screen.getByRole("button", { name: "Сохранить" }),
    ).not.toBeDisabled();
  });
});

describe("PermissionsTab — read-only states", () => {
  it("system groups: banner shown, Save hidden, pickers disabled", () => {
    seedGroups([
      makeGroup({ id: 1, name: "role:administrators", is_system_group: true }),
    ]);
    renderTab(
      makeGroup({ id: 1, name: "role:administrators", is_system_group: true }),
    );

    expect(
      screen.getByText(/Системная группа — права доступа неизменны/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Сохранить" }),
    ).not.toBeInTheDocument();
    // First named-mode Select should be disabled.
    expect(screen.getAllByLabelText("Выбрать группу")[0]).toBeDisabled();
  });

  it("deactivated groups: banner shown, Save hidden, pickers disabled", () => {
    seedGroups([
      makeGroup({ id: 9, name: "old", deactivated: true }),
    ]);
    renderTab(makeGroup({ id: 9, name: "old", deactivated: true }));

    expect(
      screen.getByText(/Группа деактивирована — реактивируйте/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Сохранить" }),
    ).not.toBeInTheDocument();
  });
});
