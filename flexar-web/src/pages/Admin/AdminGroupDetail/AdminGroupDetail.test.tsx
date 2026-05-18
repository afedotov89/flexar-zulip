// Tests for the admin user-group detail page (Phase C1 — tabbed shell
// + Overview tab).
//
// Inherits B1's param → store lookup cases (renders meta strip, not-
// found path, system / deactivated badges). C1 adds: the 5-tab shell
// (order, default selection, switching), the Overview Save flow
// (dirty-check, single-key vs both-key payload, error banner), the
// system-group read-only state, and the deactivation banner with its
// Реактивировать button. The four placeholder tab bodies each name
// their upcoming phase — one assertion each.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

vi.mock("../../../realtime", () => ({
  realtimeConnection: {
    onInitialState: () => () => {},
    subscribe: () => () => {},
  },
}));

const {
  updateUserGroupMock,
  addUserGroupMembersMock,
  removeUserGroupMembersMock,
  addUserGroupSubgroupsMock,
  removeUserGroupSubgroupsMock,
  deactivateUserGroupMock,
} = vi.hoisted(() => ({
  updateUserGroupMock: vi.fn(),
  addUserGroupMembersMock: vi.fn(),
  removeUserGroupMembersMock: vi.fn(),
  addUserGroupSubgroupsMock: vi.fn(),
  removeUserGroupSubgroupsMock: vi.fn(),
  deactivateUserGroupMock: vi.fn(),
}));
vi.mock("../../../api", async () => {
  const actual =
    await vi.importActual<typeof import("../../../api")>("../../../api");
  return {
    ...actual,
    apiClient: {
      updateUserGroup: updateUserGroupMock,
      addUserGroupMembers: addUserGroupMembersMock,
      removeUserGroupMembers: removeUserGroupMembersMock,
      addUserGroupSubgroups: addUserGroupSubgroupsMock,
      removeUserGroupSubgroups: removeUserGroupSubgroupsMock,
      deactivateUserGroup: deactivateUserGroupMock,
    },
  };
});

// Default to a viewer with full per-group powers so the historical
// tests (which exercise every editable affordance) still see them.
// The capability hooks are independently covered in their own
// unit tests.
vi.mock("../../../lib/hooks/useGroupCapabilities", () => ({
  useGroupCapabilities: () => ({
    canManage: true,
    canAddMembers: true,
    canRemoveMembers: true,
    canSeeDetail: true,
  }),
}));
vi.mock("../../../lib/hooks/useAdminCapabilities", () => ({
  useAdminCapabilities: () => ({
    isRealmAdmin: true,
    canManageOrg: true,
    canInviteUsers: true,
    canCreateBots: true,
    canCreateWriteOnlyBots: true,
    canCreateGroups: true,
    canManageAllGroups: true,
    managedGroupIds: new Set<number>(),
    manageableGroupIds: new Set<number>(),
    hasAnyAdminAccess: true,
  }),
}));

import type { UserGroup } from "../../../domain";
import { useUserGroupsStore } from "../../../stores/userGroupsStore";
import { AdminGroupDetail } from "./AdminGroupDetail";

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

function seed(groups: UserGroup[]): void {
  const directory: Record<number, UserGroup> = {};
  for (const g of groups) {
    directory[g.id] = g;
  }
  useUserGroupsStore.setState({ userGroups: directory });
}

