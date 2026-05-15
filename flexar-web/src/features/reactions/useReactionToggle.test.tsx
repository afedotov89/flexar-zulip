// Tests for `useReactionToggle` — optimistic add/remove → REST → revert.
//
// The hook is the single seat of write-path behaviour for reactions
// (`ReactionsRow` chip clicks and `MessageRow`'s toolbar picker both
// call it). The realtime layer is mocked to an inert fake (the stores'
// `wireStore` binds to it on module load); the `apiClient` reaction
// methods are stubbed so the suite runs offline.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

vi.mock("../../realtime", () => ({
  realtimeConnection: {
    onInitialState: () => () => {},
    subscribe: () => () => {},
    onStatusChange: () => () => {},
    getStatus: () => "connected",
  },
}));

const { addReactionMock, removeReactionMock } = vi.hoisted(() => ({
  addReactionMock: vi.fn(),
  removeReactionMock: vi.fn(),
}));
vi.mock("../../api", async () => {
  const actual =
    await vi.importActual<typeof import("../../api")>("../../api");
  return {
    ...actual,
    apiClient: {
      addReaction: addReactionMock,
      removeReaction: removeReactionMock,
    },
  };
});

import type { Message } from "../../domain";
import { useAuthStore } from "../../stores/authStore";
import { useMessagesStore } from "../../stores/messagesStore";
import { emptyMessagesSnapshot } from "../../stores/messagesReducer";
import { useReactionToggle } from "./useReactionToggle";

function seedMessage(reactions: Message["reactions"] = []): void {
  const message: Message = {
    id: 100,
    type: "stream",
    content: "<p>hi</p>",
    content_type: "text/html",
    subject: "t",
    topic_links: [],
    stream_id: 1,
    display_recipient: "x",
    recipient_id: 1,
    sender_id: 1,
    sender_email: "s@x",
    sender_full_name: "Sender",
    sender_realm_str: "x",
    avatar_url: null,
    timestamp: 0,
    client: "test",
    is_me_message: false,
    reactions,
    submessages: [],
  };
  useMessagesStore.setState({ messages: { 100: message }, flags: {} });
}

beforeEach(() => {
  addReactionMock.mockReset();
  removeReactionMock.mockReset();
  useAuthStore.setState({
    session: { email: "h@x", apiKey: "k", userId: 7 },
    status: "authenticated",
    isLoggingIn: false,
    error: null,
  });
  useMessagesStore.setState(emptyMessagesSnapshot());
});

const THUMBS_UP = {
  emoji_name: "thumbs_up",
  emoji_code: "1f44d",
  reaction_type: "unicode_emoji" as const,
};

describe("useReactionToggle — add path", () => {
  it("optimistically inserts the reaction and calls apiClient.addReaction", async () => {
    seedMessage([]);
    addReactionMock.mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useReactionToggle(100));

    await act(async () => {
      await result.current.toggle(THUMBS_UP, false);
    });

    expect(addReactionMock).toHaveBeenCalledWith(100, {
      emojiName: "thumbs_up",
      emojiCode: "1f44d",
      reactionType: "unicode_emoji",
    });
    const message = useMessagesStore.getState().getMessage(100);
    expect(message?.reactions).toEqual([
      {
        user_id: 7,
        emoji_name: "thumbs_up",
        emoji_code: "1f44d",
        reaction_type: "unicode_emoji",
      },
    ]);
    expect(result.current.errorMessage).toBeNull();
  });

  it("reverts the optimistic insert and surfaces the error on REST failure", async () => {
    seedMessage([]);
    addReactionMock.mockRejectedValueOnce(new Error("boom"));
    const { result } = renderHook(() => useReactionToggle(100));

    await act(async () => {
      await result.current.toggle(THUMBS_UP, false);
    });

    const message = useMessagesStore.getState().getMessage(100);
    // Insert was reverted → reactions array is back to empty.
    expect(message?.reactions).toEqual([]);
    await waitFor(() => {
      expect(result.current.errorMessage).toBe("boom");
    });
  });
});

describe("useReactionToggle — remove path", () => {
  it("optimistically removes the reaction and calls apiClient.removeReaction", async () => {
    seedMessage([
      {
        user_id: 7,
        emoji_name: "thumbs_up",
        emoji_code: "1f44d",
        reaction_type: "unicode_emoji",
      },
    ]);
    removeReactionMock.mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useReactionToggle(100));

    await act(async () => {
      await result.current.toggle(THUMBS_UP, true);
    });

    expect(removeReactionMock).toHaveBeenCalledWith(100, {
      emojiName: "thumbs_up",
      emojiCode: "1f44d",
      reactionType: "unicode_emoji",
    });
    const message = useMessagesStore.getState().getMessage(100);
    expect(message?.reactions).toEqual([]);
  });

  it("reverts a failed remove by re-adding the reaction", async () => {
    seedMessage([
      {
        user_id: 7,
        emoji_name: "thumbs_up",
        emoji_code: "1f44d",
        reaction_type: "unicode_emoji",
      },
    ]);
    removeReactionMock.mockRejectedValueOnce(new Error("nope"));
    const { result } = renderHook(() => useReactionToggle(100));

    await act(async () => {
      await result.current.toggle(THUMBS_UP, true);
    });

    const message = useMessagesStore.getState().getMessage(100);
    expect(message?.reactions).toHaveLength(1);
    expect(result.current.errorMessage).toBe("nope");
  });
});

describe("useReactionToggle — own user resolution", () => {
  it("skips the optimistic update when viewerId is undefined but still calls REST", async () => {
    seedMessage([]);
    useAuthStore.setState({
      session: { email: "h@x", apiKey: "k" },
      status: "authenticated",
      isLoggingIn: false,
      error: null,
    });
    addReactionMock.mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useReactionToggle(100));

    await act(async () => {
      await result.current.toggle(THUMBS_UP, false);
    });

    // No optimistic write — the cache is unchanged.
    expect(useMessagesStore.getState().getMessage(100)?.reactions).toEqual([]);
    // But the REST call still went out.
    expect(addReactionMock).toHaveBeenCalledOnce();
  });
});
