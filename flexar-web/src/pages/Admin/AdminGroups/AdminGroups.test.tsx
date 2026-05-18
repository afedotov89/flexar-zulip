// Tests for the admin user-groups list page (Phase B1 + B2/B3).
//
// Verifies the store-driven render path: empty state when the
// directory is empty, sorted rows with badges + member counts when
// populated, search + tab filtering, the hydrate-window skeleton
// state, and the "Создать группу" trigger that opens the modal.
//
// The realtime mock exposes a `statusRef` so individual tests can
// toggle between "connecting" (skeleton) and "connected" (normal
// render); the page reads it via `useStoresLoading`.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const { statusRef } = vi.hoisted(() => ({
  statusRef: { current: "connected" as "connecting" | "connected" },
}));

vi.mock("../../../realtime", () => ({
  realtimeConnection: {
    onInitialState: () => () => {},
    subscribe: () => () => {},
    onStatusChange: () => () => {},
    getStatus: () => statusRef.current,
  },
}));

const { createUserGroupMock } = vi.hoisted(() => ({
  createUserGroupMock: vi.fn(),
}));
vi.mock("../../../api", async () => {
  const actual =
    await vi.importActual<typeof import("../../../api")>("../../../api");
  return {
    ...actual,
    apiClient: {
      createUserGroup: createUserGroupMock,
    },
  };
});

// Default the viewer to a full admin so the existing tests keep
// seeing the historical surface (every group visible, Создать
// группу button enabled). Tests that specifically care about the
// non-admin filter mutate this object to assert the gated view.
const adminCapsMock = vi.hoisted(() => ({
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
}));
vi.mock("../../../lib/hooks/useAdminCapabilities", () => ({
  useAdminCapabilities: () => adminCapsMock,
}));

import type { User, UserGroup } from "../../../domain";
import { RoleValues } from "../../../domain";
import { useAuthStore } from "../../../stores/authStore";
import { useUserGroupsStore } from "../../../stores/userGroupsStore";
import { useUsersStore } from "../../../stores/usersStore";
import { AdminGroups } from "./AdminGroups";

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

function makeUser(overrides: Partial<User> & { user_id: number }): User {
  const base: User = {
    user_id: overrides.user_id,
    delivery_email: null,
    email: `user${overrides.user_id}@example.com`,
    full_name: `User ${overrides.user_id}`,
    date_joined: "2024-01-01T00:00:00Z",
    is_active: true,
    is_owner: false,
    is_admin: false,
    is_guest: false,
    is_bot: false,
    bot_type: null,
    bot_owner_id: null,
    role: RoleValues.Member,
    timezone: "",
    avatar_url: null,
    avatar_version: 1,
    is_imported_stub: false,
  };
  return { ...base, ...overrides };
}

function seed(groups: UserGroup[]): void {
  const directory: Record<number, UserGroup> = {};
  for (const g of groups) {
    directory[g.id] = g;
  }
  useUserGroupsStore.setState({ userGroups: directory });
}

function seedUsers(users: User[]): void {
  const directory: Record<number, User> = {};
  for (const user of users) {
    directory[user.user_id] = user;
  }
  useUsersStore.setState({ users: directory });
}

function seedViewer(userId: number): void {
  useAuthStore.setState({
    session: { email: "me@example.com", apiKey: "k", userId },
    status: "authenticated",
  });
}

