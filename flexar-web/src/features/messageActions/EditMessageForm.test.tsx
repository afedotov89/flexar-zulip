// Tests for `EditMessageForm` (Phase 3.3).
//
// The form fetches the raw Markdown source on mount, optimistically
// updates the cache on Save, and either closes (success) or reverts +
// surfaces an error (failure). Cancel discards. Realtime is mocked to
// an inert fake; `apiClient.getRawContent` and `apiClient.editMessage`
// are stubbed so the suite runs offline.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("../../realtime", () => ({
  realtimeConnection: {
    onInitialState: () => () => {},
    subscribe: () => () => {},
    onStatusChange: () => () => {},
    getStatus: () => "connected",
  },
}));

const { getRawContentMock, editMessageMock } = vi.hoisted(() => ({
  getRawContentMock: vi.fn(),
  editMessageMock: vi.fn(),
}));
vi.mock("../../api", async () => {
  const actual =
    await vi.importActual<typeof import("../../api")>("../../api");
  return {
    ...actual,
    apiClient: {
      getRawContent: getRawContentMock,
      editMessage: editMessageMock,
    },
  };
});

import type { Message } from "../../domain";
import { useMessagesStore } from "../../stores/messagesStore";
import { emptyMessagesSnapshot } from "../../stores/messagesReducer";
import { EditMessageForm } from "./EditMessageForm";

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 100,
    type: "stream",
    content: "<p>old html</p>",
    content_type: "text/html",
    subject: "t",
    topic_links: [],
    stream_id: 1,
    display_recipient: "general",
    recipient_id: 1,
    sender_id: 7,
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

function seed(message: Message): void {
  useMessagesStore.setState({
    messages: { [message.id]: message },
    flags: {},
  });
}

beforeEach(() => {
  getRawContentMock.mockReset();
  editMessageMock.mockReset();
  useMessagesStore.setState(emptyMessagesSnapshot());
});

describe("EditMessageForm — load + save success", () => {
  it("pre-fills the textarea with the fetched Markdown source", async () => {
    const message = makeMessage();
    seed(message);
    getRawContentMock.mockResolvedValueOnce("**hello** there");

    render(<EditMessageForm message={message} onClose={vi.fn()} />);

    const textarea = (await screen.findByLabelText(
      "Edit message",
    )) as HTMLTextAreaElement;
    expect(textarea.value).toBe("**hello** there");
  });

  it("optimistically edits the cache on Save and calls editMessage", async () => {
    const message = makeMessage({ content: "old html" });
    seed(message);
    getRawContentMock.mockResolvedValueOnce("old md");
    editMessageMock.mockResolvedValueOnce({});
    const onClose = vi.fn();

    render(<EditMessageForm message={message} onClose={onClose} />);

    const textarea = (await screen.findByLabelText(
      "Edit message",
    )) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "new md" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(editMessageMock).toHaveBeenCalledWith(message.id, {
        content: "new md",
      });
    });
    // Cache shows the optimistic content.
    expect(useMessagesStore.getState().getMessage(message.id)?.content).toBe(
      "new md",
    );
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledOnce();
    });
  });

  it("Ctrl+Enter triggers Save", async () => {
    const message = makeMessage();
    seed(message);
    getRawContentMock.mockResolvedValueOnce("old");
    editMessageMock.mockResolvedValueOnce({});
    const onClose = vi.fn();

    render(<EditMessageForm message={message} onClose={onClose} />);

    const textarea = (await screen.findByLabelText(
      "Edit message",
    )) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "new" } });
    fireEvent.keyDown(textarea, { key: "Enter", ctrlKey: true });

    await waitFor(() => {
      expect(editMessageMock).toHaveBeenCalledWith(message.id, {
        content: "new",
      });
    });
  });
});

describe("EditMessageForm — failure paths", () => {
  it("reverts the optimistic edit and surfaces the error on REST failure", async () => {
    const message = makeMessage({ content: "original" });
    seed(message);
    getRawContentMock.mockResolvedValueOnce("original");
    editMessageMock.mockRejectedValueOnce(new Error("oh no"));
    const onClose = vi.fn();

    render(<EditMessageForm message={message} onClose={onClose} />);

    const textarea = (await screen.findByLabelText(
      "Edit message",
    )) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "broken" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("oh no");
    });
    // Cache restored.
    expect(useMessagesStore.getState().getMessage(message.id)?.content).toBe(
      "original",
    );
    // Form stays open so the user can retry.
    expect(onClose).not.toHaveBeenCalled();
  });

  it("renders the load-failure error when getRawContent fails", async () => {
    const message = makeMessage();
    seed(message);
    getRawContentMock.mockRejectedValueOnce(new Error("network down"));

    render(<EditMessageForm message={message} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("network down");
    });
  });
});

describe("EditMessageForm — cancel", () => {
  it("closes the form on Cancel without writing through", async () => {
    const message = makeMessage();
    seed(message);
    getRawContentMock.mockResolvedValueOnce("hi");
    const onClose = vi.fn();

    render(<EditMessageForm message={message} onClose={onClose} />);

    await screen.findByLabelText("Edit message");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(editMessageMock).not.toHaveBeenCalled();
  });

  it("closes the form on Escape", async () => {
    const message = makeMessage();
    seed(message);
    getRawContentMock.mockResolvedValueOnce("hi");
    const onClose = vi.fn();

    render(<EditMessageForm message={message} onClose={onClose} />);

    const textarea = (await screen.findByLabelText(
      "Edit message",
    )) as HTMLTextAreaElement;
    fireEvent.keyDown(textarea, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("treats a no-op edit (unchanged content) as a silent close", async () => {
    const message = makeMessage({ content: "same" });
    seed(message);
    getRawContentMock.mockResolvedValueOnce("same");
    const onClose = vi.fn();

    render(<EditMessageForm message={message} onClose={onClose} />);

    await screen.findByLabelText("Edit message");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledOnce();
    });
    expect(editMessageMock).not.toHaveBeenCalled();
  });

  it("rejects an empty save with an inline error", async () => {
    const message = makeMessage({ content: "old" });
    seed(message);
    getRawContentMock.mockResolvedValueOnce("old");

    render(<EditMessageForm message={message} onClose={vi.fn()} />);

    const textarea = (await screen.findByLabelText(
      "Edit message",
    )) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Message content can't be empty.",
      );
    });
    expect(editMessageMock).not.toHaveBeenCalled();
  });
});
