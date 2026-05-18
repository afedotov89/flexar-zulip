// Tests for `MembersTab` (Phase C2).
//
// Cases: list render with N rows, empty state, system / deactivated
// read-only banners (no add / remove affordances), add via typeahead,
// remove via confirm modal, and the error-path banner on API failure.
// Mocks `apiClient.addUserGroupMembers` / `removeUserGroupMembers`
// using the same hoisted-mock pattern as `AdminGroupDetail.test.tsx`.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("../../../realtime", () => ({
  realtimeConnection: {
    onInitialState: () => () => {},
    subscribe: () => () => {},
  },
}));

const { addUserGroupMembersMock, removeUserGroupMembersMock } = vi.hoisted(
  () => ({
    addUserGroupMembersMock: vi.fn(),
    removeUserGroupMembersMock: vi.fn(),
  }),
);
vi.mock("../../../api", async () => {
  const actual =
    await vi.importActual<typeof import("../../../api")>("../../../api");
  return {
    ...actual,
    apiClient: {
      addUserGroupMembers: addUserGroupMembersMock,
      removeUserGroupMembers: removeUserGroupMembersMock,
    },
  };
});

import type { User, UserGroup } from "../../../domain";
import { RoleValues } from "../../../domain";
import { useUsersStore } from "../../../stores/usersStore";
import { MembersTab } from "./MembersTab";

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

function seedUsers(users: User[]): void {
  const directory: Record<number, User> = {};
  for (const user of users) {
    directory[user.user_id] = user;
  }
  useUsersStore.setState({ users: directory });
}

const FULL_CAPS = {
  canManage: true,
  canAddMembers: true,
  canRemoveMembers: true,
  canSeeDetail: true,
};

function renderTab(group: UserGroup): void {
  render(
    <MemoryRouter>
      <MembersTab group={group} caps={FULL_CAPS} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useUsersStore.setState({ users: {} });
  addUserGroupMembersMock.mockReset();
  removeUserGroupMembersMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("MembersTab — list rendering", () => {
  it("renders one row per direct member, alphabetised", () => {
    seedUsers([
      makeUser({ user_id: 1, full_name: "Alice Smith" }),
      makeUser({ user_id: 2, full_name: "Bob Jones" }),
    ]);
    renderTab(makeGroup({ id: 1, name: "ops", members: [2, 1] }));

    const list = screen.getByRole("list", { name: "Прямые участники группы" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Alice Smith");
    expect(items[1]).toHaveTextContent("Bob Jones");
    expect(
      screen.getByRole("heading", { name: /Прямые участники \(2\)/ }),
    ).toBeInTheDocument();
  });

  it("shows the empty state when there are no members", () => {
    renderTab(makeGroup({ id: 1, name: "ops", members: [] }));
    expect(
      screen.getByText(/В группе нет участников/),
    ).toBeInTheDocument();
  });

  it("falls back to a placeholder label when a member id is unknown", () => {
    renderTab(makeGroup({ id: 1, name: "ops", members: [42] }));
    expect(screen.getByText("Пользователь #42")).toBeInTheDocument();
  });

  it("renders the footnote about subgroup members being excluded", () => {
    renderTab(makeGroup({ id: 1, name: "ops" }));
    expect(
      screen.getByText(/Участники подгрупп здесь не учитываются/),
    ).toBeInTheDocument();
  });
});

describe("MembersTab — system / deactivated read-only", () => {
  it("system group: shows banner and hides add / remove affordances", () => {
    seedUsers([makeUser({ user_id: 1, full_name: "Alice Smith" })]);
    renderTab(
      makeGroup({
        id: 1,
        name: "role:administrators",
        is_system_group: true,
        members: [1],
      }),
    );

    expect(
      screen.getByText(/Системная группа — управление участниками недоступно/),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Добавить участника"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Удалить .* из группы/ }),
    ).not.toBeInTheDocument();
    // List still renders so admins can audit the roster.
    expect(screen.getByText("Alice Smith")).toBeInTheDocument();
  });

  it("deactivated group: shows banner and hides add / remove affordances", () => {
    seedUsers([makeUser({ user_id: 1, full_name: "Alice Smith" })]);
    renderTab(
      makeGroup({ id: 1, name: "old", deactivated: true, members: [1] }),
    );

    expect(
      screen.getByText(/Группа деактивирована — реактивируйте/),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Добавить участника"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Удалить .* из группы/ }),
    ).not.toBeInTheDocument();
  });
});

describe("MembersTab — add via typeahead", () => {
  it("calls addUserGroupMembers with the picked user id", async () => {
    seedUsers([makeUser({ user_id: 7, full_name: "Bob Jones" })]);
    addUserGroupMembersMock.mockResolvedValueOnce(undefined);
    renderTab(makeGroup({ id: 1, name: "ops" }));

    fireEvent.change(screen.getByLabelText("Добавить участника"), {
      target: { value: "bob" },
    });
    fireEvent.click(screen.getByText("Bob Jones"));

    await waitFor(() => {
      expect(addUserGroupMembersMock).toHaveBeenCalledWith(1, [7]);
    });
  });

  it("surfaces a banner when the add API fails", async () => {
    seedUsers([makeUser({ user_id: 7, full_name: "Bob Jones" })]);
    addUserGroupMembersMock.mockRejectedValueOnce(new Error("Server down"));
    renderTab(makeGroup({ id: 1, name: "ops" }));

    fireEvent.change(screen.getByLabelText("Добавить участника"), {
      target: { value: "bob" },
    });
    fireEvent.click(screen.getByText("Bob Jones"));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Server down");
    });
  });
});

describe("MembersTab — remove flow", () => {
  it("opens confirm modal and calls removeUserGroupMembers on confirm", async () => {
    seedUsers([makeUser({ user_id: 1, full_name: "Alice Smith" })]);
    removeUserGroupMembersMock.mockResolvedValueOnce(undefined);
    renderTab(makeGroup({ id: 9, name: "ops", members: [1] }));

    fireEvent.click(
      screen.getByRole("button", { name: "Удалить Alice Smith из группы" }),
    );

    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByRole("heading", { name: "Удалить участника?" }),
    ).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Удалить" }));

    await waitFor(() => {
      expect(removeUserGroupMembersMock).toHaveBeenCalledWith(9, [1]);
    });
  });

  it("surfaces a banner when the remove API fails", async () => {
    seedUsers([makeUser({ user_id: 1, full_name: "Alice Smith" })]);
    removeUserGroupMembersMock.mockRejectedValueOnce(new Error("Forbidden"));
    renderTab(makeGroup({ id: 9, name: "ops", members: [1] }));

    fireEvent.click(
      screen.getByRole("button", { name: "Удалить Alice Smith из группы" }),
    );
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Удалить" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Forbidden");
    });
  });
});
