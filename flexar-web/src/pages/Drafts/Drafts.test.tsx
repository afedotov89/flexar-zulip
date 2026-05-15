// Tests for the Drafts page (Phase 2.4).
//
// Covers:
//   - empty state when there are no drafts;
//   - list rows render with the resolved channel/topic and DM names;
//   - rows are ordered most-recent first;
//   - clicking a row navigates to the destination's narrow;
//   - clicking the per-row delete button removes that draft.
//
// The realtime layer is mocked (the drafts page never talks to it, but
// the stores' `wireStore` modules bind on load and would otherwise
// reach for the real connection).

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

vi.mock("../../realtime", () => ({
  realtimeConnection: {
    onInitialState: () => () => {},
    subscribe: () => () => {},
    onStatusChange: () => () => {},
    getStatus: () => "connected",
  },
}));

import { Drafts } from "./Drafts";
import { useDraftsStore } from "../../stores/draftsStore";
import { useStreamsStore } from "../../stores/streamsStore";
import { useUsersStore } from "../../stores/usersStore";

function seedChannel(): void {
  useStreamsStore.setState({
    streams: {
      7: {
        stream_id: 7,
        name: "engineering",
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
        date_created: 1_700_000_000,
        is_recently_active: true,
      },
    },
    subscriptions: {},
  });
}

function seedUsers(): void {
  useUsersStore.setState({
    users: {
      5: {
        user_id: 5,
        email: "hamlet@zulip.com",
        delivery_email: null,
        full_name: "Hamlet",
        date_joined: "2024-01-01T00:00:00Z",
        is_active: true,
        is_owner: false,
        is_admin: false,
        is_guest: false,
        is_bot: false,
        bot_type: null,
        bot_owner_id: null,
        role: 400,
        timezone: "",
        avatar_url: null,
        avatar_version: 1,
        is_imported_stub: false,
      },
      11: {
        user_id: 11,
        email: "ophelia@zulip.com",
        delivery_email: null,
        full_name: "Ophelia",
        date_joined: "2024-01-01T00:00:00Z",
        is_active: true,
        is_owner: false,
        is_admin: false,
        is_guest: false,
        is_bot: false,
        bot_type: null,
        bot_owner_id: null,
        role: 400,
        timezone: "",
        avatar_url: null,
        avatar_version: 1,
        is_imported_stub: false,
      },
    },
  });
}