beforeEach(() => {
  statusRef.current = "connected";
  createUserGroupMock.mockReset();
  useUserGroupsStore.setState({ userGroups: {} });
  useUsersStore.setState({ users: {} });
  useAuthStore.setState({
    session: { email: "me@example.com", apiKey: "k", userId: 999 },
    status: "authenticated",
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function renderPage(): void {
  render(
    <MemoryRouter initialEntries={["/admin/groups"]}>
      <AdminGroups />
    </MemoryRouter>,
  );
}

describe("AdminGroups (B1 shell)", () => {
  it("shows the empty state when the directory has no groups", () => {
    renderPage();
    expect(screen.getByText("Нет групп")).toBeInTheDocument();
  });

  it("excludes system groups from the flat list and lists custom alphabetically", () => {
    // System groups now live in the SystemGroupTree section above the
    // flat list (Variant C). The flat list shows only custom groups
    // on the "Все" tab, sorted alphabetically.
    seed([
      makeGroup({ id: 1, name: "ops", members: [10] }),
      makeGroup({ id: 2, name: "alpha", members: [20, 30] }),
      makeGroup({
        id: 3,
        name: "role:administrators",
        is_system_group: true,
      }),
    ]);
    renderPage();

    const list = screen.getByRole("list", { name: "Список групп" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("alpha")).toBeInTheDocument();
    expect(within(rows[1]).getByText("ops")).toBeInTheDocument();
    // The system group is still in the page — but inside the tree
    // section. The toggle button names it; tree itself collapsed by
    // default.
    expect(
      screen.getByRole("button", { name: /Системные роли/ }),
    ).toBeInTheDocument();
  });

  it("renders the member count and links each row to its detail route", () => {
    seed([makeGroup({ id: 42, name: "support", members: [1, 2, 3] })]);
    renderPage();

    const link = screen.getByRole("link", { name: /support/ });
    expect(link).toHaveAttribute("href", "/admin/groups/42");
    expect(within(link).getByText("3 чел.")).toBeInTheDocument();
  });

  it("renders the group description when present", () => {
    seed([
      makeGroup({
        id: 1,
        name: "ops",
        description: "Operations team",
      }),
    ]);
    renderPage();
    expect(screen.getByText("Operations team")).toBeInTheDocument();
  });
});

describe("AdminGroups — search", () => {
  it("filters by name substring (case-insensitive)", () => {
    seed([
      makeGroup({ id: 1, name: "marketing" }),
      makeGroup({ id: 2, name: "engineering" }),
    ]);
    renderPage();

    fireEvent.change(screen.getByPlaceholderText("Поиск"), {
      target: { value: "MARK" },
    });

    const list = screen.getByRole("list", { name: "Список групп" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(1);
    expect(within(rows[0]).getByText("marketing")).toBeInTheDocument();
  });

  it("filters by description substring (case-insensitive)", () => {
    seed([
      makeGroup({
        id: 1,
        name: "ops",
        description: "Operations and infra",
      }),
      makeGroup({
        id: 2,
        name: "design",
        description: "Brand and UI",
      }),
    ]);
    renderPage();

    fireEvent.change(screen.getByPlaceholderText("Поиск"), {
      target: { value: "infra" },
    });

    const list = screen.getByRole("list", { name: "Список групп" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(1);
    expect(within(rows[0]).getByText("ops")).toBeInTheDocument();
  });

  it("shows the 'Нет совпадений' empty-state when search has no matches", () => {
    seed([makeGroup({ id: 1, name: "ops" })]);
    renderPage();

    fireEvent.change(screen.getByPlaceholderText("Поиск"), {
      target: { value: "zzz" },
    });

    expect(screen.getByText("Нет совпадений")).toBeInTheDocument();
    expect(screen.queryByText("Нет групп")).not.toBeInTheDocument();
  });
});

describe("AdminGroups — filter tabs", () => {
  it("'Мои' filters to groups where the viewer is a direct member", () => {
    seedViewer(42);
    seed([
      makeGroup({ id: 1, name: "mine-direct", members: [42, 7] }),
      makeGroup({ id: 2, name: "someone-elses", members: [7] }),
      makeGroup({ id: 3, name: "also-mine", members: [42] }),
    ]);
    renderPage();

    fireEvent.click(screen.getByRole("tab", { name: "Мои" }));

    const list = screen.getByRole("list", { name: "Список групп" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("also-mine")).toBeInTheDocument();
    expect(within(rows[1]).getByText("mine-direct")).toBeInTheDocument();
  });

  it("'Кастомные' excludes system groups", () => {
    seed([
      makeGroup({ id: 1, name: "custom-a" }),
      makeGroup({
        id: 2,
        name: "role:administrators",
        is_system_group: true,
      }),
      makeGroup({ id: 3, name: "custom-b" }),
    ]);
    renderPage();

    fireEvent.click(screen.getByRole("tab", { name: "Кастомные" }));

    const list = screen.getByRole("list", { name: "Список групп" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(
      within(list).queryByText("role:administrators"),
    ).not.toBeInTheDocument();
  });
});

describe("AdminGroups — skeleton state", () => {
  it("renders skeleton rows while the stores are still hydrating", () => {
    statusRef.current = "connecting";
    renderPage();

    const list = screen.getByRole("list", { name: "Загрузка групп" });
    expect(list).toHaveAttribute("aria-busy", "true");
    // 4 skeleton rows (cf. SKELETON_ROWS in the source).
    expect(within(list).getAllByRole("listitem")).toHaveLength(4);
    // No empty-state heading while hydrating.
    expect(screen.queryByText("Нет групп")).not.toBeInTheDocument();
  });
});

describe("AdminGroups — create modal trigger", () => {
  it("opens the create-group modal when the header button is pressed", () => {
    seedUsers([makeUser({ user_id: 1, full_name: "Alice" })]);
    renderPage();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Создать группу/ }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(
      within(dialog).getByRole("heading", { name: "Создать группу" }),
    ).toBeInTheDocument();
  });
});

describe("AdminGroups — non-admin capability filtering", () => {
  const adminSnapshot = { ...adminCapsMock };

  afterEach(() => {
    Object.assign(adminCapsMock, adminSnapshot);
  });

  it("hides 'Создать группу' when canCreateGroups is false", () => {
    Object.assign(adminCapsMock, {
      isRealmAdmin: false,
      canCreateGroups: false,
      canManageAllGroups: false,
      hasAnyAdminAccess: true,
    });
    seedViewer(7);
    seed([makeGroup({ id: 1, name: "engineering", members: [7] })]);
    renderPage();
    expect(
      screen.queryByRole("button", { name: /Создать группу/ }),
    ).not.toBeInTheDocument();
  });

  it("filters the list to groups the viewer can manage or is in", () => {
    Object.assign(adminCapsMock, {
      isRealmAdmin: false,
      canCreateGroups: false,
      canManageAllGroups: false,
      manageableGroupIds: new Set([100]),
      hasAnyAdminAccess: true,
    });
    seedViewer(7);
    seed([
      // Visible: viewer can manage.
      makeGroup({ id: 100, name: "engineering" }),
      // Visible: viewer is a direct member.
      makeGroup({ id: 200, name: "lurkers", members: [7] }),
      // Hidden: viewer has no power and isn't a member.
      makeGroup({ id: 300, name: "secrets" }),
    ]);
    renderPage();
    expect(screen.getByText("engineering")).toBeInTheDocument();
    expect(screen.getByText("lurkers")).toBeInTheDocument();
    expect(screen.queryByText("secrets")).not.toBeInTheDocument();
  });
});
