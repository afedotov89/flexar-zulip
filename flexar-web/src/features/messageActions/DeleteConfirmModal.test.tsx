// Tests for `DeleteConfirmModal` (Phase 3.3).
//
// The modal stays mounted across the in-flight delete; on success it
// closes (and the realtime delete event reconciles); on failure it
// restores the snapshotted message + flags and surfaces the error so
// the user can retry or cancel.

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

const { deleteMessageMock } = vi.hoisted(() => ({
  deleteMessageMock: vi.fn(),
}));
vi.mock("../../api", async () => {
  const actual =
    await vi.importActual<typeof import("../../api")>("../../api");
  return {
    ...actual,
    apiClient: {
      deleteMessage: deleteMessageMock,
    },
  };
});

import type { Message } from "../../domain";
import { useMessagesStore } from "../../stores/messagesStore";
import { emptyMessagesSnapshot } from "../../stores/messagesReducer";
import { DeleteConfirmModal } from "./DeleteConfirmModal";

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 100,
    type: "stream",
    content: "<p>doomed</p>",
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

function seed(message: Message, flags: string[] = []): void {
  useMessagesStore.setState({
    messages: { [message.id]: message },
    flags: flags.length > 0 ? { [message.id]: flags } : {},
  });
}

beforeEach(() => {
  deleteMessageMock.mockReset();
  useMessagesStore.setState(emptyMessagesSnapshot());
});

describe("DeleteConfirmModal — confirm path", () => {
  it("removes the message from the cache on confirm and closes on success", async () => {
    const message = makeMessage();
    seed(message, ["read"]);
    deleteMessageMock.mockResolvedValueOnce({});
    const onClose = vi.fn();

    render(
      <DeleteConfirmModal open={true} message={message} onClose={onClose} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Удалить" }));

    await waitFor(() => {
      expect(deleteMessageMock).toHaveBeenCalledWith(message.id);
    });
    expect(useMessagesStore.getState().getMessage(message.id)).toBeUndefined();
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledOnce();
    });
  });

  it("restores the message + flags and surfaces the error on REST failure", async () => {
    const message = makeMessage();
    seed(message, ["read"]);
    deleteMessageMock.mockRejectedValueOnce(new Error("forbidden"));
    const onClose = vi.fn();

    render(
      <DeleteConfirmModal open={true} message={message} onClose={onClose} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Удалить" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("forbidden");
    });
    // Cache is restored.
    expect(useMessagesStore.getState().getMessage(message.id)?.id).toBe(
      message.id,
    );
    expect(useMessagesStore.getState().getFlags(message.id)).toContain("read");
    // Modal stays open so the user can retry.
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("DeleteConfirmModal — dismiss paths", () => {
  it("calls onClose on Cancel without deleting", () => {
    const message = makeMessage();
    seed(message);
    const onClose = vi.fn();

    render(
      <DeleteConfirmModal open={true} message={message} onClose={onClose} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Отмена" }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(deleteMessageMock).not.toHaveBeenCalled();
  });

  it("does not render anything when open is false", () => {
    const message = makeMessage();
    seed(message);
    render(
      <DeleteConfirmModal
        open={false}
        message={message}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