function renderAt(path: string): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/groups/:id" element={<AdminGroupDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useUserGroupsStore.setState({ userGroups: {} });
  updateUserGroupMock.mockReset();
  addUserGroupMembersMock.mockReset();
  removeUserGroupMembersMock.mockReset();
  addUserGroupSubgroupsMock.mockReset();
  removeUserGroupSubgroupsMock.mockReset();
  deactivateUserGroupMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AdminGroupDetail — basic shell (B1 carry-over)", () => {
  it("renders the group's name, description, and meta when found", () => {
    seed([
      makeGroup({
        id: 7,
        name: "ops",
        description: "Operations team",
        members: [1, 2, 3],
        direct_subgroup_ids: [11, 12],
      }),
    ]);
    renderAt("/admin/groups/7");

    expect(
      screen.getByRole("heading", { level: 1, name: /ops/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("Прямых участников")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Прямых подгрупп")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("Активна")).toBeInTheDocument();
  });

  it("renders the system badge for system groups", () => {
    seed([
      makeGroup({
        id: 1,
        name: "role:administrators",
        is_system_group: true,
      }),
    ]);
    renderAt("/admin/groups/1");
    expect(screen.getByText("Системная")).toBeInTheDocument();
  });

  it("shows the not-found state when the id is unknown", () => {
    renderAt("/admin/groups/999");
    expect(screen.getByText("Группа не найдена")).toBeInTheDocument();
  });

  it("shows the not-found state when the id is non-numeric", () => {
    renderAt("/admin/groups/abc");
    expect(screen.getByText("Группа не найдена")).toBeInTheDocument();
  });

  it("renders 'Деактивирована' for a deactivated group", () => {
    seed([makeGroup({ id: 1, name: "old", deactivated: true })]);
    renderAt("/admin/groups/1");
    expect(screen.getByText("Деактивирована")).toBeInTheDocument();
  });
});

describe("AdminGroupDetail — tab shell", () => {
  it("renders all 5 tabs in order", () => {
    seed([makeGroup({ id: 1, name: "ops" })]);
    renderAt("/admin/groups/1");
    const tablist = screen.getByRole("tablist", { name: "Разделы группы" });
    const tabButtons = within(tablist).getAllByRole("tab");
    expect(tabButtons.map((t) => t.textContent)).toEqual([
      "Обзор",
      "Участники",
      "Подгруппы",
      "Права",
      "Опасная зона",
    ]);
  });

  it("makes Overview the active tab by default", () => {
    seed([makeGroup({ id: 1, name: "ops" })]);
    renderAt("/admin/groups/1");
    expect(
      screen.getByRole("tab", { name: "Обзор", selected: true }),
    ).toBeInTheDocument();
  });

  it("switches the active panel when another tab is clicked", () => {
    seed([makeGroup({ id: 1, name: "ops" })]);
    renderAt("/admin/groups/1");
    fireEvent.click(screen.getByRole("tab", { name: "Участники" }));
    expect(
      screen.getByRole("tab", { name: "Участники", selected: true }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Прямые участники/)).toBeInTheDocument();
  });

  it("renders the Subgroups tab body when activated", () => {
    seed([makeGroup({ id: 1, name: "ops" })]);
    renderAt("/admin/groups/1");
    fireEvent.click(screen.getByRole("tab", { name: "Подгруппы" }));
    expect(screen.getByText(/Прямые подгруппы/)).toBeInTheDocument();
  });

  it("renders the Permissions tab body when activated", () => {
    seed([makeGroup({ id: 1, name: "ops" })]);
    renderAt("/admin/groups/1");

    fireEvent.click(screen.getByRole("tab", { name: "Права" }));
    expect(
      screen.getByRole("heading", { name: "Управление группой" }),
    ).toBeInTheDocument();
  });

  it("renders the Danger zone tab body when activated", () => {
    seed([makeGroup({ id: 1, name: "ops" })]);
    renderAt("/admin/groups/1");

    fireEvent.click(screen.getByRole("tab", { name: "Опасная зона" }));
    expect(
      screen.getByRole("heading", { name: "Опасная зона" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Деактивировать" }),
    ).toBeInTheDocument();
  });
});

describe("AdminGroupDetail — Overview tab Save", () => {
  it("disables Save when the form matches store values", () => {
    seed([makeGroup({ id: 1, name: "ops", description: "hi" })]);
    renderAt("/admin/groups/1");
    expect(screen.getByRole("button", { name: "Сохранить" })).toBeDisabled();
  });

  it("enables Save when the name is edited", () => {
    seed([makeGroup({ id: 1, name: "ops" })]);
    renderAt("/admin/groups/1");
    fireEvent.change(screen.getByLabelText("Название"), {
      target: { value: "ops-2" },
    });
    expect(
      screen.getByRole("button", { name: "Сохранить" }),
    ).not.toBeDisabled();
  });

  it("disables Save again when the trimmed name is empty", () => {
    seed([makeGroup({ id: 1, name: "ops" })]);
    renderAt("/admin/groups/1");
    fireEvent.change(screen.getByLabelText("Название"), {
      target: { value: "   " },
    });
    expect(screen.getByRole("button", { name: "Сохранить" })).toBeDisabled();
  });

  it("sends only the name when only the name changed", async () => {
    seed([makeGroup({ id: 1, name: "ops", description: "hi" })]);
    updateUserGroupMock.mockResolvedValueOnce(undefined);
    renderAt("/admin/groups/1");

    fireEvent.change(screen.getByLabelText("Название"), {
      target: { value: "  ops-2  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() => {
      expect(updateUserGroupMock).toHaveBeenCalledWith(1, { name: "ops-2" });
    });
  });

  it("sends both name and description when both changed", async () => {
    seed([makeGroup({ id: 1, name: "ops", description: "hi" })]);
    updateUserGroupMock.mockResolvedValueOnce(undefined);
    renderAt("/admin/groups/1");

    fireEvent.change(screen.getByLabelText("Название"), {
      target: { value: "ops-2" },
    });
    fireEvent.change(screen.getByLabelText("Описание"), {
      target: { value: "Operations" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() => {
      expect(updateUserGroupMock).toHaveBeenCalledWith(1, {
        name: "ops-2",
        description: "Operations",
      });
    });
  });

  it("surfaces a banner and re-enables Save when the request fails", async () => {
    seed([makeGroup({ id: 1, name: "ops" })]);
    updateUserGroupMock.mockRejectedValueOnce(new Error("Name in use"));
    renderAt("/admin/groups/1");

    fireEvent.change(screen.getByLabelText("Название"), {
      target: { value: "ops-2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Name in use");
    });
    expect(
      screen.getByRole("button", { name: "Сохранить" }),
    ).not.toBeDisabled();
  });
});

describe("AdminGroupDetail — system group read-only", () => {
  it("shows the system banner, disables inputs, and hides Save", () => {
    seed([
      makeGroup({
        id: 1,
        name: "role:administrators",
        is_system_group: true,
      }),
    ]);
    renderAt("/admin/groups/1");

    expect(
      screen.getByText(/Системная группа — редактирование недоступно/),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Название")).toBeDisabled();
    expect(screen.getByLabelText("Описание")).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Сохранить" }),
    ).not.toBeInTheDocument();
  });
});

describe("AdminGroupDetail — deactivated group", () => {
  it("shows the deactivation banner and calls reactivate with {deactivated: false}", async () => {
    seed([makeGroup({ id: 1, name: "old", deactivated: true })]);
    updateUserGroupMock.mockResolvedValueOnce(undefined);
    renderAt("/admin/groups/1");

    expect(screen.getByText("Группа деактивирована")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Реактивировать" }));

    await waitFor(() => {
      expect(updateUserGroupMock).toHaveBeenCalledWith(1, {
        deactivated: false,
      });
    });
  });
});