beforeEach(() => {
  useDraftsStore.setState({ drafts: {} });
  seedChannel();
  seedUsers();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Tiny helper that surfaces the current pathname so tests can assert
// where a row's click navigated to.
function LocationWatcher(): React.JSX.Element {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function renderDraftsAt(initialPath = "/drafts"): void {
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/drafts"
          element={
            <>
              <Drafts />
              <LocationWatcher />
            </>
          }
        />
        <Route path="*" element={<LocationWatcher />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Drafts page — empty state", () => {
  it("shows the no-drafts hint when the store is empty", () => {
    renderDraftsAt();
    expect(screen.getByText("Черновиков пока нет")).toBeInTheDocument();
    expect(screen.queryByRole("list")).toBeNull();
  });
});

describe("Drafts page — populated", () => {
  it("renders one row per draft, most recent first", () => {
    useDraftsStore.setState({
      drafts: {
        "channel:7:deploys": {
          key: "channel:7:deploys",
          destination: { type: "channel", streamId: 7, topic: "deploys" },
          content: "older",
          updatedAt: 1_000,
        },
        "dm:5": {
          key: "dm:5",
          destination: { type: "direct", recipientIds: [5] },
          content: "newer",
          updatedAt: 2_000,
        },
      },
    });
    renderDraftsAt();

    const list = screen.getByRole("list", { name: "Черновики" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    // Recency-desc: DM (newer) first, channel (older) second.
    expect(within(items[0]).getByText("Личное сообщение для: Hamlet")).toBeInTheDocument();
    expect(within(items[1]).getByText("# engineering > deploys")).toBeInTheDocument();
  });

  it("resolves a multi-recipient DM as a comma-joined name list", () => {
    useDraftsStore.setState({
      drafts: {
        "dm:5,11": {
          key: "dm:5,11",
          destination: { type: "direct", recipientIds: [5, 11] },
          content: "group",
          updatedAt: 1,
        },
      },
    });
    renderDraftsAt();
    expect(
      screen.getByText("Личное сообщение для: Hamlet, Ophelia"),
    ).toBeInTheDocument();
  });

  it("falls back to a placeholder when a channel/user is not in the store", () => {
    useDraftsStore.setState({
      drafts: {
        "channel:99:foo": {
          key: "channel:99:foo",
          destination: { type: "channel", streamId: 99, topic: "foo" },
          content: "x",
          updatedAt: 1,
        },
        "dm:42": {
          key: "dm:42",
          destination: { type: "direct", recipientIds: [42] },
          content: "y",
          updatedAt: 2,
        },
      },
    });
    renderDraftsAt();
    expect(screen.getByText("# Channel 99 > foo")).toBeInTheDocument();
    expect(
      screen.getByText("Личное сообщение для: User 42"),
    ).toBeInTheDocument();
  });

  it("collapses whitespace and truncates the body preview", () => {
    const longLine = "x".repeat(150);
    useDraftsStore.setState({
      drafts: {
        "channel:7:deploys": {
          key: "channel:7:deploys",
          destination: { type: "channel", streamId: 7, topic: "deploys" },
          content: `line one\n  line two ${longLine}`,
          updatedAt: 1,
        },
      },
    });
    renderDraftsAt();
    // The preview is collapsed to a single line and trimmed at 100
    // characters with an ellipsis.
    const previewText = `line one line two ${"x".repeat(150)}`
      .replace(/\s+/g, " ")
      .trim();
    const truncated = `${previewText.slice(0, 99)}…`;
    expect(screen.getByText(truncated)).toBeInTheDocument();
  });

  it("navigates to the channel narrow when a channel row is clicked", () => {
    useDraftsStore.setState({
      drafts: {
        "channel:7:deploys": {
          key: "channel:7:deploys",
          destination: { type: "channel", streamId: 7, topic: "deploys" },
          content: "x",
          updatedAt: 1,
        },
      },
    });
    renderDraftsAt();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Открыть черновик для # engineering > deploys",
      }),
    );
    expect(screen.getByTestId("location").textContent).toBe(
      "/narrow/channel/7/topic/deploys",
    );
  });

  it("navigates to the DM narrow when a DM row is clicked", () => {
    useDraftsStore.setState({
      drafts: {
        "dm:5": {
          key: "dm:5",
          destination: { type: "direct", recipientIds: [5] },
          content: "y",
          updatedAt: 1,
        },
      },
    });
    renderDraftsAt();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Открыть черновик для Личное сообщение для: Hamlet",
      }),
    );
    expect(screen.getByTestId("location").textContent).toBe("/narrow/dm/5");
  });

  it("removes a draft from the list when its delete button is clicked", () => {
    useDraftsStore.setState({
      drafts: {
        "channel:7:deploys": {
          key: "channel:7:deploys",
          destination: { type: "channel", streamId: 7, topic: "deploys" },
          content: "x",
          updatedAt: 1,
        },
        "dm:5": {
          key: "dm:5",
          destination: { type: "direct", recipientIds: [5] },
          content: "y",
          updatedAt: 2,
        },
      },
    });
    renderDraftsAt();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Удалить черновик для # engineering > deploys",
      }),
    );
    expect(useDraftsStore.getState().drafts).toEqual({
      "dm:5": {
        key: "dm:5",
        destination: { type: "direct", recipientIds: [5] },
        content: "y",
        updatedAt: 2,
      },
    });
    // The remaining row is still there.
    expect(
      screen.getByText("Личное сообщение для: Hamlet"),
    ).toBeInTheDocument();
  });
});
