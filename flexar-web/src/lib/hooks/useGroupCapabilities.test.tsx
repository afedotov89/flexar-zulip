// Tests for `useGroupCapabilities` — the per-group permission
// selector. Each case seeds the four source stores and renders a
// probe component that captures the hook's result.

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

import type { User, UserGroup } from "../../domain";
import { RoleValues } from "../../domain";
import { useAuthStore } from "../../stores/authStore";
import { useRealmStore } from "../../stores/realmStore";
import { useUserGroupsStore } from "../../stores/userGroupsStore";
import { useUsersStore } from "../../stores/usersStore";
import {
  useGroupCapabilities,
  type GroupCapabilities,
} from "./useGroupCapabilities";

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

function seedAll(args: {
  viewerId: number;
  viewerIsAdmin?: boolean;
  groups: UserGroup[];
}): void {
  useAuthStore.setState({
    session: { email: "me@example.com", apiKey: "k", userId: args.viewerId },
    status: "authenticated",
  });
  useUsersStore.setState({
    users: {
      [args.viewerId]: makeUser({
        user_id: args.viewerId,
        is_admin: args.viewerIsAdmin ?? false,
      }),
    },
  });
  const directory: Record<number, UserGroup> = {};
  for (const g of args.groups) {
    directory[g.id] = g;
  }
  useUserGroupsStore.setState({ userGroups: directory });
  useRealmStore.setState({ realm: {} });
}

function readCaps(group: UserGroup | undefined): GroupCapabilities {
  let captured: GroupCapabilities | undefined;
  function Probe(): null {
    captured = useGroupCapabilities(group);
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

describe("useGroupCapabilities", () => {
  it("returns no powers for undefined group", () => {
    const caps = readCaps(undefined);
    expect(caps.canManage).toBe(false);
    expect(caps.canSeeDetail).toBe(false);
  });

  it("admin override grants everything regardless of group settings", () => {
    const group = makeGroup({ id: 100 });
    seedAll({ viewerId: 1, viewerIsAdmin: true, groups: [group] });
    const caps = readCaps(group);
    expect(caps.canManage).toBe(true);
    expect(caps.canAddMembers).toBe(true);
    expect(caps.canRemoveMembers).toBe(true);
    expect(caps.canSeeDetail).toBe(true);
  });

  it("returns no powers for a viewer outside every setting and not a member", () => {
    const group = makeGroup({ id: 100 });
    seedAll({ viewerId: 1, groups: [group] });
    const caps = readCaps(group);
    expect(caps.canManage).toBe(false);
    expect(caps.canAddMembers).toBe(false);
    expect(caps.canRemoveMembers).toBe(false);
    expect(caps.canSeeDetail).toBe(false);
  });

  it("grants canSeeDetail for a direct member with no other powers", () => {
    const group = makeGroup({ id: 100, members: [1] });
    seedAll({ viewerId: 1, groups: [group] });
    const caps = readCaps(group);
    expect(caps.canManage).toBe(false);
    expect(caps.canSeeDetail).toBe(true);
  });

  it("grants split add-only / remove-only by per-setting membership", () => {
    seedAll({
      viewerId: 1,
      groups: [
        makeGroup({ id: 10, members: [1] }),
        makeGroup({
          id: 100,
          can_manage_group: 99,
          can_add_members_group: 10,
          can_remove_members_group: 99,
        }),
      ],
    });
    const caps = readCaps(useUserGroupsStore.getState().getUserGroup(100));
    expect(caps.canManage).toBe(false);
    expect(caps.canAddMembers).toBe(true);
    expect(caps.canRemoveMembers).toBe(false);
    expect(caps.canSeeDetail).toBe(true);
  });

  it("manage implies add and remove", () => {
    seedAll({
      viewerId: 1,
      groups: [
        makeGroup({ id: 10, members: [1] }),
        makeGroup({
          id: 100,
          can_manage_group: 10,
          can_add_members_group: 99,
          can_remove_members_group: 99,
        }),
      ],
    });
    const caps = readCaps(useUserGroupsStore.getState().getUserGroup(100));
    expect(caps.canManage).toBe(true);
    expect(caps.canAddMembers).toBe(true);
    expect(caps.canRemoveMembers).toBe(true);
  });

  it("system groups are uniformly read-only with canSeeDetail = true", () => {
    const group = makeGroup({
      id: 100,
      is_system_group: true,
      can_manage_group: 10,
    });
    seedAll({
      viewerId: 1,
      viewerIsAdmin: true,
      groups: [group, makeGroup({ id: 10, members: [1] })],
    });
    const caps = readCaps(group);
    expect(caps.canManage).toBe(false);
    expect(caps.canAddMembers).toBe(false);
    expect(caps.canRemoveMembers).toBe(false);
    expect(caps.canSeeDetail).toBe(true);
  });
});
