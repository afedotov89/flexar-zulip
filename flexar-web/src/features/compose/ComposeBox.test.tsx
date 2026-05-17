// Tests for the compose feature (Phase 2.1 + 2.2).
//
// Covers:
//   - pre-fill from the current narrow (channel+topic / channel-only /
//     dm / no-narrow);
//   - send via the Send button;
//   - send via Enter; Shift+Enter inserts a newline;
//   - error path keeps the draft and shows a Banner;
//   - optimistic insert into `messagesStore` and reconcile-on-success;
//   - the no-narrow placeholder hint.
//
// The realtime layer is mocked to an inert fake (the stores'
// `wireStore` binds to it on module load); the API client's
// `sendMessage` is stubbed so the suite runs offline.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    },
  });
}

beforeEach(() => {
  sendMessageMock.mockReset();
  renderMarkdownMock.mockReset();
  useMessagesStore.setState(emptyMessagesSnapshot());
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
const channelOnlyNarrow: Narrow = [{ operator: "channel", operand: 7 }];
const dmNarrow: Narrow = [{ operator: "dm", operand: [5, 9] }];

describe("ComposeBox — pre-fill from narrow", () => {
  it("pre-fills channel and topic from a channel+topic narrow", () => {
    render(<MemoryRouter><ComposeBox narrow={channelTopicNarrow} /></MemoryRouter>);
    // Channel pill-button now exposes the channel name as its
    // aria-label (`Канал #<name>`).
    expect(
      screen.getByRole("button", { name: "Канал #engineering" }),
    ).toBeInTheDocument();
    const topic = screen.getByLabelText("Тема") as HTMLInputElement;
    expect(topic.value).toBe("deploys");
  });

  it("pre-fills channel only when the narrow has no topic", () => {
    render(<MemoryRouter><ComposeBox narrow={channelOnlyNarrow} /></MemoryRouter>);
    expect(
      screen.getByRole("button", { name: "Канал #engineering" }),
    ).toBeInTheDocument();
    const topic = screen.getByLabelText("Тема") as HTMLInputElement;
    expect(topic.value).toBe("");
  });

  it("pre-fills DM recipients from a dm narrow, stripping the viewer", () => {
    render(<MemoryRouter><ComposeBox narrow={dmNarrow} /></MemoryRouter>);
    // DM recipient is now rendered as a chip with a Remove button.
    expect(
      screen.getByRole("button", { name: "Убрать Hamlet" }),
    ).toBeInTheDocument();
  });

  it("shows a hint instead of the compose form when the narrow has no recipient", () => {
    render(<MemoryRouter><ComposeBox narrow={[]} /></MemoryRouter>);
    // No disabled textarea / send button — just the hint explaining
    // how to start writing. Half the bottom of the screen used to be
    // dead chrome with a draft restored from the last channel
    // narrow; the hint occupies one row instead.
    expect(screen.queryByLabelText("Сообщение")).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Отправить/ }),
    ).toBeNull();
    expect(
      screen.getByText(/В этом виде нельзя начать сообщение/),
    ).toBeInTheDocument();
  });

  it("shows the hint when the route has no narrow", () => {
    render(<MemoryRouter><ComposeBox narrow={undefined} /></MemoryRouter>);
    expect(screen.queryByLabelText("Сообщение")).toBeNull();
    expect(
      screen.getByText(/В этом виде нельзя начать сообщение/),
    ).toBeInTheDocument();
  });
});

describe("ComposeBox — send", () => {
  it("disables Send when the body is empty", () => {
    render(<MemoryRouter><ComposeBox narrow={channelTopicNarrow} /></MemoryRouter>);
    const send = screen.getByRole("button", { name: "Отправить" }) as HTMLButtonElement;
    expect(send.disabled).toBe(true);
  });

  it("sends a channel message via the Send button", async () => {
    sendMessageMock.mockResolvedValue({ id: 99 });
    render(<MemoryRouter><ComposeBox narrow={channelTopicNarrow} /></MemoryRouter>);

    const textarea = screen.getByLabelText("Сообщение") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "hello" } });
    fireEvent.click(screen.getByRole("button", { name: "Отправить" }));

    await waitFor(() => {
      expect(sendMessageMock).toHaveBeenCalledWith({
        type: "channel",
        to: 7,
        topic: "deploys",
        content: "hello",
      });
    });
    // Body cleared, recipient/topic preserved.
    expect((screen.getByLabelText("Сообщение") as HTMLTextAreaElement).value).toBe(
      "",
    );
    expect((screen.getByLabelText("Тема") as HTMLInputElement).value).toBe(
      "deploys",
    );
  });

  it("sends on Enter and inserts a newline on Shift+Enter", async () => {
    sendMessageMock.mockResolvedValue({ id: 100 });
    render(<MemoryRouter><ComposeBox narrow={channelTopicNarrow} /></MemoryRouter>);

    const textarea = screen.getByLabelText("Сообщение") as HTMLTextAreaElement;

    // Shift+Enter: must NOT submit. We simulate by checking that a
    // shift+enter keydown does not call sendMessage; the actual newline
    // insertion is the textarea's native behaviour (which jsdom does
    // not run for synthetic events anyway).
    fireEvent.change(textarea, { target: { value: "line one" } });
    fireEvent.keyDown(textarea, {
      key: "Enter",
      shiftKey: true,
    });
    expect(sendMessageMock).not.toHaveBeenCalled();

    // Plain Enter: sends.
    fireEvent.keyDown(textarea, { key: "Enter" });
    await waitFor(() => {
      expect(sendMessageMock).toHaveBeenCalledTimes(1);
    });
    expect(sendMessageMock).toHaveBeenCalledWith({
      type: "channel",
      to: 7,
      topic: "deploys",
      content: "line one",
    });
  });

  it("sends a direct message to the resolved recipient ids", async () => {
    sendMessageMock.mockResolvedValue({ id: 101 });
    render(<MemoryRouter><ComposeBox narrow={dmNarrow} /></MemoryRouter>);

    const textarea = screen.getByLabelText("Сообщение") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "hi there" } });
    fireEvent.click(screen.getByRole("button", { name: "Отправить" }));

    await waitFor(() => {
      expect(sendMessageMock).toHaveBeenCalledWith({
        type: "direct",
        to: [5],
        content: "hi there",
      });
    });
  });
});

