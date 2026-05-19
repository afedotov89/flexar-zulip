// Tests for the `/admin/*` route gate (`RequireAdminAccess`).
//
// The gate is permission-aware: it pulls capabilities from
// `useAdminCapabilities` and lets through any user holding at least
// one admin-adjacent power, redirecting everyone else to `/`. These
// tests cover the three observable verdicts (loading / allow /
// redirect) by seeding the source stores and rendering the gate
// inside a `MemoryRouter`.

import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

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
import { RequireAdminAccess } from "./RequireAdmin";

function makeUser(overrides: Partial<User> & { user_id: number }): User {
  return {
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

function renderGate(initialPath = "/admin/users"): void {
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/" element={<div data-testid="home">home</div>} />
        <Route path="/admin/*" element={<RequireAdminAccess />}>
          <Route
            path="users"
            element={<div data-testid="admin-users">users</div>}
          />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
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

describe("RequireAdminAccess", () => {
  it("renders a spinner while the user directory is still hydrating", () => {
    seedSession(1);
    seedRealm({});
    renderGate();
    expect(screen.queryByTestId("admin-users")).not.toBeInTheDocument();
    expect(screen.queryByTestId("home")).not.toBeInTheDocument();
    // The Spinner primitive renders role="status".
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("redirects a member with no admin capability to /", () => {
    seedSession(1);
    seedUsers([makeUser({ user_id: 1 })]);
    seedRealm({});
    renderGate();
    expect(screen.getByTestId("home")).toBeInTheDocument();
    expect(screen.queryByTestId("admin-users")).not.toBeInTheDocument();
  });

  it("lets a realm admin through", () => {
    seedSession(1);
    seedUsers([makeUser({ user_id: 1, is_admin: true })]);
    seedRealm({});
    renderGate();
    expect(screen.getByTestId("admin-users")).toBeInTheDocument();
  });

  it("lets a member who can create bots through", () => {
    seedSession(1);
    seedUsers([makeUser({ user_id: 1 })]);
    seedGroups([makeGroup({ id: 11, members: [1] })]);
    seedRealm({ realm_can_create_bots_group: 11 });
    renderGate();
    expect(screen.getByTestId("admin-users")).toBeInTheDocument();
  });

  it("lets a member who can manage some group through", () => {
    seedSession(1);
    seedUsers([makeUser({ user_id: 1 })]);
    seedGroups([
      makeGroup({ id: 11, members: [1] }),
      makeGroup({ id: 100, can_manage_group: 11 }),
    ]);
    seedRealm({});
    renderGate();
    expect(screen.getByTestId("admin-users")).toBeInTheDocument();
  });

  it("lets a member who can invite users through", () => {
    seedSession(1);
    seedUsers([makeUser({ user_id: 1 })]);
    seedGroups([makeGroup({ id: 11, members: [1] })]);
    seedRealm({ realm_can_invite_users_group: 11 });
    renderGate();
    expect(screen.getByTestId("admin-users")).toBeInTheDocument();
  });
});
