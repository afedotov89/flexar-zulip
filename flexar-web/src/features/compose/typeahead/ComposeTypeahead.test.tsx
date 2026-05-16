// Integration tests for the compose typeahead (Phase 2.3).
//
// Verifies the wire-through from ComposeBox → trigger detect → source
// rows → keyboard/mouse → splice. The pure layers have their own
// dedicated tests; here we make sure the React layer stitches them
// together in a way that survives a real keystroke.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("../../../realtime", () => ({
  realtimeConnection: {
    onInitialState: () => () => {},
    subscribe: () => () => {},
    onStatusChange: () => () => {},
    getStatus: () => "connected",
  },
}));

const { sendMessageMock, renderMarkdownMock, getTopicsMock, sendTypingMock } =
  vi.hoisted(() => ({
    sendMessageMock: vi.fn(),
    renderMarkdownMock: vi.fn(),
    getTopicsMock: vi.fn(),
    sendTypingMock: vi.fn(() => Promise.resolve()),
  }));
vi.mock("../../../api", async () => {
  const actual =
    await vi.importActual<typeof import("../../../api")>("../../../api");
  return {
    ...actual,
    apiClient: {
      sendMessage: sendMessageMock,
      renderMarkdown: renderMarkdownMock,
      getTopics: getTopicsMock,
      sendTyping: sendTypingMock,
    },
  };
});

