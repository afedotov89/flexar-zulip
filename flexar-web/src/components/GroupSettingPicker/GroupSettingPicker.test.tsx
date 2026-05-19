// Tests for `GroupSettingPicker` (Phase C4).
//
// Covers: mode tabs render, mode is derived from the value shape,
// switching modes emits the documented fallback values, selecting a
// named group, adding / removing members and subgroups in custom mode,
// unknown-subgroup placeholder rendering, the disabled state freezes
// interaction, and `excludeNamedGroupIds` filters the Select options.
//
// Mocks `../../realtime` so the user / user-group stores don't try to
// wire up to the realtime connection during the test run, and
// `../../api` so the typeahead-feed stores don't accidentally make
// network requests. The stores themselves are reset via `setState` in
// `beforeEach`.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

vi.mock("../../realtime", () => ({
  realtimeConnection: {
    onInitialState: () => () => {},
    subscribe: () => () => {},
  },
}));

vi.mock("../../api", async () => {
  const actual =
    await vi.importActual<typeof import("../../api")>("../../api");
  return {
    ...actual,
    apiClient: {},
  };
});

import type { GroupSettingValue, User, UserGroup } from "../../domain";
import { RoleValues } from "../../domain";
import { useUserGroupsStore } from "../../stores/userGroupsStore";
import { useUsersStore } from "../../stores/usersStore";
import { GroupSettingPicker } from "./GroupSettingPicker";

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

function seedGroups(groups: UserGroup[]): void {
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

beforeEach(() => {
  useUserGroupsStore.setState({ userGroups: {} });
  useUsersStore.setState({ users: {} });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GroupSettingPicker — mode tabs", () => {
  it("renders both mode tabs", () => {
    seedGroups([makeGroup({ id: 1, name: "role:everyone", is_system_group: true })]);
    render(<GroupSettingPicker value={1} onChange={() => {}} />);
    expect(screen.getByRole("tab", { name: "Группа" })).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "Список людей и подгрупп" }),
    ).toBeInTheDocument();
  });

  it("named mode is active when value is a number", () => {
    seedGroups([makeGroup({ id: 1, name: "role:everyone", is_system_group: true })]);
    render(<GroupSettingPicker value={1} onChange={() => {}} />);
    expect(
      screen.getByRole("tab", { name: "Группа", selected: true }),
    ).toBeInTheDocument();
  });

  it("custom mode is active when value is an object", () => {
    render(
      <GroupSettingPicker
        value={{ direct_members: [], direct_subgroups: [] }}
        onChange={() => {}}
      />,
    );
    expect(
      screen.getByRole("tab", {
        name: "Список людей и подгрупп",
        selected: true,
      }),
    ).toBeInTheDocument();
  });
});

describe("GroupSettingPicker — named mode", () => {
  it("renders the current group as selected in the Select", () => {
    seedGroups([
      makeGroup({ id: 1, name: "role:everyone", is_system_group: true }),
      makeGroup({ id: 5, name: "ops" }),
    ]);
    render(<GroupSettingPicker value={5} onChange={() => {}} />);
    const select = screen.getByLabelText("Выбрать группу") as HTMLSelectElement;
    expect(select.value).toBe("5");
  });

  it("emits a new id when a different option is selected", () => {
    seedGroups([
      makeGroup({ id: 1, name: "role:everyone", is_system_group: true }),
      makeGroup({ id: 5, name: "ops" }),
    ]);
    const onChange = vi.fn();
    render(<GroupSettingPicker value={1} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Выбрать группу"), {
      target: { value: "5" },
    });
    expect(onChange).toHaveBeenCalledWith(5);
  });

  it("renders a placeholder when the value is an unknown id", () => {
    seedGroups([
      makeGroup({ id: 1, name: "role:everyone", is_system_group: true }),
    ]);
    render(<GroupSettingPicker value={999} onChange={() => {}} />);
    expect(
      screen.getByRole("option", { name: "(удалена — выберите заново)" }),
    ).toBeInTheDocument();
  });

  it("excludeNamedGroupIds filters out the matching options", () => {
    seedGroups([
      makeGroup({ id: 1, name: "role:everyone", is_system_group: true }),
      makeGroup({ id: 5, name: "ops" }),
      makeGroup({ id: 6, name: "marketing" }),
    ]);
    render(
      <GroupSettingPicker
        value={1}
        onChange={() => {}}
        excludeNamedGroupIds={[5]}
      />,
    );
    expect(
      screen.queryByRole("option", { name: "ops" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "marketing" }),
    ).toBeInTheDocument();
  });
});

