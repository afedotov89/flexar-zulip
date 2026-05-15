// Tests for the channel detail page (Phase 5.3).
//
// Covers admin-gating (Danger zone, Access toggles), the rename-name
// path (`updateChannel`), the privacy toggle, the add/remove subscriber
// flows (`subscribe`/`unsubscribe` with `principals`), the archive
// confirm + REST + redirect, and the non-admin Subscribe/Unsubscribe
// affordance.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

vi.mock("../../../realtime", () => ({
  realtimeConnection: {
    onInitialState: () => () => {},
    subscribe: () => () => {},
    onStatusChange: () => () => {},
    getStatus: () => "connected",
  },
}));

const {
  updateChannelMock,
  archiveChannelMock,
  subscribeMock,
  unsubscribeMock,
  getChannelSubscribersMock,
} = vi.hoisted(() => ({
  updateChannelMock: vi.fn(),
  archiveChannelMock: vi.fn(),
  subscribeMock: vi.fn(),
  unsubscribeMock: vi.fn(),
  getChannelSubscribersMock: vi.fn(),
}));
vi.mock("../../../api", async () => {
  const actual =
    await vi.importActual<typeof import("../../../api")>("../../../api");
  return {
    ...actual,
    apiClient: {
      updateChannel: updateChannelMock,
      archiveChannel: archiveChannelMock,
      subscribe: subscribeMock,
      unsubscribe: unsubscribeMock,
      getChannelSubscribers: getChannelSubscribersMock,
    },
  };
});

import { ChannelDetail } from "./ChannelDetail";
import { useAuthStore } from "../../../stores/authStore";
import { useStreamsStore } from "../../../stores/streamsStore";
import { useUsersStore } from "../../../stores/usersStore";
import {
  makeStream,
  makeSubscription,
  makeUser,
} from "../../../stores/testFixtures";
import type { Stream, Subscription, User } from "../../../domain";

// Probe so a navigate() call is observable.
function LocationProbe(): React.JSX.Element {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

interface SeedOpts {
  stream: Stream;
  subscription?: Subscription;
  users?: User[];
  viewerId?: number;
  viewerIsAdmin?: boolean;
}

function seed(opts: SeedOpts): void {
  const viewerId = opts.viewerId ?? 1;
  const users: Record<number, User> = {};
  for (const user of opts.users ?? []) {
    users[user.user_id] = user;
  }
  // Make sure the viewer exists; admin flag drives `useIsAdmin`.
  if (users[viewerId] === undefined) {
    users[viewerId] = makeUser({
      user_id: viewerId,
      is_admin: opts.viewerIsAdmin ?? false,
    });
  } else {
    users[viewerId] = {
      ...users[viewerId],
      is_admin: opts.viewerIsAdmin ?? users[viewerId].is_admin,
    };
  }
  useUsersStore.setState({ users });
  useStreamsStore.setState({
    streams: { [opts.stream.stream_id]: opts.stream },
    subscriptions:
      opts.subscription !== undefined
        ? { [opts.subscription.stream_id]: opts.subscription }
        : {},
  });
  useAuthStore.setState({
    session: { email: "v@x", apiKey: "k", userId: viewerId },
    status: "authenticated",
    isLoggingIn: false,
    error: null,
  });
}

function renderAt(path: string): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/channels/:id" element={<ChannelDetail />} />
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  updateChannelMock.mockReset();
  archiveChannelMock.mockReset();
  subscribeMock.mockReset();
  unsubscribeMock.mockReset();
  getChannelSubscribersMock.mockReset();
  getChannelSubscribersMock.mockResolvedValue([]);
  useStreamsStore.setState({ streams: {}, subscriptions: {} });
  useUsersStore.setState({ users: {} });
});

describe("ChannelDetail — render", () => {
  it("renders the channel name, description and the Private badge", () => {
    seed({
      stream: makeStream({
        stream_id: 5,
        name: "marketing",
        description: "Все про маркетинг",
        invite_only: true,
      }),
      subscription: makeSubscription({
        stream_id: 5,
        name: "marketing",
        invite_only: true,
        subscribers: [1],
      }),
      viewerIsAdmin: true,
    });

    renderAt("/channels/5");

    expect(
      screen.getByRole("heading", { level: 1, name: "marketing" }),
    ).toBeInTheDocument();
    // Description shows in both the header paragraph and the editable
    // textarea — assert the paragraph copy by tag class scope.
    expect(screen.getAllByText("Все про маркетинг").length).toBeGreaterThan(0);
    expect(screen.getByText("Приватный")).toBeInTheDocument();
  });

  it("shows a 'not found' banner when the id is unknown", () => {
    seed({
      stream: makeStream({ stream_id: 5, name: "general" }),
    });

    renderAt("/channels/999");

    expect(screen.getByText("Канал не найден")).toBeInTheDocument();
  });
});

