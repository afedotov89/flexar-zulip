// Tests for the compose box's drafts integration (Phase 2.4).
//
// Covers:
//   - autosave fires after the debounce settles, writing the typed
//     body to the drafts store under the conversation key;
//   - autosave is debounced — a second keystroke before the timer fires
//     collapses to a single save with the latest body;
//   - emptying the body deletes the existing draft;
//   - a successful send deletes the draft for the destination;
//   - on mount the body is restored from the saved draft for the
//     current narrow's destination;
//   - a draft for one DM does not leak into a different DM's compose;
//   - the unaddressed (empty narrow) compose state never autosaves.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("../../realtime", () => ({
  realtimeConnection: {
    onInitialState: () => () => {},
    subscribe: () => () => {},
    onStatusChange: () => () => {},
    getStatus: () => "connected",
  },
}));

const { sendMessageMock, renderMarkdownMock, sendTypingMock } = vi.hoisted(
  () => ({
    sendMessageMock: vi.fn(),
    renderMarkdownMock: vi.fn(),
    sendTypingMock: vi.fn(() => Promise.resolve()),
  }),
);
vi.mock("../../api", async () => {
  const actual =
    await vi.importActual<typeof import("../../api")>("../../api");
  return {
    ...actual,
    apiClient: {
      sendMessage: sendMessageMock,
      renderMarkdown: renderMarkdownMock,
      sendTyping: sendTypingMock,
    },
  };
});

import type { Narrow } from "../../domain";
import { ComposeBox } from "./ComposeBox";
import { useAuthStore } from "../../stores/authStore";
import { useDraftsStore } from "../../stores/draftsStore";
import { useMessagesStore } from "../../stores/messagesStore";
import { useStreamsStore } from "../../stores/streamsStore";
import { useUsersStore } from "../../stores/usersStore";
import { emptyMessagesSnapshot } from "../../stores/messagesReducer";
import { __resetLocalIdSeedForTests } from "./optimisticMessage";

