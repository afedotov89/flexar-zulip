// Unit tests for the user-groups CRUD client methods (Фаза A1).
//
// Each test asserts the wire-shape the method hands to `sendRequest`:
// HTTP method, path (with the group id interpolated), and params. The
// JSON-encoding of arrays and group-setting envelopes is the
// load-bearing detail — `sendRequest` itself JSON-stringifies arrays
// and objects, so the assertions look at the pre-encoded shapes the
// methods hand it.

import { beforeEach, describe, expect, it, vi } from "vitest";

const sendRequestMock = vi.fn();

vi.mock("./request", () => ({
  sendRequest: sendRequestMock,
}));

const { ApiClient } = await import("./client");

const CREDENTIALS = { email: "user@example.com", apiKey: "key" };

function makeClient(): InstanceType<typeof ApiClient> {
  return new ApiClient(CREDENTIALS);
}

beforeEach(() => {
  sendRequestMock.mockReset();
});

describe("createUserGroup", () => {
  it("posts to /user_groups/create with name, description, members, and subgroups", async () => {
    sendRequestMock.mockResolvedValueOnce({ group_id: 42 });
    const client = makeClient();

    const result = await client.createUserGroup({
      name: "designers",
      description: "Product design team",
      members: [10, 11, 12],
      subgroups: [3],
    });

    expect(result).toEqual({ group_id: 42 });
    expect(sendRequestMock).toHaveBeenCalledTimes(1);
    expect(sendRequestMock).toHaveBeenCalledWith(
      {
        method: "POST",
        path: "/user_groups/create",
        params: {
          name: "designers",
          description: "Product design team",
          members: [10, 11, 12],
          subgroups: [3],
        },
      },
      CREDENTIALS,
    );
  });
});

describe("updateUserGroup", () => {
  it("patches /user_groups/{id} with the supplied metadata fields", async () => {
    sendRequestMock.mockResolvedValueOnce(undefined);
    const client = makeClient();

    await client.updateUserGroup(7, {
      name: "renamed",
      description: "new desc",
      deactivated: false,
    });

    expect(sendRequestMock).toHaveBeenCalledWith(
      {
        method: "PATCH",
        path: "/user_groups/7",
        params: {
          name: "renamed",
          description: "new desc",
          deactivated: false,
        },
      },
      CREDENTIALS,
    );
  });
});

describe("updateUserGroupSettings", () => {
  it("wraps each defined permission as {new: ...} JSON-encoded", async () => {
    sendRequestMock.mockResolvedValueOnce(undefined);
    const client = makeClient();

    await client.updateUserGroupSettings(99, {
      canMentionGroup: 5,
      canJoinGroup: { direct_members: [1, 2], direct_subgroups: [3] },
    });

    expect(sendRequestMock).toHaveBeenCalledTimes(1);
    const [spec, creds] = sendRequestMock.mock.calls[0];
    expect(spec.method).toBe("PATCH");
    expect(spec.path).toBe("/user_groups/99");
    expect(creds).toEqual(CREDENTIALS);
    expect(spec.params.can_mention_group).toBe(JSON.stringify({ new: 5 }));
    expect(spec.params.can_join_group).toBe(
      JSON.stringify({
        new: { direct_members: [1, 2], direct_subgroups: [3] },
      }),
    );
  });

  it("omits keys whose param is undefined (does not send null)", async () => {
    sendRequestMock.mockResolvedValueOnce(undefined);
    const client = makeClient();

    await client.updateUserGroupSettings(1, { canManageGroup: 4 });

    const [spec] = sendRequestMock.mock.calls[0];
    // Only the supplied key carries a value; the others must be
    // `undefined` so `sendRequest` drops them entirely (it does not
    // emit a wire key for an `undefined` value).
    expect(spec.params.can_manage_group).toBe(JSON.stringify({ new: 4 }));
    expect(spec.params.can_add_members_group).toBeUndefined();
    expect(spec.params.can_join_group).toBeUndefined();
    expect(spec.params.can_leave_group).toBeUndefined();
    expect(spec.params.can_mention_group).toBeUndefined();
    expect(spec.params.can_remove_members_group).toBeUndefined();
  });
});

describe("deactivateUserGroup", () => {
  it("posts to /user_groups/{id}/deactivate with no body", async () => {
    sendRequestMock.mockResolvedValueOnce(undefined);
    const client = makeClient();

    await client.deactivateUserGroup(13);

    expect(sendRequestMock).toHaveBeenCalledWith(
      { method: "POST", path: "/user_groups/13/deactivate" },
      CREDENTIALS,
    );
  });
});

describe("addUserGroupMembers", () => {
  it("posts add: userIds, delete: [] to /user_groups/{id}/members", async () => {
    sendRequestMock.mockResolvedValueOnce(undefined);
    const client = makeClient();

    await client.addUserGroupMembers(5, [101, 102]);

    expect(sendRequestMock).toHaveBeenCalledWith(
      {
        method: "POST",
        path: "/user_groups/5/members",
        params: { add: [101, 102], delete: [] },
      },
      CREDENTIALS,
    );
  });
});

describe("removeUserGroupMembers", () => {
  it("posts add: [], delete: userIds to /user_groups/{id}/members", async () => {
    sendRequestMock.mockResolvedValueOnce(undefined);
    const client = makeClient();

    await client.removeUserGroupMembers(5, [101]);

    expect(sendRequestMock).toHaveBeenCalledWith(
      {
        method: "POST",
        path: "/user_groups/5/members",
        params: { add: [], delete: [101] },
      },
      CREDENTIALS,
    );
  });
});

describe("addUserGroupSubgroups", () => {
  it("posts add: subgroupIds, delete: [] to /user_groups/{id}/subgroups", async () => {
    sendRequestMock.mockResolvedValueOnce(undefined);
    const client = makeClient();

    await client.addUserGroupSubgroups(5, [201, 202]);

    expect(sendRequestMock).toHaveBeenCalledWith(
      {
        method: "POST",
        path: "/user_groups/5/subgroups",
        params: { add: [201, 202], delete: [] },
      },
      CREDENTIALS,
    );
  });
});

describe("removeUserGroupSubgroups", () => {
  it("posts add: [], delete: subgroupIds to /user_groups/{id}/subgroups", async () => {
    sendRequestMock.mockResolvedValueOnce(undefined);
    const client = makeClient();

    await client.removeUserGroupSubgroups(5, [201]);

    expect(sendRequestMock).toHaveBeenCalledWith(
      {
        method: "POST",
        path: "/user_groups/5/subgroups",
        params: { add: [], delete: [201] },
      },
      CREDENTIALS,
    );
  });
});
