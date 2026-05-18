// Tests for `DangerTab` (Phase C5).
//
// Cases: system group banner, deactivated banner, usable group with no
// usages (button enabled, no banner), usable group blocked by channel,
// usable group blocked by another group as subgroup, confirm flow
// (modal opens, API called on confirm, error path keeps modal open).
// Mocks `apiClient.deactivateUserGroup` with the same hoisted pattern
// as `AdminGroupDetail.test.tsx`.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";

vi.mock("../../../realtime", () => ({
  realtimeConnection: {
    onInitialState: () => () => {},
    subscribe: () => () => {},
  },
}));

const { deactivateUserGroupMock } = vi.hoisted(() => ({
  deactivateUserGroupMock: vi.fn(),
}));
vi.mock("../../../api", async () => {
  const actual =
    await vi.importActual<typeof import("../../../api")>("../../../api");
  return {
    ...actual,
    apiClient: {
      deactivateUserGroup: deactivateUserGroupMock,
    },
  };
});

import type { Stream, UserGroup } from "../../../domain";
import { useStreamsStore } from "../../../stores/streamsStore";
import { useUserGroupsStore } from "../../../stores/userGroupsStore";
import { DangerTab } from "./DangerTab";

const FULL_CAPS = {
  canManage: true,
  canAddMembers: true,
  canRemoveMembers: true,
  canSeeDetail: true,
};

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

function makeChannel(overrides: Partial<Stream> & { stream_id: number }): Stream {
  return {
    name: `channel-${overrides.stream_id}`,
    description: "",
    rendered_description: "",
    is_archived: false,
    invite_only: false,
    is_web_public: false,
    history_public_to_subscribers: true,
    creator_id: null,
    message_retention_days: null,
    first_message_id: null,
    folder_id: null,
    stream_weekly_traffic: null,
    subscriber_count: 0,
    date_created: 0,
    is_recently_active: false,
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

function seedChannels(channels: Stream[]): void {
  const directory: Record<number, Stream> = {};
  for (const c of channels) {
    directory[c.stream_id] = c;
  }
  useStreamsStore.setState({ streams: directory });
}

beforeEach(() => {
  useUserGroupsStore.setState({ userGroups: {} });
  useStreamsStore.setState({ streams: {}, subscriptions: {} });
  deactivateUserGroupMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("DangerTab — read-only states", () => {
  it("system group: renders only the system banner", () => {
    const group = makeGroup({
      id: 1,
      name: "role:administrators",
      is_system_group: true,
    });
    render(<DangerTab group={group} caps={FULL_CAPS} />);

    expect(
      screen.getByText(/Системная группа — деактивация недоступна/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Деактивировать" }),
    ).not.toBeInTheDocument();
  });

  it("already deactivated: renders only the 'already deactivated' banner", () => {
    const group = makeGroup({ id: 1, name: "old", deactivated: true });
    render(<DangerTab group={group} caps={FULL_CAPS} />);

    expect(
      screen.getByText(/Группа уже деактивирована\. Реактивируйте/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Деактивировать" }),
    ).not.toBeInTheDocument();
  });
});

describe("DangerTab — active group", () => {
  it("renders enabled Деактивировать button with no banner when no usages", () => {
    const group = makeGroup({ id: 1, name: "ops" });
    seedGroups([group]);
    render(<DangerTab group={group} caps={FULL_CAPS} />);

    expect(
      screen.getByRole("button", { name: "Деактивировать" }),
    ).not.toBeDisabled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("blocks deactivation when a channel references the group", () => {
    const group = makeGroup({ id: 99, name: "ops" });
    seedGroups([group]);
    seedChannels([
      makeChannel({
        stream_id: 7,
        name: "general",
        can_send_message_group: 99,
      }),
    ]);
    render(<DangerTab group={group} caps={FULL_CAPS} />);

    const banner = screen.getByRole("alert");
    expect(banner).toHaveTextContent(/Деактивация недоступна/);
    expect(banner).toHaveTextContent("general");
    expect(banner).toHaveTextContent("can_send_message_group");
    expect(
      screen.getByRole("button", { name: "Деактивировать" }),
    ).toBeDisabled();
  });

  it("blocks deactivation when another group lists this one as a subgroup", () => {
    const group = makeGroup({ id: 99, name: "ops" });
    const parent = makeGroup({
      id: 5,
      name: "platform",
      direct_subgroup_ids: [99],
    });
    seedGroups([group, parent]);
    render(<DangerTab group={group} caps={FULL_CAPS} />);

    const banner = screen.getByRole("alert");
    expect(banner).toHaveTextContent(/Деактивация недоступна/);
    expect(banner).toHaveTextContent("platform");
    expect(banner).toHaveTextContent("подгруппа");
    expect(
      screen.getByRole("button", { name: "Деактивировать" }),
    ).toBeDisabled();
  });
});

describe("DangerTab — confirm flow", () => {
  it("opens the confirm modal when Деактивировать is clicked", () => {
    const group = makeGroup({ id: 1, name: "ops" });
    seedGroups([group]);
    render(<DangerTab group={group} caps={FULL_CAPS} />);

    fireEvent.click(screen.getByRole("button", { name: "Деактивировать" }));
    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByRole("heading", { name: "Деактивировать группу?" }),
    ).toBeInTheDocument();
    expect(within(dialog).getByText(/Группа «ops» будет деактивирована/))
      .toBeInTheDocument();
  });

  it("calls deactivateUserGroup on confirm", async () => {
    deactivateUserGroupMock.mockResolvedValueOnce(undefined);
    const group = makeGroup({ id: 42, name: "ops" });
    seedGroups([group]);
    render(<DangerTab group={group} caps={FULL_CAPS} />);

    fireEvent.click(screen.getByRole("button", { name: "Деактивировать" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Деактивировать" }),
    );

    await waitFor(() => {
      expect(deactivateUserGroupMock).toHaveBeenCalledWith(42);
    });
  });

  it("surfaces an error banner inside the modal when the API fails", async () => {
    deactivateUserGroupMock.mockRejectedValueOnce(new Error("Forbidden"));
    const group = makeGroup({ id: 42, name: "ops" });
    seedGroups([group]);
    render(<DangerTab group={group} caps={FULL_CAPS} />);

    fireEvent.click(screen.getByRole("button", { name: "Деактивировать" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Деактивировать" }),
    );

    await waitFor(() => {
      expect(within(dialog).getByRole("alert")).toHaveTextContent("Forbidden");
    });
    // The destructive button is back to enabled (loading=false).
    expect(
      within(dialog).getByRole("button", { name: "Деактивировать" }),
    ).not.toBeDisabled();
  });
});