function seedSession(): void {
  useAuthStore.setState({
    session: { email: "iago@zulip.com", apiKey: "k", userId: 9 },
    status: "authenticated",
    isLoggingIn: false,
    error: null,
  });
}

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
      9: {
        user_id: 9,
        email: "iago@zulip.com",
        delivery_email: null,
        full_name: "Iago",
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
  sendMessageMock.mockReset();
  renderMarkdownMock.mockReset();
  useMessagesStore.setState(emptyMessagesSnapshot());
  useDraftsStore.setState({ drafts: {} });
  __resetLocalIdSeedForTests();
  seedSession();
  seedChannel();
  seedUsers();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const channelTopicNarrow: Narrow = [
  { operator: "channel", operand: 7 },
  { operator: "topic", operand: "deploys" },
];
const dmNarrowWith5: Narrow = [{ operator: "dm", operand: [5, 9] }];
const dmNarrowWith11: Narrow = [{ operator: "dm", operand: [9, 11] }];
const channelOnlyNarrow: Narrow = [{ operator: "channel", operand: 7 }];

describe("ComposeBox — drafts autosave", () => {
  it("saves the body to the drafts store after the debounce settles", () => {
    vi.useFakeTimers();
    try {
      render(<MemoryRouter><ComposeBox narrow={channelTopicNarrow} /></MemoryRouter>);
      const textarea = screen.getByLabelText("Сообщение") as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: "in progress" } });

      // Before the debounce: nothing saved yet.
      expect(useDraftsStore.getState().drafts).toEqual({});

      act(() => {
        vi.advanceTimersByTime(500);
      });
      const draft = useDraftsStore.getState().drafts["channel:7:deploys"];
      expect(draft).toBeDefined();
      expect(draft.content).toBe("in progress");
      expect(draft.destination).toEqual({
        type: "channel",
        streamId: 7,
        topic: "deploys",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("collapses rapid keystrokes to a single save with the latest body", () => {
    vi.useFakeTimers();
    try {
      render(<MemoryRouter><ComposeBox narrow={channelTopicNarrow} /></MemoryRouter>);
      const textarea = screen.getByLabelText("Сообщение") as HTMLTextAreaElement;

      fireEvent.change(textarea, { target: { value: "abc" } });
      act(() => {
        vi.advanceTimersByTime(200);
      });
      fireEvent.change(textarea, { target: { value: "abcdef" } });
      act(() => {
        vi.advanceTimersByTime(200);
      });
      // Still nothing saved — the second change reset the timer.
      expect(useDraftsStore.getState().drafts).toEqual({});

      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(
        useDraftsStore.getState().drafts["channel:7:deploys"].content,
      ).toBe("abcdef");
    } finally {
      vi.useRealTimers();
    }
  });

  it("deletes the saved draft when the body becomes empty", () => {
    vi.useFakeTimers();
    try {
      // Seed a saved draft for this conversation up front.
      useDraftsStore.setState({
        drafts: {
          "channel:7:deploys": {
            key: "channel:7:deploys",
            destination: { type: "channel", streamId: 7, topic: "deploys" },
            content: "old body",
            updatedAt: 1,
          },
        },
      });
      render(<MemoryRouter><ComposeBox narrow={channelTopicNarrow} /></MemoryRouter>);
      const textarea = screen.getByLabelText("Сообщение") as HTMLTextAreaElement;

      // The mount restored "old body"; type to clear it.
      expect(textarea.value).toBe("old body");
      fireEvent.change(textarea, { target: { value: "" } });
      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(useDraftsStore.getState().drafts).toEqual({});
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not autosave when the narrow has no destination", () => {
    vi.useFakeTimers();
    try {
      // Search-only narrow → mode === "none". The redesigned compose
      // still renders the textarea (with a placeholder asking the
      // user to pick a destination), but typing into it does NOT
      // hit the draft store: the autosave effect early-returns when
      // there is no destination key.
      const searchNarrow: Narrow = [{ operator: "search", operand: "x" }];
      render(<MemoryRouter><ComposeBox narrow={searchNarrow} /></MemoryRouter>);
      const textarea = screen.getByLabelText(
        "Сообщение",
      ) as HTMLTextAreaElement;
      // Textarea is disabled in "none" mode, so we drive the value
      // imperatively to bypass the disabled guard.
      fireEvent.change(textarea, { target: { value: "stray text" } });
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(useDraftsStore.getState().drafts).toEqual({});
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("ComposeBox — drafts on send", () => {
  it("deletes the draft for the destination after a successful send", async () => {
    sendMessageMock.mockResolvedValue({ id: 99 });
    useDraftsStore.setState({
      drafts: {
        "channel:7:deploys": {
          key: "channel:7:deploys",
          destination: { type: "channel", streamId: 7, topic: "deploys" },
          content: "old draft",
          updatedAt: 1,
        },
      },
    });

    render(<MemoryRouter><ComposeBox narrow={channelTopicNarrow} /></MemoryRouter>);
    const textarea = screen.getByLabelText("Сообщение") as HTMLTextAreaElement;
    expect(textarea.value).toBe("old draft");
    fireEvent.click(screen.getByRole("button", { name: "Отправить" }));

    await waitFor(() => {
      expect(sendMessageMock).toHaveBeenCalledTimes(1);
    });
    expect(useDraftsStore.getState().drafts).toEqual({});
  });
});

describe("ComposeBox — drafts restoration on mount", () => {
  it("restores the body from the saved draft for the current narrow", () => {
    useDraftsStore.setState({
      drafts: {
        "channel:7:deploys": {
          key: "channel:7:deploys",
          destination: { type: "channel", streamId: 7, topic: "deploys" },
          content: "saved earlier",
          updatedAt: 1,
        },
      },
    });
    render(<MemoryRouter><ComposeBox narrow={channelTopicNarrow} /></MemoryRouter>);
    const textarea = screen.getByLabelText("Сообщение") as HTMLTextAreaElement;
    expect(textarea.value).toBe("saved earlier");
    expect(screen.getByText("Восстановлено из черновика")).toBeInTheDocument();
  });

  it("does not restore a draft saved for a different DM conversation", () => {
    // Saved for DM with user 11 — opening the DM with user 5 must not
    // pull this draft in.
    useDraftsStore.setState({
      drafts: {
        "dm:11": {
          key: "dm:11",
          destination: { type: "direct", recipientIds: [11] },
          content: "for ophelia",
          updatedAt: 1,
        },
      },
    });
    render(<MemoryRouter><ComposeBox narrow={dmNarrowWith5} /></MemoryRouter>);
    const textarea = screen.getByLabelText("Сообщение") as HTMLTextAreaElement;
    expect(textarea.value).toBe("");
    expect(screen.queryByText("Восстановлено из черновика")).toBeNull();
  });

  it("restores the matching DM draft and ignores other DMs", () => {
    useDraftsStore.setState({
      drafts: {
        "dm:5": {
          key: "dm:5",
          destination: { type: "direct", recipientIds: [5] },
          content: "for hamlet",
          updatedAt: 1,
        },
        "dm:11": {
          key: "dm:11",
          destination: { type: "direct", recipientIds: [11] },
          content: "for ophelia",
          updatedAt: 2,
        },
      },
    });
    render(<MemoryRouter><ComposeBox narrow={dmNarrowWith11} /></MemoryRouter>);
    expect(
      (screen.getByLabelText("Сообщение") as HTMLTextAreaElement).value,
    ).toBe("for ophelia");
  });

  it("clears the restored hint as soon as the user types", () => {
    useDraftsStore.setState({
      drafts: {
        "channel:7:deploys": {
          key: "channel:7:deploys",
          destination: { type: "channel", streamId: 7, topic: "deploys" },
          content: "saved",
          updatedAt: 1,
        },
      },
    });
    render(<MemoryRouter><ComposeBox narrow={channelTopicNarrow} /></MemoryRouter>);
    expect(screen.getByText("Восстановлено из черновика")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Сообщение"), {
      target: { value: "savedX" },
    });
    expect(screen.queryByText("Восстановлено из черновика")).toBeNull();
  });

  it("starts blank when a channel narrow has no saved draft", () => {
    render(<MemoryRouter><ComposeBox narrow={channelOnlyNarrow} /></MemoryRouter>);
    expect(
      (screen.getByLabelText("Сообщение") as HTMLTextAreaElement).value,
    ).toBe("");
  });
});
