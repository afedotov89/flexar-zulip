// Tests for the mark-all-read header button (Phase 3.4).
//
// The button picks the right Zulip endpoint per narrow shape and only
// renders when there is something to mark. The tests mock `apiClient`
// so they cover the wiring (which method, which args, what the
// optimistic effect looks like) without touching the network.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Narrow } from "../../domain";
import { useMessagesStore } from "../../stores/messagesStore";
import { useUnreadStore } from "../../stores/unreadStore";
import { MarkAsReadButton } from "./MarkAsReadButton";
import { ThemeProvider } from "../../theme/ThemeProvider";

const {
  markAllAsReadMock,
  markStreamAsReadMock,
  markTopicAsReadMock,
} = vi.hoisted(() => ({
  markAllAsReadMock: vi.fn(),
  markStreamAsReadMock: vi.fn(),
  markTopicAsReadMock: vi.fn(),
}));

vi.mock("../../api", async () => {
  const actual = await vi.importActual<typeof import("../../api")>("../../api");
  return {
    ...actual,
    apiClient: {
      markAllAsRead: markAllAsReadMock,
      markStreamAsRead: markStreamAsReadMock,
      markTopicAsRead: markTopicAsReadMock,
    },
  };
});

function withTheme(node: React.ReactNode): React.ReactElement {
  return <ThemeProvider>{node}</ThemeProvider>;
}

beforeEach(() => {
  markAllAsReadMock.mockReset();
  markStreamAsReadMock.mockReset();
  markTopicAsReadMock.mockReset();
  // Start each test from a clean store state.
  useUnreadStore.setState({
    unread: { channels: {}, dms: {}, mentions: {}, location: {} },
  });
  useMessagesStore.setState({ messages: {}, flags: {} });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Seed an unread channel-topic message into the buckets directly so the
// button has something to mark and the count is non-zero.
function seedChannelUnread(
  streamId: number,
  topic: string,
  messageIds: number[],
): void {
  useUnreadStore.setState((state) => {
    const ids: Record<number, true> = {};
    for (const id of messageIds) {
      ids[id] = true;
    }
    const location = { ...state.unread.location };
    for (const id of messageIds) {
      location[id] = { kind: "channel", streamId, topic };
    }
    return {
      unread: {
        channels: { [streamId]: { [topic]: ids } },
        dms: state.unread.dms,
        mentions: state.unread.mentions,
        location,
      },
    };
  });
}

describe("MarkAsReadButton", () => {
  it("hides when the narrow has no dedicated endpoint", () => {
    const narrow: Narrow = [{ operator: "dm", operand: [5, 6] }];
    render(withTheme(<MarkAsReadButton narrow={narrow} />));
    expect(
      screen.queryByRole("button", { name: /прочитать/i }),
    ).not.toBeInTheDocument();
  });

  it("hides when there is no unread in the scope", () => {
    const narrow: Narrow = [{ operator: "channel", operand: 11 }];
    render(withTheme(<MarkAsReadButton narrow={narrow} />));
    expect(
      screen.queryByRole("button", { name: /прочитать/i }),
    ).not.toBeInTheDocument();
  });

  it("calls markAllAsRead and clears every bucket on the combined feed", async () => {
    seedChannelUnread(11, "release", [101, 102]);
    markAllAsReadMock.mockResolvedValueOnce({});

    render(withTheme(<MarkAsReadButton narrow={[]} />));
    fireEvent.click(
      screen.getByRole("button", { name: "Прочитать всё" }),
    );

    expect(markAllAsReadMock).toHaveBeenCalledTimes(1);
    expect(useUnreadStore.getState().getUnreadCount()).toBe(0);
  });

  it("calls markStreamAsRead with the channel id for a channel-only narrow", async () => {
    seedChannelUnread(11, "release", [101, 102]);
    markStreamAsReadMock.mockResolvedValueOnce({});

    render(
      withTheme(
        <MarkAsReadButton
          narrow={[{ operator: "channel", operand: 11 }]}
        />,
      ),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Прочитать канал" }),
    );

    expect(markStreamAsReadMock).toHaveBeenCalledWith(11);
    expect(useUnreadStore.getState().getChannelUnread(11)).toBe(0);
  });

  it("calls markTopicAsRead with the channel id and topic for a channel+topic narrow", async () => {
    seedChannelUnread(11, "release", [101, 102]);
    markTopicAsReadMock.mockResolvedValueOnce({});

    render(
      withTheme(
        <MarkAsReadButton
          narrow={[
            { operator: "channel", operand: 11 },
            { operator: "topic", operand: "release" },
          ]}
        />,
      ),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Прочитать тему" }),
    );

    expect(markTopicAsReadMock).toHaveBeenCalledWith(11, "release");
    expect(useUnreadStore.getState().getTopicUnread(11, "release")).toBe(0);
  });

  it("hides for a negated channel narrow", () => {
    seedChannelUnread(11, "release", [101]);
    render(
      withTheme(
        <MarkAsReadButton
          narrow={[{ operator: "channel", operand: 11, negated: true }]}
        />,
      ),
    );
    expect(
      screen.queryByRole("button", { name: /прочитать/i }),
    ).not.toBeInTheDocument();
  });
});
