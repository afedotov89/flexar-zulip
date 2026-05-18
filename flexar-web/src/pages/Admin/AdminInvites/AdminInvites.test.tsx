// Tests for the admin invitations page (Phase 5.4).
//
// Covers the mount-time fetch, the empty + error states, opening the
// send-invite modal and posting through `apiClient.sendInvites`, the
// disabled submit guard for invalid emails, the revoke confirm flow
// (with optimistic removal), and the copy-link affordance.
//
// The realtime layer is mocked so `useStoresLoading()` reports
// "connected" — this page does not actually subscribe to events but
// other modules in the bundle assume the realtime singleton exists.

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
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
    onStatusChange: () => () => {},
    getStatus: () => "connected",
  },
}));

const {
  getInvitesMock,
  sendInvitesMock,
  createReusableInviteLinkMock,
  revokeInviteMock,
  resendInviteMock,
} = vi.hoisted(() => ({
  getInvitesMock: vi.fn(),
  sendInvitesMock: vi.fn(),
  createReusableInviteLinkMock: vi.fn(),
  revokeInviteMock: vi.fn(),
  resendInviteMock: vi.fn(),
}));

vi.mock("../../../api", async () => {
  const actual =
    await vi.importActual<typeof import("../../../api")>("../../../api");
  return {
    ...actual,
    apiClient: {
      getInvites: getInvitesMock,
      sendInvites: sendInvitesMock,
      createReusableInviteLink: createReusableInviteLinkMock,
      revokeInvite: revokeInviteMock,
      resendInvite: resendInviteMock,
    },
  };
});

// Default to full-admin caps so the existing tests (which exercise
// the historical full action set) stay green. Tests that want the
// member-with-invite-only view mutate this object.
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

import type { Invite } from "../../../api";
import { RoleValues } from "../../../domain";
import { useAuthStore } from "../../../stores/authStore";
import { useStreamsStore } from "../../../stores/streamsStore";
import { useUsersStore } from "../../../stores/usersStore";
import { AdminInvites } from "./AdminInvites";

function makeInvite(overrides: Partial<Invite> & { id: number }): Invite {
  const base: Invite = {
    id: overrides.id,
    invited: 1_700_000_000,
    is_multiuse: false,
    invited_as: RoleValues.Member,
    expiry_date: 1_700_086_400,
    email: `invitee${overrides.id}@example.com`,
  };
  return { ...base, ...overrides };
}