describe("ChannelDetail — rename", () => {
  it("calls apiClient.updateChannel with the trimmed new name", async () => {
    seed({
      stream: makeStream({ stream_id: 5, name: "marketing" }),
      subscription: makeSubscription({
        stream_id: 5,
        name: "marketing",
        subscribers: [1],
      }),
      viewerIsAdmin: true,
    });
    updateChannelMock.mockResolvedValueOnce(undefined);
    renderAt("/channels/5");

    fireEvent.change(screen.getByLabelText("Название"), {
      target: { value: "  marketing-2  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() => {
      expect(updateChannelMock).toHaveBeenCalledWith(5, {
        newName: "marketing-2",
      });
    });
  });
});

describe("ChannelDetail — admin access toggles", () => {
  it("toggling 'Приватный канал' calls updateChannel with isPrivate=true", async () => {
    seed({
      stream: makeStream({ stream_id: 5, name: "open", invite_only: false }),
      subscription: makeSubscription({
        stream_id: 5,
        name: "open",
        invite_only: false,
        subscribers: [1],
      }),
      viewerIsAdmin: true,
    });
    updateChannelMock.mockResolvedValueOnce(undefined);
    renderAt("/channels/5");

    fireEvent.click(screen.getByRole("switch", { name: "Приватный канал" }));

    await waitFor(() => {
      expect(updateChannelMock).toHaveBeenCalledWith(5, { isPrivate: true });
    });
  });
});

describe("ChannelDetail — subscriber management", () => {
  it("clicking a typeahead match calls subscribe with principals=[userId]", async () => {
    const carol = makeUser({ user_id: 12, full_name: "Carol Hex" });
    seed({
      stream: makeStream({ stream_id: 5, name: "open" }),
      subscription: makeSubscription({
        stream_id: 5,
        name: "open",
        subscribers: [1],
      }),
      users: [carol],
      viewerIsAdmin: true,
    });
    subscribeMock.mockResolvedValueOnce(undefined);
    renderAt("/channels/5");

    fireEvent.change(screen.getByLabelText("Добавить подписчика"), {
      target: { value: "carol" },
    });
    fireEvent.click(screen.getByText("Carol Hex"));

    await waitFor(() => {
      expect(subscribeMock).toHaveBeenCalledWith({
        subscriptions: [{ name: "open" }],
        principals: [12],
      });
    });
  });

  it("confirming the remove modal calls unsubscribe with principals", async () => {
    const dave = makeUser({ user_id: 22, full_name: "Dave Ein" });
    seed({
      stream: makeStream({ stream_id: 5, name: "open" }),
      subscription: makeSubscription({
        stream_id: 5,
        name: "open",
        subscribers: [1, 22],
      }),
      users: [dave],
      viewerIsAdmin: true,
    });
    unsubscribeMock.mockResolvedValueOnce(undefined);
    renderAt("/channels/5");

    fireEvent.click(
      screen.getByRole("button", { name: "Убрать Dave Ein из канала" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Убрать" }));

    await waitFor(() => {
      expect(unsubscribeMock).toHaveBeenCalledWith({
        subscriptions: ["open"],
        principals: [22],
      });
    });
  });
});

describe("ChannelDetail — archive", () => {
  it("opens the modal, calls archiveChannel on confirm, and navigates to /channels", async () => {
    seed({
      stream: makeStream({ stream_id: 5, name: "old" }),
      subscription: makeSubscription({
        stream_id: 5,
        name: "old",
        subscribers: [1],
      }),
      viewerIsAdmin: true,
    });
    archiveChannelMock.mockResolvedValueOnce(undefined);
    renderAt("/channels/5");

    fireEvent.click(
      screen.getByRole("button", { name: "Архивировать канал" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Архивировать" }));

    await waitFor(() => {
      expect(archiveChannelMock).toHaveBeenCalledWith(5);
    });
    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/channels");
    });
  });
});

describe("ChannelDetail — non-admin gating", () => {
  it("hides the danger zone and admin access toggles", () => {
    seed({
      stream: makeStream({ stream_id: 5, name: "open" }),
      subscription: makeSubscription({
        stream_id: 5,
        name: "open",
        subscribers: [1],
      }),
      viewerIsAdmin: false,
    });

    renderAt("/channels/5");

    expect(
      screen.queryByRole("button", { name: "Архивировать канал" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("switch", { name: "Приватный канал" }),
    ).not.toBeInTheDocument();
  });

  it("shows a Subscribe button for a non-admin viewer who isn't subscribed", async () => {
    seed({
      stream: makeStream({ stream_id: 5, name: "open" }),
      viewerIsAdmin: false,
    });
    subscribeMock.mockResolvedValueOnce(undefined);
    renderAt("/channels/5");

    fireEvent.click(screen.getByRole("button", { name: "Подписаться" }));

    await waitFor(() => {
      expect(subscribeMock).toHaveBeenCalledWith({
        subscriptions: [{ name: "open" }],
      });
    });
  });
});
