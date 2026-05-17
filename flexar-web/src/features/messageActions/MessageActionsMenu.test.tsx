// Tests for `MessageActionsMenu` (Phase 3.3).
//
// The menu's job is gating items on ownership and wiring each
// affordance to the right write path: star/unstar + mark-unread go
// through `apiClient.updateMessageFlags` with the optimistic flag
// reducer; copy-link goes through `navigator.clipboard.writeText`;
// edit/delete bubble intent up to the parent. The realtime layer is
// mocked to an inert fake so the stores' module-load `wireStore` binds
// to it without a real connection.

import { describe, it, expect, vi, beforeEach } from "vitest";
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

const { updateMessageFlagsMock, getRawContentMock } = vi.hoisted(() => ({
  updateMessageFlagsMock: vi.fn(),
  getRawContentMock: vi.fn(),
}));
vi.mock("../../api", async () => {
  const actual =
    await vi.importActual<typeof import("../../api")>("../../api");
  return {
    ...actual,
    apiClient: {
      updateMessageFlags: updateMessageFlagsMock,
      getRawContent: getRawContentMock,
    },
  };
});

import type { Message } from "../../domain";
import { useAuthStore } from "../../stores/authStore";
import { useMessagesStore } from "../../stores/messagesStore";
import { useRealmStore } from "../../stores/realmStore";
import { emptyMessagesSnapshot } from "../../stores/messagesReducer";
import { MessageActionsMenu } from "./MessageActionsMenu";

const VIEWER_ID = 7;
const REALM_URL = "https://chat.example.com";

// Helper: the menu now uses `useNarrowNavigation` (for quote-and-
// reply), which requires a Router context.
function renderMenu(ui: React.ReactElement): ReturnType<typeof render> {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 100,
    type: "stream",
    content: "<p>hi</p>",
    content_type: "text/html",
    subject: "weather",
    topic_links: [],
    stream_id: 5,
    display_recipient: "general",
    recipient_id: 1,
    sender_id: VIEWER_ID,
    sender_email: "v@x",
    sender_full_name: "Viewer",
    sender_realm_str: "x",
    avatar_url: null,
    timestamp: 0,
    client: "test",
    is_me_message: false,
    reactions: [],
    submessages: [],
    ...overrides,
  };
}

function seed(message: Message, flags: string[] = []): void {
  useMessagesStore.setState({
    messages: { [message.id]: message },
    flags: flags.length > 0 ? { [message.id]: flags } : {},
  });
}

beforeEach(() => {
  updateMessageFlagsMock.mockReset();
  useAuthStore.setState({
    session: { email: "v@x", apiKey: "k", userId: VIEWER_ID },
    status: "authenticated",
    isLoggingIn: false,
    error: null,
  });
  useRealmStore.setState({
    realm: { realm_url: REALM_URL, realm_name: "Example" },
  });
  useMessagesStore.setState(emptyMessagesSnapshot());
});