describe("ComposeBox — optimistic echo and reconciliation", () => {
  it("inserts an optimistic message under a negative id and reconciles to the server id", async () => {
    let resolveSend!: (value: { id: number }) => void;
    sendMessageMock.mockReturnValue(
      new Promise<{ id: number }>((resolve) => {
        resolveSend = resolve;
      }),
    );
    render(<MemoryRouter><ComposeBox narrow={channelTopicNarrow} /></MemoryRouter>);

    const textarea = screen.getByLabelText("Сообщение") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "echo me" } });
    fireEvent.click(screen.getByRole("button", { name: "Отправить" }));

    // While the request is in flight, the optimistic entry sits in
    // the store under the first negative id (-1) and the send button
    // is in its loading state.
    await waitFor(() => {
      const messages = useMessagesStore.getState().messages;
      expect(messages[-1]).toBeDefined();
      expect(messages[-1].content).toContain("echo me");
    });
    expect(useMessagesStore.getState().messages[42]).toBeUndefined();

    // Resolve the REST response: the optimistic entry must be dropped
    // and the real id installed.
    resolveSend({ id: 42 });

    await waitFor(() => {
      const messages = useMessagesStore.getState().messages;
      expect(messages[-1]).toBeUndefined();
      expect(messages[42]).toBeDefined();
    });
  });

  it("on failure removes the optimistic echo, surfaces a Banner, and keeps the draft", async () => {
    sendMessageMock.mockRejectedValue(new Error("boom"));
    render(<MemoryRouter><ComposeBox narrow={channelTopicNarrow} /></MemoryRouter>);

    const textarea = screen.getByLabelText("Сообщение") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "will fail" } });
    fireEvent.click(screen.getByRole("button", { name: "Отправить" }));

    await waitFor(() => {
      expect(screen.getByText("boom")).toBeInTheDocument();
    });

    // The optimistic entry is removed.
    expect(useMessagesStore.getState().messages[-1]).toBeUndefined();
    // The draft text remains for retry.
    expect((screen.getByLabelText("Сообщение") as HTMLTextAreaElement).value).toBe(
      "will fail",
    );
  });

  it("uses the canonical entry when the live message event arrives before the REST response", async () => {
    let resolveSend!: (value: { id: number }) => void;
    sendMessageMock.mockReturnValue(
      new Promise<{ id: number }>((resolve) => {
        resolveSend = resolve;
      }),
    );
    render(<MemoryRouter><ComposeBox narrow={channelTopicNarrow} /></MemoryRouter>);

    const textarea = screen.getByLabelText("Сообщение") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "race" } });
    fireEvent.click(screen.getByRole("button", { name: "Отправить" }));

    await waitFor(() => {
      expect(useMessagesStore.getState().messages[-1]).toBeDefined();
    });

    // Simulate the live `message` event arriving before the REST
    // response: the canonical id 42 already lives in the store with
    // its event-supplied content + flags.
    useMessagesStore.setState((state) => ({
      messages: {
        ...state.messages,
        42: {
          ...state.messages[-1],
          id: 42,
          content: "<p>canonical event copy</p>",
        },
      },
      flags: { ...state.flags, 42: ["mentioned"] },
    }));

    resolveSend({ id: 42 });
    await waitFor(() => {
      expect(useMessagesStore.getState().messages[-1]).toBeUndefined();
    });
    // The event-installed entry survives — REST does NOT clobber it.
    expect(useMessagesStore.getState().messages[42].content).toBe(
      "<p>canonical event copy</p>",
    );
    expect(useMessagesStore.getState().flags[42]).toEqual(["mentioned"]);
  });
});