beforeEach(() => {
  getInvitesMock.mockReset();
  sendInvitesMock.mockReset();
  createReusableInviteLinkMock.mockReset();
  revokeInviteMock.mockReset();
  resendInviteMock.mockReset();
  useUsersStore.setState({ users: {} });
  useStreamsStore.setState({ streams: {}, subscriptions: {} });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AdminInvites — list rendering", () => {
  it("fetches invites on mount and renders one row per invite", async () => {
    getInvitesMock.mockResolvedValueOnce([
      makeInvite({ id: 1, email: "alice@example.com" }),
      makeInvite({
        id: 2,
        is_multiuse: true,
        email: undefined,
        link_url: "https://example.com/join/abc",
      }),
    ]);
    render(<AdminInvites />);

    await waitFor(() => {
      expect(getInvitesMock).toHaveBeenCalledTimes(1);
    });
    const list = await screen.findByRole("list", { name: "Приглашения" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(within(list).getByText("alice@example.com")).toBeInTheDocument();
    expect(within(list).getByText("Многоразовая ссылка")).toBeInTheDocument();
  });

  it("renders the empty state when no invites are returned", async () => {
    getInvitesMock.mockResolvedValueOnce([]);
    render(<AdminInvites />);

    expect(
      await screen.findByText("Активных приглашений нет."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Приглашения" })).toBeNull();
  });

  it("renders an error banner when getInvites rejects", async () => {
    getInvitesMock.mockRejectedValueOnce(new Error("boom"));
    render(<AdminInvites />);

    const banner = await screen.findByRole("alert");
    expect(banner).toHaveTextContent("boom");
  });
});

describe("AdminInvites — send flow", () => {
  it("opens SendInviteModal when 'Отправить приглашение' is clicked", async () => {
    getInvitesMock.mockResolvedValueOnce([]);
    render(<AdminInvites />);
    await screen.findByText("Активных приглашений нет.");

    fireEvent.click(
      screen.getByRole("button", { name: "Отправить приглашение" }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText("Отправить приглашение"),
    ).toBeInTheDocument();
  });

  it("calls apiClient.sendInvites with the parsed emails on submit", async () => {
    getInvitesMock.mockResolvedValue([]);
    sendInvitesMock.mockResolvedValueOnce(undefined);
    render(<AdminInvites />);
    await screen.findByText("Активных приглашений нет.");

    fireEvent.click(
      screen.getByRole("button", { name: "Отправить приглашение" }),
    );
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(
      within(dialog).getByLabelText(/Email-адреса/),
      { target: { value: "alice@example.com, bob@example.com" } },
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "Отправить" }));

    await waitFor(() => {
      expect(sendInvitesMock).toHaveBeenCalledWith({
        inviteeEmails: ["alice@example.com", "bob@example.com"],
        inviteExpiresInMinutes: 10080,
        inviteAs: RoleValues.Member,
        streamIds: undefined,
      });
    });
    // After success the parent refetches.
    expect(getInvitesMock).toHaveBeenCalledTimes(2);
  });

  it("keeps the submit button disabled until at least one valid email is entered", async () => {
    getInvitesMock.mockResolvedValue([]);
    render(<AdminInvites />);
    await screen.findByText("Активных приглашений нет.");

    fireEvent.click(
      screen.getByRole("button", { name: "Отправить приглашение" }),
    );
    const dialog = await screen.findByRole("dialog");
    const submit = within(dialog).getByRole("button", { name: "Отправить" });
    expect(submit).toBeDisabled();

    // Invalid token — still disabled.
    fireEvent.change(within(dialog).getByLabelText(/Email-адреса/), {
      target: { value: "not-an-email" },
    });
    expect(submit).toBeDisabled();

    // Valid token — enabled.
    fireEvent.change(within(dialog).getByLabelText(/Email-адреса/), {
      target: { value: "alice@example.com" },
    });
    expect(submit).not.toBeDisabled();
  });
});

describe("AdminInvites — revoke flow", () => {
  it("opens the confirm modal, optimistically removes the row, and calls revokeInvite", async () => {
    getInvitesMock.mockResolvedValueOnce([
      makeInvite({ id: 7, email: "doomed@example.com" }),
    ]);
    revokeInviteMock.mockResolvedValueOnce(undefined);
    render(<AdminInvites />);

    const list = await screen.findByRole("list", { name: "Приглашения" });
    const row = within(list).getByRole("listitem");
    fireEvent.click(
      within(row).getByRole("button", { name: "Отозвать приглашение" }),
    );

    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText(/Отозвать приглашение для doomed@example\.com/),
    ).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Отозвать" }));

    await waitFor(() => {
      expect(revokeInviteMock).toHaveBeenCalledWith(7);
    });
    // Row is gone from the list.
    await waitFor(() => {
      expect(screen.getByText("Активных приглашений нет.")).toBeInTheDocument();
    });
  });
});

describe("AdminInvites — copy link", () => {
  it("writes the link URL to the clipboard when copy is clicked", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    getInvitesMock.mockResolvedValueOnce([
      makeInvite({
        id: 5,
        is_multiuse: true,
        email: undefined,
        link_url: "https://example.com/join/xyz",
      }),
    ]);
    render(<AdminInvites />);

    const list = await screen.findByRole("list", { name: "Приглашения" });
    const row = within(list).getByRole("listitem");
    fireEvent.click(
      within(row).getByRole("button", { name: "Скопировать ссылку" }),
    );

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("https://example.com/join/xyz");
    });
  });
});

describe("AdminInvites — non-admin capability filtering", () => {
  const adminSnapshot = { ...adminCapsMock };

  beforeEach(() => {
    useAuthStore.setState({
      session: { email: "me@example.com", apiKey: "k", userId: 7 },
      status: "authenticated",
    });
  });

  afterEach(() => {
    Object.assign(adminCapsMock, adminSnapshot);
  });

  it("only allows revoking one's own invites when the viewer is not admin", async () => {
    Object.assign(adminCapsMock, {
      isRealmAdmin: false,
      canInviteUsers: true,
      hasAnyAdminAccess: true,
    });
    getInvitesMock.mockResolvedValueOnce([
      makeInvite({
        id: 1,
        email: "mine@example.com",
        invited_by_user_id: 7,
      }),
      makeInvite({
        id: 2,
        email: "other@example.com",
        invited_by_user_id: 99,
      }),
    ]);
    render(<AdminInvites />);
    const list = await screen.findByRole("list", { name: "Приглашения" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    // Mine: revoke + resend visible.
    const mine = items.find((i) =>
      within(i).queryByText("mine@example.com"),
    )!;
    expect(
      within(mine).getByRole("button", { name: "Отозвать приглашение" }),
    ).toBeInTheDocument();
    expect(
      within(mine).getByRole("button", { name: "Отправить снова" }),
    ).toBeInTheDocument();
    // Other's: revoke and resend hidden.
    const others = items.find((i) =>
      within(i).queryByText("other@example.com"),
    )!;
    expect(
      within(others).queryByRole("button", { name: "Отозвать приглашение" }),
    ).not.toBeInTheDocument();
    expect(
      within(others).queryByRole("button", { name: "Отправить снова" }),
    ).not.toBeInTheDocument();
  });
});