import type { Narrow } from "../../../domain";
import { ComposeBox } from "../ComposeBox";
import { useAuthStore } from "../../../stores/authStore";
import { useMessagesStore } from "../../../stores/messagesStore";
import { useStreamsStore } from "../../../stores/streamsStore";
import { useTopicsStore } from "../../../stores/topicsStore";
import { useUsersStore } from "../../../stores/usersStore";
import { emptyMessagesSnapshot } from "../../../stores/messagesReducer";

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
      8: {
        stream_id: 8,
        name: "english-lit",
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
      6: {
        user_id: 6,
        email: "horatio@zulip.com",
        delivery_email: null,
        full_name: "Horatio",
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
  getTopicsMock.mockReset();
  useMessagesStore.setState(emptyMessagesSnapshot());
  useTopicsStore.setState({ topicsByChannel: {}, loadStatus: {} });
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

// Drive a controlled textarea: set its value and selectionStart, then
// fire `change` so React picks it up. We must set `selectionStart`
// AFTER `fireEvent.change` because setting `.value` resets the
// selection to the end of the field — and we want both controlled
// state (`form.content`) and the cursor (`cursor`) to reflect what the
// user just typed before any subsequent `input` event runs.
function typeIntoTextarea(textarea: HTMLTextAreaElement, value: string): void {
  fireEvent.change(textarea, { target: { value } });
  textarea.selectionStart = value.length;
  textarea.selectionEnd = value.length;
  // A `select` event re-reads selectionStart in our handler.
  fireEvent.select(textarea);
}

function typeIntoInput(input: HTMLInputElement, value: string): void {
  fireEvent.change(input, { target: { value } });
  input.selectionStart = value.length;
  input.selectionEnd = value.length;
}

describe("ComposeBox typeahead — `@` mentions", () => {
  it("opens the mention listbox on typing `@`", () => {
    render(<MemoryRouter><ComposeBox narrow={channelTopicNarrow} /></MemoryRouter>);
    const textarea = screen.getByLabelText("Сообщение") as HTMLTextAreaElement;
    typeIntoTextarea(textarea, "@");
    const listbox = screen.getByRole("listbox", { name: "Подсказки упоминаний" });
    expect(listbox).toBeInTheDocument();
    expect(textarea.getAttribute("aria-controls")).toBe(listbox.id);
    expect(textarea.getAttribute("aria-expanded")).toBe("true");
    // All three users are listed (alphabetical for empty query).
    expect(screen.getByText("Hamlet")).toBeInTheDocument();
    expect(screen.getByText("Horatio")).toBeInTheDocument();
    expect(screen.getByText("Iago")).toBeInTheDocument();
  });

  it("filters as the user keeps typing", () => {
    render(<MemoryRouter><ComposeBox narrow={channelTopicNarrow} /></MemoryRouter>);
    const textarea = screen.getByLabelText("Сообщение") as HTMLTextAreaElement;
    typeIntoTextarea(textarea, "@ham");
    expect(screen.getByText("Hamlet")).toBeInTheDocument();
    expect(screen.queryByText("Iago")).toBeNull();
  });

  it("does not open in the middle of an email address", () => {
    render(<MemoryRouter><ComposeBox narrow={channelTopicNarrow} /></MemoryRouter>);
    const textarea = screen.getByLabelText("Сообщение") as HTMLTextAreaElement;
    typeIntoTextarea(textarea, "alice@host");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("inserts the mention syntax on Enter", () => {
    render(<MemoryRouter><ComposeBox narrow={channelTopicNarrow} /></MemoryRouter>);
    const textarea = screen.getByLabelText("Сообщение") as HTMLTextAreaElement;
    typeIntoTextarea(textarea, "@ham");
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(textarea.value).toBe("@**Hamlet** ");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("navigates with ArrowDown / ArrowUp and selects with Enter", () => {
    render(<MemoryRouter><ComposeBox narrow={channelTopicNarrow} /></MemoryRouter>);
    const textarea = screen.getByLabelText("Сообщение") as HTMLTextAreaElement;
    typeIntoTextarea(textarea, "@");
    // Initial active row is the first (Hamlet, alphabetical).
    expect(textarea.getAttribute("aria-activedescendant")).toBe(
      "typeahead-mention-5",
    );
    fireEvent.keyDown(textarea, { key: "ArrowDown" });
    expect(textarea.getAttribute("aria-activedescendant")).toBe(
      "typeahead-mention-6",
    );
    fireEvent.keyDown(textarea, { key: "ArrowDown" });
    expect(textarea.getAttribute("aria-activedescendant")).toBe(
      "typeahead-mention-9",
    );
    fireEvent.keyDown(textarea, { key: "ArrowUp" });
    expect(textarea.getAttribute("aria-activedescendant")).toBe(
      "typeahead-mention-6",
    );
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(textarea.value).toBe("@**Horatio** ");
  });

  it("dismisses on Escape and does not re-open on the same token", () => {
    render(<MemoryRouter><ComposeBox narrow={channelTopicNarrow} /></MemoryRouter>);
    const textarea = screen.getByLabelText("Сообщение") as HTMLTextAreaElement;
    typeIntoTextarea(textarea, "@ham");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    fireEvent.keyDown(textarea, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    // Typing more of the same token does not re-open it.
    typeIntoTextarea(textarea, "@haml");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("selects a row on mousedown", () => {
    render(<MemoryRouter><ComposeBox narrow={channelTopicNarrow} /></MemoryRouter>);
    const textarea = screen.getByLabelText("Сообщение") as HTMLTextAreaElement;
    typeIntoTextarea(textarea, "@ham");
    fireEvent.mouseDown(screen.getByText("Hamlet"));
    expect(textarea.value).toBe("@**Hamlet** ");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("does NOT submit on Enter while the typeahead has the keypress", () => {
    render(<MemoryRouter><ComposeBox narrow={channelTopicNarrow} /></MemoryRouter>);
    const textarea = screen.getByLabelText("Сообщение") as HTMLTextAreaElement;
    typeIntoTextarea(textarea, "@ham");
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(sendMessageMock).not.toHaveBeenCalled();
  });
});

describe("ComposeBox typeahead — `#` channels", () => {
  it("opens with the channel listbox", () => {
    render(<MemoryRouter><ComposeBox narrow={channelTopicNarrow} /></MemoryRouter>);
    const textarea = screen.getByLabelText("Сообщение") as HTMLTextAreaElement;
    typeIntoTextarea(textarea, "see #en");
    const listbox = screen.getByRole("listbox", {
      name: "Подсказки каналов",
    });
    expect(listbox).toBeInTheDocument();
    // Scope name look-ups to the listbox — "engineering" also appears
    // in the channel-selector pill at the top of the recipient row,
    // which would otherwise match `getByText` non-uniquely.
    const within = (root: HTMLElement) =>
      (text: string): HTMLElement =>
        Array.from(root.querySelectorAll("*")).find(
          (el) => el.textContent === text,
        ) as HTMLElement;
    const insideListbox = within(listbox);
    expect(insideListbox("engineering")).toBeTruthy();
    expect(insideListbox("english-lit")).toBeTruthy();
  });

  it("inserts the channel-link syntax on Enter", () => {
    render(<MemoryRouter><ComposeBox narrow={channelTopicNarrow} /></MemoryRouter>);
    const textarea = screen.getByLabelText("Сообщение") as HTMLTextAreaElement;
    typeIntoTextarea(textarea, "see #eng");
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(textarea.value).toBe("see #**engineering** ");
  });
});

describe("ComposeBox typeahead — `:` emoji", () => {
  it("opens the emoji listbox", () => {
    render(<MemoryRouter><ComposeBox narrow={channelTopicNarrow} /></MemoryRouter>);
    const textarea = screen.getByLabelText("Сообщение") as HTMLTextAreaElement;
    typeIntoTextarea(textarea, ":sm");
    expect(
      screen.getByRole("listbox", { name: "Подсказки эмодзи" }),
    ).toBeInTheDocument();
    // First match is `smile` (prefix) before `smirk`.
    expect(screen.getByText(":smile:")).toBeInTheDocument();
  });

  it("inserts the shortcode on Enter", () => {
    render(<MemoryRouter><ComposeBox narrow={channelTopicNarrow} /></MemoryRouter>);
    const textarea = screen.getByLabelText("Сообщение") as HTMLTextAreaElement;
    typeIntoTextarea(textarea, "lol :sm");
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(textarea.value).toBe("lol :smile: ");
  });

  it("does not open inside `time:00:30`", () => {
    render(<MemoryRouter><ComposeBox narrow={channelTopicNarrow} /></MemoryRouter>);
    const textarea = screen.getByLabelText("Сообщение") as HTMLTextAreaElement;
    typeIntoTextarea(textarea, "time:00:30");
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});

describe("ComposeBox typeahead — topic input", () => {
  it("triggers a lazy fetch on focus and opens with topic suggestions", () => {
    // Pre-load the topics so we don't need to wait for the async fetch.
    useTopicsStore.setState({
      topicsByChannel: {
        7: [
          { name: "deploys", max_id: 30 },
          { name: "design-review", max_id: 20 },
          { name: "design-notes", max_id: 10 },
        ],
      },
      loadStatus: { 7: "loaded" },
    });
    render(<MemoryRouter><ComposeBox narrow={channelTopicNarrow} /></MemoryRouter>);
    const topic = screen.getByLabelText("Тема") as HTMLInputElement;
    fireEvent.focus(topic);
    typeIntoInput(topic, "des");
    const listbox = screen.getByRole("listbox", {
      name: "Подсказки тем",
    });
    expect(listbox).toBeInTheDocument();
    expect(topic.getAttribute("aria-controls")).toBe(listbox.id);
    expect(screen.getByText("design-review")).toBeInTheDocument();
    expect(screen.getByText("design-notes")).toBeInTheDocument();
  });

  it("calls loadTopics(streamId) on focus", () => {
    const spy = vi.spyOn(useTopicsStore.getState(), "loadTopics");
    render(<MemoryRouter><ComposeBox narrow={channelTopicNarrow} /></MemoryRouter>);
    const topic = screen.getByLabelText("Тема") as HTMLInputElement;
    fireEvent.focus(topic);
    expect(spy).toHaveBeenCalledWith(7);
  });

  it("inserts the chosen topic on Enter", () => {
    useTopicsStore.setState({
      topicsByChannel: {
        7: [{ name: "deploys", max_id: 30 }],
      },
      loadStatus: { 7: "loaded" },
    });
    render(<MemoryRouter><ComposeBox narrow={channelTopicNarrow} /></MemoryRouter>);
    const topic = screen.getByLabelText("Тема") as HTMLInputElement;
    fireEvent.focus(topic);
    // Clear the prefilled value so an empty query lists all topics.
    typeIntoInput(topic, "");
    fireEvent.keyDown(topic, { key: "Enter" });
    expect(topic.value).toBe("deploys");
  });
});
