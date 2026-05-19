// Tests for the left sidebar feature (`src/features/leftSidebar`).
//
// The sidebar composes presentational primitives over the Phase 1.3
// server-state stores and the Phase 1.4 narrow hooks. These tests seed
// the real stores via `setState` and render the feature inside a
// `MemoryRouter`, exercising: the loading / empty / populated data
// states, the live name filter, section and per-channel collapse,
// active-row highlighting from the URL, and that a row click navigates.
//
// The realtime layer is mocked so the test controls the connection
// status (which drives the "stores not hydrated" loading state) and so
// the stores' module-load `wireStore` call binds to an inert fake.

import { render, screen, fireEvent, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import type { ConnectionStatus } from "../../realtime";

// Controllable realtime status. `wireStore` (not mocked) binds the real
// stores to this fake; `onInitialState` / `subscribe` are inert here —
// the tests drive store state directly via `setState`.
let connectionStatus: ConnectionStatus = "connected";
vi.mock("../../realtime", () => ({
  realtimeConnection: {
    onInitialState: () => () => {},
    subscribe: () => () => {},
    onStatusChange: () => () => {},
    getStatus: () => connectionStatus,
  },
}));

// The API client is mocked so `ChannelRow`'s lazy `loadTopics` fetch
// never touches the network; tests seed `topicsStore` directly instead.
const { getTopicsMock } = vi.hoisted(() => ({
  getTopicsMock: vi.fn(() => Promise.resolve([])),
}));
vi.mock("../../api", () => ({
  apiClient: { getTopics: getTopicsMock },
}));

const { LeftSidebar } = await import("./LeftSidebar");
const { useUnreadStore } = await import("../../stores/unreadStore");
const { useStreamsStore } = await import("../../stores/streamsStore");
const { useUsersStore } = await import("../../stores/usersStore");
const { usePresenceStore } = await import("../../stores/presenceStore");
const { useAuthStore } = await import("../../stores/authStore");
const { useDmConversationsStore } = await import(
  "../../stores/dmConversationsStore"
);
const { useTopicsStore } = await import("../../stores/topicsStore");
const { emptyUnreadBuckets, applyMessageEventToUnread } = await import(
  "../../stores/unreadReducer"
);
const { makeSubscription, makeUser, makeMessage } = await import(
  "../../stores/testFixtures"
);

// A location probe so tests can assert navigation happened.
function LocationProbe(): React.JSX.Element {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function renderSidebar(initialPath = "/"): void {
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <LeftSidebar />
      <Routes>
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

// Reset every store and the connection status before each test.
beforeEach(() => {
  connectionStatus = "connected";
  getTopicsMock.mockClear();
  getTopicsMock.mockResolvedValue([]);
  useUnreadStore.setState({ unread: emptyUnreadBuckets() });
  useStreamsStore.setState({ streams: {}, subscriptions: {} });
  useUsersStore.setState({ users: {} });
  usePresenceStore.setState({ presences: {} });
  useDmConversationsStore.setState({ conversations: [] });
  useTopicsStore.setState({ topicsByChannel: {}, loadStatus: {} });
  useAuthStore.setState({
    session: { email: "me@example.com", apiKey: "k", userId: 1 },
  });
});

describe("LeftSidebar — data states", () => {
  it("shows skeletons while the stores have not hydrated", () => {
    connectionStatus = "connecting";
    renderSidebar();
    // The built-in views section is not rendered during loading.
    expect(screen.queryByText("Лента")).not.toBeInTheDocument();
    // The filter input is present but disabled.
    expect(
      screen.getByLabelText("Фильтр каналов и личных сообщений"),
    ).toBeDisabled();
  });

  it("renders the built-in views once hydrated", () => {
    renderSidebar();
    expect(screen.getByText("Лента")).toBeInTheDocument();
    expect(screen.getByText("Упоминания")).toBeInTheDocument();
    expect(screen.getByText("Черновики")).toBeInTheDocument();
  });

  it("shows empty states for channels and DMs when there is no data", () => {
    renderSidebar();
    expect(screen.getByText("Нет каналов")).toBeInTheDocument();
    expect(screen.getByText("Нет личных сообщений")).toBeInTheDocument();
  });

  it("renders subscribed channels, pinned ones first", () => {
    useStreamsStore.setState({
      subscriptions: {
        10: makeSubscription({ stream_id: 10, name: "zebra" }),
        11: makeSubscription({
          stream_id: 11,
          name: "alpha",
          pin_to_top: true,
        }),
      },
    });
    renderSidebar();
    const links = screen.getAllByRole("link");
    const channelNames = links
      .map((el) => el.textContent ?? "")
      .filter((t) => t === "alpha" || t === "zebra");
    // Pinned "alpha" sorts above unpinned "zebra".
    expect(channelNames).toEqual(["alpha", "zebra"]);
  });
});

describe("LeftSidebar — unread counts", () => {
  it("shows a channel's unread count and its topic rows with overlaid counts", () => {
    useStreamsStore.setState({
      subscriptions: { 10: makeSubscription({ stream_id: 10, name: "dev" }) },
    });
    // The full topic list for channel 10 comes from `topicsStore`.
    useTopicsStore.setState({
      topicsByChannel: { 10: [{ name: "deploys", max_id: 101 }] },
      loadStatus: { 10: "loaded" },
    });
    // Two unread messages from another user in channel 10 / "deploys".
    let buckets = applyMessageEventToUnread(
      emptyUnreadBuckets(),
      {
        id: 1,
        type: "message",
        message: makeMessage({
          id: 100,
          type: "stream",
          stream_id: 10,
          subject: "deploys",
          sender_id: 2,
        }),
        flags: [],
      },
      1,
    );
    buckets = applyMessageEventToUnread(
      buckets,
      {
        id: 2,
        type: "message",
        message: makeMessage({
          id: 101,
          type: "stream",
          stream_id: 10,
          subject: "deploys",
          sender_id: 2,
        }),
        flags: [],
      },
      1,
    );
    useUnreadStore.setState({ unread: buckets });
    renderSidebar();

    // The channel row carries the aggregate unread badge...
    expect(screen.getByText("dev")).toBeInTheDocument();
    // ...and the topic appears nested below it.
    expect(screen.getByText("deploys")).toBeInTheDocument();
    // Badge count "2" shows somewhere in the sidebar.
    expect(screen.getAllByText("2").length).toBeGreaterThan(0);
  });
});

describe("LeftSidebar — filter", () => {
  beforeEach(() => {
    useStreamsStore.setState({
      subscriptions: {
        10: makeSubscription({ stream_id: 10, name: "design" }),
        11: makeSubscription({ stream_id: 11, name: "backend" }),
      },
    });
  });

  it("filters the channel list live by name", () => {
    renderSidebar();
    expect(screen.getByText("design")).toBeInTheDocument();
    expect(screen.getByText("backend")).toBeInTheDocument();

    fireEvent.change(
      screen.getByLabelText("Фильтр каналов и личных сообщений"),
      { target: { value: "des" } },
    );
    expect(screen.getByText("design")).toBeInTheDocument();
    expect(screen.queryByText("backend")).not.toBeInTheDocument();
  });

  it("shows a no-matches empty state when the filter matches nothing", () => {
    renderSidebar();
    fireEvent.change(
      screen.getByLabelText("Фильтр каналов и личных сообщений"),
      { target: { value: "zzz" } },
    );
    expect(screen.getByText("Ничего не найдено")).toBeInTheDocument();
  });
});

describe("LeftSidebar — collapse", () => {
  it("collapses and expands a section header", () => {
    renderSidebar();
    expect(screen.getByText("Лента")).toBeInTheDocument();
    const viewsToggle = screen.getByRole("button", { name: /Виды/ });
    expect(viewsToggle).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(viewsToggle);
    expect(viewsToggle).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByText("Лента"),
    ).not.toBeInTheDocument();

    fireEvent.click(viewsToggle);
    expect(viewsToggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Лента")).toBeInTheDocument();
  });

  it("collapses a channel's topic list", () => {
    useStreamsStore.setState({
      subscriptions: { 10: makeSubscription({ stream_id: 10, name: "dev" }) },
    });
    useTopicsStore.setState({
      topicsByChannel: { 10: [{ name: "deploys", max_id: 100 }] },
      loadStatus: { 10: "loaded" },
    });
    renderSidebar();
    expect(screen.getByText("deploys")).toBeInTheDocument();

    const channelToggle = screen.getByRole("button", {
      name: /темы канала dev/,
    });
    fireEvent.click(channelToggle);
    expect(screen.queryByText("deploys")).not.toBeInTheDocument();
  });
});

describe("LeftSidebar — active highlighting and navigation", () => {
  it("marks the current view with aria-current", () => {
    renderSidebar("/narrow/is/mentioned");
    const mentionsRow = screen.getByRole("link", { name: /Упоминания/ });
    expect(mentionsRow).toHaveAttribute("aria-current", "page");
    // A different view is not current.
    const draftsRow = screen.getByRole("link", { name: /Черновики/ });
    expect(draftsRow).not.toHaveAttribute("aria-current");
  });

  it("navigates when a view row is clicked", () => {
    renderSidebar("/");
    fireEvent.click(screen.getByRole("link", { name: /Упоминания/ }));
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/narrow/is/mentioned",
    );
  });

  it("navigates to a channel narrow when a channel row is clicked", () => {
    useStreamsStore.setState({
      subscriptions: { 10: makeSubscription({ stream_id: 10, name: "dev" }) },
    });
    renderSidebar("/");
    fireEvent.click(screen.getByRole("link", { name: "dev" }));
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/narrow/channel/10",
    );
  });
});

describe("LeftSidebar — direct messages", () => {
  it("lists a DM conversation from the store and navigates to its narrow", () => {
    useUsersStore.setState({
      users: {
        2: makeUser({ user_id: 2, full_name: "Ada Lovelace" }),
      },
    });
    // The conversation list comes from `dmConversationsStore`; the
    // unread overlay comes from `unreadStore`.
    useDmConversationsStore.setState({
      conversations: [
        { conversationKey: "1,2", participantIds: [1, 2], maxMessageId: 200 },
      ],
    });
    useUnreadStore.setState({
      unread: applyMessageEventToUnread(
        emptyUnreadBuckets(),
        {
          id: 1,
          type: "message",
          message: makeMessage({
            id: 200,
            type: "private",
            subject: "",
            sender_id: 2,
            display_recipient: [
              {
                id: 1,
                email: "me@example.com",
                full_name: "Me",
                is_mirror_dummy: false,
              },
              {
                id: 2,
                email: "ada@example.com",
                full_name: "Ada Lovelace",
                is_mirror_dummy: false,
              },
            ],
          }),
          flags: [],
        },
        1,
      ),
    });
    renderSidebar("/");
    const dmRow = screen.getByRole("link", { name: /Ada Lovelace/ });
    expect(dmRow).toBeInTheDocument();
    fireEvent.click(dmRow);
    // The DM narrow uses the other participant's id.
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/narrow/dm/2",
    );
  });

  it("lists a read DM conversation (no unreads) from the store", () => {
    useUsersStore.setState({
      users: { 3: makeUser({ user_id: 3, full_name: "Grace Hopper" }) },
    });
    // No unread buckets — the conversation still appears, badge-less.
    useDmConversationsStore.setState({
      conversations: [
        { conversationKey: "1,3", participantIds: [1, 3], maxMessageId: 5 },
      ],
    });
    renderSidebar("/");
    expect(
      screen.getByRole("link", { name: /Grace Hopper/ }),
    ).toBeInTheDocument();
  });

  it("shows a presence dot for a one-on-one DM", () => {
    useUsersStore.setState({
      users: { 2: makeUser({ user_id: 2, full_name: "Ada Lovelace" }) },
    });
    usePresenceStore.setState({
      presences: { 2: { active_timestamp: Date.now() / 1000 } },
    });
    useDmConversationsStore.setState({
      conversations: [
        { conversationKey: "1,2", participantIds: [1, 2], maxMessageId: 200 },
      ],
    });
    renderSidebar("/");
    const dmRow = screen.getByRole("link", { name: /Ada Lovelace/ });
    expect(
      within(dmRow).getByRole("img", { name: "в сети" }),
    ).toBeInTheDocument();
  });
});

describe("LeftSidebar — channel actions menu", () => {
  // The channels header carries a `⋮` trigger (a `+` would imply
  // "create directly" but the affordance is a menu). Opening it must
  // surface both entry points — direct create and browse-all — so the
  // user reaches a modal in one pick rather than landing on the
  // /channels list with another button to click.
  it("opens a menu with Create / Browse entries", () => {
    renderSidebar();
    const trigger = screen.getByRole("button", {
      name: "Действия с каналами",
    });
    expect(trigger).toBeEnabled();
    fireEvent.click(trigger);
    expect(
      screen.getByRole("menuitem", { name: "Создать канал" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Все каналы" }),
    ).toBeInTheDocument();
  });
});
