// Tests for the right sidebar feature (`src/features/rightSidebar`).
//
// The sidebar composes presentational primitives over the Phase 1.3
// server-state stores and the Phase 1.4 narrow hooks. These tests seed
// the real stores via `setState` and render the feature inside a
// `MemoryRouter` at a chosen narrow path, exercising: the loading /
// empty / populated data states, the live name filter, and the three
// narrow contexts — channel (subscribers), DM (participants), and the
// default (directory only).
//
// The realtime layer is mocked so the test controls the connection
// status (which drives the "stores not hydrated" loading state) and so
// the stores' module-load `wireStore` call binds to an inert fake.

import { render, screen, fireEvent, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
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

const { RightSidebar } = await import("./RightSidebar");
const { useUsersStore } = await import("../../stores/usersStore");
const { usePresenceStore } = await import("../../stores/presenceStore");
const { useStreamsStore } = await import("../../stores/streamsStore");
const { makeUser, makeSubscription } = await import(
  "../../stores/testFixtures"
);

function renderSidebar(initialPath = "/"): void {
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <RightSidebar />
    </MemoryRouter>,
  );
}

// Reset every store and the connection status before each test.
beforeEach(() => {
  connectionStatus = "connected";
  useUsersStore.setState({ users: {} });
  usePresenceStore.setState({ presences: {} });
  useStreamsStore.setState({ streams: {}, subscriptions: {} });
});

describe("RightSidebar — data states", () => {
  it("shows skeletons and a disabled filter while the stores have not hydrated", () => {
    connectionStatus = "connecting";
    renderSidebar();
    // No section heading is rendered during loading.
    expect(screen.queryByText("Участники организации")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Фильтр участников")).toBeDisabled();
  });

  it("shows an empty state when there are no users", () => {
    renderSidebar();
    expect(screen.getByText("Участники организации")).toBeInTheDocument();
    expect(screen.getByText("Нет участников")).toBeInTheDocument();
  });

  it("lists the organization directory once hydrated", () => {
    useUsersStore.setState({
      users: {
        2: makeUser({ user_id: 2, full_name: "Ada Lovelace" }),
        3: makeUser({ user_id: 3, full_name: "Grace Hopper" }),
      },
    });
    renderSidebar();
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("Grace Hopper")).toBeInTheDocument();
  });

  it("orders online users before offline ones", () => {
    useUsersStore.setState({
      users: {
        2: makeUser({ user_id: 2, full_name: "Quiet One" }),
        3: makeUser({ user_id: 3, full_name: "Busy One" }),
      },
    });
    // Only user 3 has a fresh active timestamp.
    usePresenceStore.setState({
      presences: { 3: { active_timestamp: Date.now() / 1000 } },
    });
    renderSidebar();
    const rows = screen.getAllByRole("listitem");
    // The online user's row sorts above the offline user's row.
    expect(within(rows[0]).getByText("Busy One")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Quiet One")).toBeInTheDocument();
  });

  it("tags bots and deactivated accounts", () => {
    useUsersStore.setState({
      users: {
        2: makeUser({ user_id: 2, full_name: "Helper", is_bot: true }),
        3: makeUser({
          user_id: 3,
          full_name: "Former Member",
          is_active: false,
        }),
      },
    });
    renderSidebar();
    expect(screen.getByText("бот")).toBeInTheDocument();
    expect(screen.getByText("деактивирован")).toBeInTheDocument();
  });

  it("shows a presence dot for each user", () => {
    useUsersStore.setState({
      users: { 2: makeUser({ user_id: 2, full_name: "Ada Lovelace" }) },
    });
    usePresenceStore.setState({
      presences: { 2: { active_timestamp: Date.now() / 1000 } },
    });
    renderSidebar();
    const row = screen.getByText("Ada Lovelace").closest("li");
    expect(row).not.toBeNull();
    expect(
      within(row as HTMLElement).getByRole("img", { name: "в сети" }),
    ).toBeInTheDocument();
  });
});

describe("RightSidebar — filter", () => {
  beforeEach(() => {
    useUsersStore.setState({
      users: {
        2: makeUser({ user_id: 2, full_name: "Ada Lovelace" }),
        3: makeUser({ user_id: 3, full_name: "Grace Hopper" }),
      },
    });
  });

  it("filters the user list live by name", () => {
    renderSidebar();
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("Grace Hopper")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Фильтр участников"), {
      target: { value: "ada" },
    });
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.queryByText("Grace Hopper")).not.toBeInTheDocument();
  });

  it("shows a no-matches empty state when the filter matches nothing", () => {
    renderSidebar();
    fireEvent.change(screen.getByLabelText("Фильтр участников"), {
      target: { value: "zzz" },
    });
    expect(screen.getByText("Ничего не найдено")).toBeInTheDocument();
  });
});

