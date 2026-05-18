// Tests for the admin sub-navigation strip.
//
// Tabs are filtered by capability: an admin sees all four, a member
// with only bot-creation rights sees only Users, a member who can
// manage a group sees only Groups, and so on. The tests render the
// component inside a MemoryRouter (NavLink requires a router) and
// assert on the visible tab labels.

import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

vi.mock("../../realtime", () => ({
  realtimeConnection: {
    onInitialState: () => () => {},
    subscribe: () => () => {},
    onStatusChange: () => () => {},
    getStatus: () => "connected",
  },
}));

import type { Realm, User, UserGroup } from "../../domain";
import { RoleValues } from "../../domain";
import { useAuthStore } from "../../stores/authStore";
import { useRealmStore } from "../../stores/realmStore";
import { useUserGroupsStore } from "../../stores/userGroupsStore";
import { useUsersStore } from "../../stores/usersStore";
import { AdminNav } from "./AdminNav";

function makeUser(overrides: Partial<User> & { user_id: number }): User {
  return {
    user_id: overrides.user_id,
    delivery_email: null,
    email: `u${overrides.user_id}@example.com`,
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
    ...overrides,
  };
}

function makeGroup(overrides: Partial<UserGroup> & { id: number }): UserGroup {
  return {
    id: overrides.id,
    name: `g-${overrides.id}`,
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

function seedSession(userId: number): void {
  useAuthStore.setState({
    session: { email: "me@example.com", apiKey: "k", userId },
    status: "authenticated",
  });
}
function seedUsers(users: User[]): void {
  const directory: Record<number, User> = {};
  for (const u of users) {
    directory[u.user_id] = u;
  }
  useUsersStore.setState({ users: directory });
}
function seedGroups(groups: UserGroup[]): void {
  const directory: Record<number, UserGroup> = {};
  for (const g of groups) {
    directory[g.id] = g;
  }
  useUserGroupsStore.setState({ userGroups: directory });
}
function seedRealm(realm: Realm): void {
  useRealmStore.setState({ realm });
}

function visibleTabLabels(): string[] {
  // NavLink renders an <a>; use queryAllByRole so an empty nav
  // returns [] instead of throwing. Whitespace around the icon glyph
  // in textContent can vary; trim.
  return screen
    .queryAllByRole("link")
    .map((a) => a.textContent?.trim() ?? "");
}

beforeEach(() => {
  useAuthStore.setState({ session: null, status: "unauthenticated" });
  useUsersStore.setState({ users: {} });
  useUserGroupsStore.setState({ userGroups: {} });
  useRealmStore.setState({ realm: null });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AdminNav", () => {
  it("shows every tab for a realm admin", () => {
    seedSession(1);
    seedUsers([makeUser({ user_id: 1, is_admin: true })]);
    seedRealm({});
    render(
      <MemoryRouter>
        <AdminNav />
      </MemoryRouter>,
    );
    expect(visibleTabLabels()).toEqual([
      "Организация",
      "Пользователи",
      "Группы",
      "Приглашения",
    ]);
  });

  it("shows only Users for a member who can create bots", () => {
    seedSession(1);
    seedUsers([makeUser({ user_id: 1 })]);
    seedGroups([makeGroup({ id: 11, members: [1] })]);
    seedRealm({ realm_can_create_bots_group: 11 });
    render(
      <MemoryRouter>
        <AdminNav />
      </MemoryRouter>,
    );
    expect(visibleTabLabels()).toEqual(["Пользователи"]);
  });

  it("shows only Groups for a member who can manage one group", () => {
    seedSession(1);
    seedUsers([makeUser({ user_id: 1 })]);
    seedGroups([
      makeGroup({ id: 11, members: [1] }),
      makeGroup({ id: 100, can_manage_group: 11 }),
    ]);
    seedRealm({});
    render(
      <MemoryRouter>
        <AdminNav />
      </MemoryRouter>,
    );
    expect(visibleTabLabels()).toEqual(["Группы"]);
  });

  it("shows only Invites for a member who can invite", () => {
    seedSession(1);
    seedUsers([makeUser({ user_id: 1 })]);
    seedGroups([makeGroup({ id: 11, members: [1] })]);
    seedRealm({ realm_can_invite_users_group: 11 });
    render(
      <MemoryRouter>
        <AdminNav />
      </MemoryRouter>,
    );
    expect(visibleTabLabels()).toEqual(["Приглашения"]);
  });

  it("shows nothing for a member with no admin capabilities", () => {
    seedSession(1);
    seedUsers([makeUser({ user_id: 1 })]);
    seedRealm({});
    render(
      <MemoryRouter>
        <AdminNav />
      </MemoryRouter>,
    );
    expect(visibleTabLabels()).toEqual([]);
  });
});
