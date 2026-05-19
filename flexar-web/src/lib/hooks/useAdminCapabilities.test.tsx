// Tests for `useAdminCapabilities` — the hook the admin surfaces use
// to mirror server-side permission gates in the UI.
//
// Each case seeds the three source stores (`authStore`, `usersStore`,
// `realmStore`, `userGroupsStore`) and renders a probe component that
// returns the hook's result. The realtime layer is mocked so the
// stores don't wire up their re-hydration listeners.

import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
import { useAdminCapabilities, type AdminCapabilities } from "./useAdminCapabilities";

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

function seedRealm(realm: Realm): void {
  useRealmStore.setState({ realm });
}

function seedUserGroups(groups: UserGroup[]): void {
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

function readCapabilities(): AdminCapabilities {
  let captured: AdminCapabilities | undefined;
  function Probe(): null {
    captured = useAdminCapabilities();
    return null;
  }
  render(<Probe />);
  if (captured === undefined) {
    throw new Error("Probe never ran");
  }
  return captured;
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

describe("useAdminCapabilities", () => {
  it("returns no access when the session is unhydrated", () => {
    const caps = readCapabilities();
    expect(caps.hasAnyAdminAccess).toBe(false);
    expect(caps.isRealmAdmin).toBe(false);
    expect(caps.managedGroupIds.size).toBe(0);
  });

  it("grants every capability to a realm admin without any group setup", () => {
    seedSession(1);
    seedUsers([makeUser({ user_id: 1, is_admin: true })]);
    seedRealm({});
    const caps = readCapabilities();
    expect(caps.isRealmAdmin).toBe(true);
    expect(caps.canManageOrg).toBe(true);
    expect(caps.canInviteUsers).toBe(true);
    expect(caps.canCreateBots).toBe(true);
    expect(caps.canCreateWriteOnlyBots).toBe(true);
    expect(caps.canCreateGroups).toBe(true);
    expect(caps.canManageAllGroups).toBe(true);
    expect(caps.hasAnyAdminAccess).toBe(true);
  });

  it("grants every capability to a realm owner", () => {
    seedSession(1);
    seedUsers([makeUser({ user_id: 1, is_owner: true })]);
    seedRealm({});
    const caps = readCapabilities();
    expect(caps.isRealmAdmin).toBe(true);
    expect(caps.hasAnyAdminAccess).toBe(true);
  });

  it("withholds admin powers from a member with no group permissions", () => {
    seedSession(1);
    seedUsers([makeUser({ user_id: 1 })]);
    seedRealm({});
    const caps = readCapabilities();
    expect(caps.isRealmAdmin).toBe(false);
    expect(caps.canCreateBots).toBe(false);
    expect(caps.canCreateGroups).toBe(false);
    expect(caps.canInviteUsers).toBe(false);
    expect(caps.hasAnyAdminAccess).toBe(false);
  });

  it("grants canCreateBots via realm_can_create_bots_group membership", () => {
    seedSession(1);
    seedUsers([makeUser({ user_id: 1 })]);
    seedUserGroups([makeGroup({ id: 11, members: [1] })]);
    seedRealm({ realm_can_create_bots_group: 11 });
    const caps = readCapabilities();
    expect(caps.canCreateBots).toBe(true);
    // canCreateBots implies canCreateWriteOnlyBots (incoming-webhook
    // is a subset of generic).
    expect(caps.canCreateWriteOnlyBots).toBe(true);
    expect(caps.hasAnyAdminAccess).toBe(true);
  });

  it("grants only canCreateWriteOnlyBots for a write-only-bots member", () => {
    seedSession(1);
    seedUsers([makeUser({ user_id: 1 })]);
    seedUserGroups([makeGroup({ id: 11, members: [1] })]);
    seedRealm({ realm_can_create_write_only_bots_group: 11 });
    const caps = readCapabilities();
    expect(caps.canCreateBots).toBe(false);
    expect(caps.canCreateWriteOnlyBots).toBe(true);
    expect(caps.hasAnyAdminAccess).toBe(true);
  });

  it("grants canInviteUsers via realm_can_invite_users_group membership", () => {
    seedSession(1);
    seedUsers([makeUser({ user_id: 1 })]);
    seedUserGroups([makeGroup({ id: 11, members: [1] })]);
    seedRealm({ realm_can_invite_users_group: 11 });
    const caps = readCapabilities();
    expect(caps.canInviteUsers).toBe(true);
    expect(caps.hasAnyAdminAccess).toBe(true);
  });

  it("grants canCreateGroups via realm_can_create_groups membership", () => {
    seedSession(1);
    seedUsers([makeUser({ user_id: 1 })]);
    seedUserGroups([makeGroup({ id: 11, members: [1] })]);
    seedRealm({ realm_can_create_groups: 11 });
    const caps = readCapabilities();
    expect(caps.canCreateGroups).toBe(true);
    expect(caps.hasAnyAdminAccess).toBe(true);
  });

  it("grants canManageAllGroups via realm_can_manage_all_groups membership", () => {
    seedSession(1);
    seedUsers([makeUser({ user_id: 1 })]);
    seedUserGroups([makeGroup({ id: 11, members: [1] })]);
    seedRealm({ realm_can_manage_all_groups: 11 });
    const caps = readCapabilities();
    expect(caps.canManageAllGroups).toBe(true);
    expect(caps.hasAnyAdminAccess).toBe(true);
  });

  it("derives managedGroupIds and manageableGroupIds from per-group settings", () => {
    seedSession(1);
    seedUsers([makeUser({ user_id: 1 })]);
    seedUserGroups([
      // Group 100: user is in can_manage_group (group 11 → member 1).
      makeGroup({
        id: 100,
        can_manage_group: 11,
        can_add_members_group: 12,
        can_remove_members_group: 12,
      }),
      // Group 200: user can only add members.
      makeGroup({
        id: 200,
        can_manage_group: 12,
        can_add_members_group: 11,
        can_remove_members_group: 12,
      }),
      // Group 300: user has no powers.
      makeGroup({
        id: 300,
        can_manage_group: 12,
        can_add_members_group: 12,
        can_remove_members_group: 12,
      }),
      // Membership groups.
      makeGroup({ id: 11, members: [1] }),
      makeGroup({ id: 12, members: [] }),
    ]);
    seedRealm({});
    const caps = readCapabilities();
    expect([...caps.managedGroupIds]).toEqual([100]);
    expect([...caps.manageableGroupIds].sort((a, b) => a - b)).toEqual([
      100, 200,
    ]);
    expect(caps.hasAnyAdminAccess).toBe(true);
  });

  it("ignores deactivated groups when deriving manageable sets", () => {
    seedSession(1);
    seedUsers([makeUser({ user_id: 1 })]);
    seedUserGroups([
      makeGroup({
        id: 100,
        deactivated: true,
        can_manage_group: 11,
      }),
      makeGroup({ id: 11, members: [1] }),
    ]);
    seedRealm({});
    const caps = readCapabilities();
    expect(caps.managedGroupIds.size).toBe(0);
    expect(caps.manageableGroupIds.size).toBe(0);
    expect(caps.hasAnyAdminAccess).toBe(false);
  });
});