describe("RightSidebar — narrow context", () => {
  beforeEach(() => {
    useUsersStore.setState({
      users: {
        1: makeUser({ user_id: 1, full_name: "Me Myself" }),
        2: makeUser({ user_id: 2, full_name: "Ada Lovelace" }),
        3: makeUser({ user_id: 3, full_name: "Grace Hopper" }),
        4: makeUser({ user_id: 4, full_name: "Alan Turing" }),
      },
    });
  });

  it("shows only the directory for the combined feed (no context)", () => {
    renderSidebar("/");
    expect(screen.getByText("Участники организации")).toBeInTheDocument();
    expect(screen.queryByText("В этом канале")).not.toBeInTheDocument();
    expect(screen.queryByText("В этом разговоре")).not.toBeInTheDocument();
  });

  it("shows a channel's subscribers when viewing a channel narrow", () => {
    useStreamsStore.setState({
      subscriptions: {
        7: makeSubscription({
          stream_id: 7,
          name: "design",
          subscribers: [2, 4],
        }),
      },
    });
    renderSidebar("/narrow/channel/7");
    const channelSection = screen
      .getByText("В этом канале")
      .closest("section");
    expect(channelSection).not.toBeNull();
    const scoped = within(channelSection as HTMLElement);
    expect(scoped.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(scoped.getByText("Alan Turing")).toBeInTheDocument();
    expect(scoped.queryByText("Grace Hopper")).not.toBeInTheDocument();
    // The full directory still appears below the contextual section.
    expect(screen.getByText("Участники организации")).toBeInTheDocument();
  });

  it("falls back to partial_subscribers for a large channel", () => {
    useStreamsStore.setState({
      subscriptions: {
        7: makeSubscription({
          stream_id: 7,
          name: "huge",
          partial_subscribers: [3],
        }),
      },
    });
    renderSidebar("/narrow/channel/7");
    const channelSection = screen
      .getByText("В этом канале")
      .closest("section");
    expect(
      within(channelSection as HTMLElement).getByText("Grace Hopper"),
    ).toBeInTheDocument();
  });

  it("shows an empty channel section when subscriber data is absent", () => {
    // Channel 7 is not in `subscriptions` — the viewer is not
    // subscribed, so there is no subscriber list to show.
    renderSidebar("/narrow/channel/7");
    const channelSection = screen
      .getByText("В этом канале")
      .closest("section");
    expect(
      within(channelSection as HTMLElement).getByText(
        "Нет данных об участниках канала",
      ),
    ).toBeInTheDocument();
  });

  it("shows the participants when viewing a DM narrow", () => {
    renderSidebar("/narrow/dm/2,3");
    const dmSection = screen
      .getByText("В этом разговоре")
      .closest("section");
    expect(dmSection).not.toBeNull();
    const scoped = within(dmSection as HTMLElement);
    expect(scoped.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(scoped.getByText("Grace Hopper")).toBeInTheDocument();
    expect(scoped.queryByText("Alan Turing")).not.toBeInTheDocument();
  });

  it("applies the filter to the contextual section too", () => {
    useStreamsStore.setState({
      subscriptions: {
        7: makeSubscription({
          stream_id: 7,
          name: "design",
          subscribers: [2, 4],
        }),
      },
    });
    renderSidebar("/narrow/channel/7");
    fireEvent.change(screen.getByLabelText("Фильтр участников"), {
      target: { value: "ada" },
    });
    const channelSection = screen
      .getByText("В этом канале")
      .closest("section");
    const scoped = within(channelSection as HTMLElement);
    expect(scoped.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(scoped.queryByText("Alan Turing")).not.toBeInTheDocument();
  });
});