describe("GroupSettingPicker — mode switching", () => {
  it("emits an empty object when switching from named to custom", () => {
    seedGroups([
      makeGroup({ id: 1, name: "role:everyone", is_system_group: true }),
    ]);
    const onChange = vi.fn();
    render(<GroupSettingPicker value={1} onChange={onChange} />);
    fireEvent.click(
      screen.getByRole("tab", { name: "Список людей и подгрупп" }),
    );
    expect(onChange).toHaveBeenCalledWith({
      direct_members: [],
      direct_subgroups: [],
    });
  });

  it("emits the 'Никто' system-group id when switching from custom to named", () => {
    seedGroups([
      makeGroup({ id: 1, name: "role:everyone", is_system_group: true }),
      makeGroup({ id: 2, name: "role:nobody", is_system_group: true }),
    ]);
    const onChange = vi.fn();
    render(
      <GroupSettingPicker
        value={{ direct_members: [], direct_subgroups: [] }}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: "Группа" }));
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it("falls back to the lowest-id system group when no 'Никто' exists", () => {
    seedGroups([
      makeGroup({ id: 5, name: "role:moderators", is_system_group: true }),
      makeGroup({ id: 3, name: "role:everyone", is_system_group: true }),
    ]);
    const onChange = vi.fn();
    render(
      <GroupSettingPicker
        value={{ direct_members: [], direct_subgroups: [] }}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: "Группа" }));
    expect(onChange).toHaveBeenCalledWith(3);
  });
});

describe("GroupSettingPicker — custom mode", () => {
  it("renders member and subgroup chips for the current value", () => {
    seedUsers([makeUser({ user_id: 1, full_name: "Alice Smith" })]);
    seedGroups([makeGroup({ id: 7, name: "ops" })]);
    const value: GroupSettingValue = {
      direct_members: [1],
      direct_subgroups: [7],
    };
    render(<GroupSettingPicker value={value} onChange={() => {}} />);

    const members = screen.getByRole("list", { name: "Выбранные пользователи" });
    expect(within(members).getByText("Alice Smith")).toBeInTheDocument();
    const subgroups = screen.getByRole("list", { name: "Выбранные подгруппы" });
    expect(within(subgroups).getByText("ops")).toBeInTheDocument();
  });

  it("emits an updated direct_members when a member is added", () => {
    seedUsers([makeUser({ user_id: 7, full_name: "Bob Jones" })]);
    const onChange = vi.fn();
    render(
      <GroupSettingPicker
        value={{ direct_members: [], direct_subgroups: [] }}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByLabelText("Добавить участника"), {
      target: { value: "bob" },
    });
    fireEvent.click(screen.getByText("Bob Jones"));
    expect(onChange).toHaveBeenCalledWith({
      direct_members: [7],
      direct_subgroups: [],
    });
  });

  it("removes a member chip and emits the filtered value", () => {
    seedUsers([makeUser({ user_id: 1, full_name: "Alice Smith" })]);
    const onChange = vi.fn();
    render(
      <GroupSettingPicker
        value={{ direct_members: [1], direct_subgroups: [] }}
        onChange={onChange}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Убрать Alice Smith" }),
    );
    expect(onChange).toHaveBeenCalledWith({
      direct_members: [],
      direct_subgroups: [],
    });
  });

  it("renders '(удалена)' for a subgroup id missing from the directory", () => {
    // No group with id=99 seeded.
    render(
      <GroupSettingPicker
        value={{ direct_members: [], direct_subgroups: [99] }}
        onChange={() => {}}
      />,
    );
    const subgroups = screen.getByRole("list", { name: "Выбранные подгруппы" });
    expect(within(subgroups).getByText("(удалена)")).toBeInTheDocument();
  });

  it("shows 'Никто' when both member and subgroup lists are empty", () => {
    render(
      <GroupSettingPicker
        value={{ direct_members: [], direct_subgroups: [] }}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText("Никто")).toBeInTheDocument();
  });
});

describe("GroupSettingPicker — disabled state", () => {
  it("disables the named-mode Select", () => {
    seedGroups([
      makeGroup({ id: 1, name: "role:everyone", is_system_group: true }),
    ]);
    render(
      <GroupSettingPicker value={1} onChange={() => {}} disabled />,
    );
    expect(screen.getByLabelText("Выбрать группу")).toBeDisabled();
  });

  it("disables remove buttons in custom mode", () => {
    seedUsers([makeUser({ user_id: 1, full_name: "Alice Smith" })]);
    render(
      <GroupSettingPicker
        value={{ direct_members: [1], direct_subgroups: [] }}
        onChange={() => {}}
        disabled
      />,
    );
    expect(
      screen.getByRole("button", { name: "Убрать Alice Smith" }),
    ).toBeDisabled();
  });
});
