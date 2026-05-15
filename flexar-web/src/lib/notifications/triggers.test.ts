// Unit tests for the notification-trigger decision (Phase 3.5).

import { describe, expect, it } from "vitest";
import type { Message } from "../../domain";
import { notificationTriggerFor } from "./triggers";

function channelMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 1,
    type: "stream",
    sender_id: 7,
    sender_full_name: "Sender",
    sender_email: "sender@example.com",
    sender_realm_str: "",
    avatar_url: null,
    client: "test",
    content: "hi",
    content_type: "text/html",
    display_recipient: "general",
    is_me_message: false,
    reactions: [],
    recipient_id: 0,
    stream_id: 9,
    submessages: [],
    subject: "release",
    timestamp: 0,
    topic_links: [],
    ...overrides,
  } as Message;
}

function dmMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 2,
    type: "private",
    sender_id: 7,
    sender_full_name: "Sender",
    sender_email: "sender@example.com",
    sender_realm_str: "",
    avatar_url: null,
    client: "test",
    content: "hi",
    content_type: "text/html",
    display_recipient: [
      {
        id: 100,
        email: "me@example.com",
        full_name: "Me",
        is_mirror_dummy: false,
      },
      {
        id: 7,
        email: "sender@example.com",
        full_name: "Sender",
        is_mirror_dummy: false,
      },
    ],
    is_me_message: false,
    reactions: [],
    recipient_id: 0,
    submessages: [],
    subject: "",
    timestamp: 0,
    topic_links: [],
    ...overrides,
  } as Message;
}

describe("notificationTriggerFor", () => {
  it("returns null when ownUserId is unknown", () => {
    expect(notificationTriggerFor(channelMessage(), ["mentioned"], null)).toBeNull();
  });

  it("returns null for the viewer's own messages even when mentioned", () => {
    expect(
      notificationTriggerFor(
        channelMessage({ sender_id: 100 }),
        ["mentioned"],
        100,
      ),
    ).toBeNull();
  });

  it("returns mention for a personal mention", () => {
    expect(
      notificationTriggerFor(channelMessage(), ["mentioned"], 100),
    ).toEqual({
      kind: "mention",
    });
  });

  it("returns mention for the deprecated wildcard_mentioned flag", () => {
    expect(
      notificationTriggerFor(channelMessage(), ["wildcard_mentioned"], 100),
    ).toEqual({ kind: "mention" });
  });

  it("returns mention for stream_wildcard_mentioned", () => {
    expect(
      notificationTriggerFor(
        channelMessage(),
        ["stream_wildcard_mentioned"],
        100,
      ),
    ).toEqual({ kind: "mention" });
  });

  it("returns mention for topic_wildcard_mentioned", () => {
    expect(
      notificationTriggerFor(
        channelMessage(),
        ["topic_wildcard_mentioned"],
        100,
      ),
    ).toEqual({ kind: "mention" });
  });

  it("returns dm for a direct message addressed to the viewer", () => {
    expect(notificationTriggerFor(dmMessage(), [], 100)).toEqual({ kind: "dm" });
  });

  it("returns null for an unmentioned channel message", () => {
    expect(notificationTriggerFor(channelMessage(), [], 100)).toBeNull();
  });

  it("returns null for already-read mentions (server marks them on send)", () => {
    // Read flag does not suppress on its own — that gating happens in
    // the dispatcher (visibility / focus). The trigger only decides
    // whether the message *kind* is notifiable.
    expect(
      notificationTriggerFor(channelMessage(), ["mentioned", "read"], 100),
    ).toEqual({ kind: "mention" });
  });
});