describe("MessageActionsMenu — ownership gating", () => {
  it("shows Edit + Delete on the viewer's own message", () => {
    const message = makeMessage();
    seed(message);
    renderMenu(
      <MessageActionsMenu
        message={message}
        viewerId={VIEWER_ID}
        onEditRequested={vi.fn()}
        onDeleteRequested={vi.fn()}
        onViewHistoryRequested={vi.fn()}
        onActionError={vi.fn()}
        onActionNotice={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Действия с сообщением" }));
    expect(
      screen.getByRole("menuitem", { name: "Редактировать" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Удалить сообщение" }),
    ).toBeInTheDocument();
  });

  it("hides Edit + Delete on someone else's message", () => {
    const message = makeMessage({ sender_id: 999 });
    seed(message);
    renderMenu(
      <MessageActionsMenu
        message={message}
        viewerId={VIEWER_ID}
        onEditRequested={vi.fn()}
        onDeleteRequested={vi.fn()}
        onViewHistoryRequested={vi.fn()}
        onActionError={vi.fn()}
        onActionNotice={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Действия с сообщением" }));
    expect(
      screen.queryByRole("menuitem", { name: "Редактировать" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: "Удалить сообщение" }),
    ).not.toBeInTheDocument();
    // Always-on items still render.
    expect(
      screen.getByRole("menuitem", { name: "Отметить" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Копировать ссылку" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Отметить непрочитанным отсюда" }),
    ).toBeInTheDocument();
  });

  it("flips the Star label to Unstar when the message is already starred", () => {
    const message = makeMessage();
    seed(message, ["starred"]);
    renderMenu(
      <MessageActionsMenu
        message={message}
        viewerId={VIEWER_ID}
        onEditRequested={vi.fn()}
        onDeleteRequested={vi.fn()}
        onViewHistoryRequested={vi.fn()}
        onActionError={vi.fn()}
        onActionNotice={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Действия с сообщением" }));
    expect(
      screen.getByRole("menuitem", { name: "Снять отметку" }),
    ).toBeInTheDocument();
  });
});

describe("MessageActionsMenu — star toggle", () => {
  it("optimistically adds the starred flag and calls updateMessageFlags(add, starred)", async () => {
    const message = makeMessage();
    seed(message);
    updateMessageFlagsMock.mockResolvedValueOnce({ messages: [message.id] });
    renderMenu(
      <MessageActionsMenu
        message={message}
        viewerId={VIEWER_ID}
        onEditRequested={vi.fn()}
        onDeleteRequested={vi.fn()}
        onViewHistoryRequested={vi.fn()}
        onActionError={vi.fn()}
        onActionNotice={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Действия с сообщением" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Отметить" }));

    await waitFor(() => {
      expect(updateMessageFlagsMock).toHaveBeenCalledWith({
        op: "add",
        flag: "starred",
        messages: [message.id],
      });
    });
    expect(useMessagesStore.getState().getFlags(message.id)).toContain(
      "starred",
    );
  });

  it("reverts the optimistic add and surfaces the error on REST failure", async () => {
    const message = makeMessage();
    seed(message);
    updateMessageFlagsMock.mockRejectedValueOnce(new Error("nope"));
    const onActionError = vi.fn();
    renderMenu(
      <MessageActionsMenu
        message={message}
        viewerId={VIEWER_ID}
        onEditRequested={vi.fn()}
        onDeleteRequested={vi.fn()}
        onViewHistoryRequested={vi.fn()}
        onActionError={onActionError}
        onActionNotice={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Действия с сообщением" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Отметить" }));

    await waitFor(() => {
      expect(onActionError).toHaveBeenCalledWith("nope");
    });
    expect(useMessagesStore.getState().getFlags(message.id)).not.toContain(
      "starred",
    );
  });

  it("removes the starred flag when the message is currently starred", async () => {
    const message = makeMessage();
    seed(message, ["starred"]);
    updateMessageFlagsMock.mockResolvedValueOnce({ messages: [message.id] });
    renderMenu(
      <MessageActionsMenu
        message={message}
        viewerId={VIEWER_ID}
        onEditRequested={vi.fn()}
        onDeleteRequested={vi.fn()}
        onViewHistoryRequested={vi.fn()}
        onActionError={vi.fn()}
        onActionNotice={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Действия с сообщением" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Снять отметку" }));

    await waitFor(() => {
      expect(updateMessageFlagsMock).toHaveBeenCalledWith({
        op: "remove",
        flag: "starred",
        messages: [message.id],
      });
    });
    expect(useMessagesStore.getState().getFlags(message.id)).not.toContain(
      "starred",
    );
  });
});

describe("MessageActionsMenu — mark unread", () => {
  it("removes the read flag and calls updateMessageFlags(remove, read)", async () => {
    const message = makeMessage();
    seed(message, ["read"]);
    updateMessageFlagsMock.mockResolvedValueOnce({ messages: [message.id] });
    renderMenu(
      <MessageActionsMenu
        message={message}
        viewerId={VIEWER_ID}
        onEditRequested={vi.fn()}
        onDeleteRequested={vi.fn()}
        onViewHistoryRequested={vi.fn()}
        onActionError={vi.fn()}
        onActionNotice={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Действия с сообщением" }));
    fireEvent.click(
      screen.getByRole("menuitem", { name: "Отметить непрочитанным отсюда" }),
    );

    await waitFor(() => {
      expect(updateMessageFlagsMock).toHaveBeenCalledWith({
        op: "remove",
        flag: "read",
        messages: [message.id],
      });
    });
    expect(useMessagesStore.getState().getFlags(message.id)).not.toContain(
      "read",
    );
  });
});

describe("MessageActionsMenu — copy link", () => {
  it("writes the canonical near-message URL to the clipboard and notices success", async () => {
    const message = makeMessage();
    seed(message);
    const writeText = vi.fn().mockResolvedValueOnce(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const onActionNotice = vi.fn();
    renderMenu(
      <MessageActionsMenu
        message={message}
        viewerId={VIEWER_ID}
        onEditRequested={vi.fn()}
        onDeleteRequested={vi.fn()}
        onViewHistoryRequested={vi.fn()}
        onActionError={vi.fn()}
        onActionNotice={onActionNotice}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Действия с сообщением" }));
    fireEvent.click(
      screen.getByRole("menuitem", { name: "Копировать ссылку" }),
    );

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(
        "https://chat.example.com/#narrow/channel/5/topic/weather/near/100",
      );
    });
    await waitFor(() => {
      expect(onActionNotice).toHaveBeenCalledWith("Ссылка скопирована");
    });
  });

  it("surfaces an error when the clipboard API is unavailable", () => {
    const message = makeMessage();
    seed(message);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
    const onActionError = vi.fn();
    renderMenu(
      <MessageActionsMenu
        message={message}
        viewerId={VIEWER_ID}
        onEditRequested={vi.fn()}
        onDeleteRequested={vi.fn()}
        onViewHistoryRequested={vi.fn()}
        onActionError={onActionError}
        onActionNotice={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Действия с сообщением" }));
    fireEvent.click(
      screen.getByRole("menuitem", { name: "Копировать ссылку" }),
    );
    expect(onActionError).toHaveBeenCalledWith(
      "Буфер обмена недоступен в этом контексте.",
    );
  });
});

describe("MessageActionsMenu — edit / delete intents", () => {
  it("calls onEditRequested when Edit message is selected", () => {
    const message = makeMessage();
    seed(message);
    const onEditRequested = vi.fn();
    renderMenu(
      <MessageActionsMenu
        message={message}
        viewerId={VIEWER_ID}
        onEditRequested={onEditRequested}
        onDeleteRequested={vi.fn()}
        onViewHistoryRequested={vi.fn()}
        onActionError={vi.fn()}
        onActionNotice={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Действия с сообщением" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Редактировать" }));
    expect(onEditRequested).toHaveBeenCalledOnce();
  });

  it("calls onDeleteRequested when Delete message is selected", () => {
    const message = makeMessage();
    seed(message);
    const onDeleteRequested = vi.fn();
    renderMenu(
      <MessageActionsMenu
        message={message}
        viewerId={VIEWER_ID}
        onEditRequested={vi.fn()}
        onDeleteRequested={onDeleteRequested}
        onViewHistoryRequested={vi.fn()}
        onActionError={vi.fn()}
        onActionNotice={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Действия с сообщением" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Удалить сообщение" }));
    expect(onDeleteRequested).toHaveBeenCalledOnce();
  });
});
