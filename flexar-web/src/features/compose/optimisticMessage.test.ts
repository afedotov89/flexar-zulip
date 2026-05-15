// Unit tests for the optimistic-echo message builder (Phase 2.2).

import { afterEach, describe, expect, it } from "vitest";
import type { Message, User } from "../../domain";
import {
  __resetLocalIdSeedForTests,
  buildOptimisticMessage,
  nextLocalId,
  type OptimisticSender,
} from "./optimisticMessage";

const sender: OptimisticSender = {
  userId: 9,
  email: "iago@zulip.com",
  fullName: "Iago",
  realmStr: "zulip",
  avatarUrl: null,
};

afterEach(() => {
  __resetLocalIdSeedForTests();
});

describe("nextLocalId", () => {
  it("hands out strictly decreasing negative ids", () => {
    const a = nextLocalId();
    const b = nextLocalId();
    const c = nextLocalId();
    expect(a).toBeLessThan(0);
    expect(b).toBeLessThan(a);
    expect(c).toBeLessThan(b);
  });
});

describe("buildOptimisticMessage — channel", () => {
  it("uses the local id, the channel name and topic, and a stream type", () => {
    const message = buildOptimisticMessage({
      localId: -1,
      content: "hello",
      sender,
      destination: {
        type: "channel",
        streamId: 7,
        streamName: "engineering",
        topic: "deploys",
      },
      nowMs: 1_700_000_000_000,
    });
    expect(message.id).toBe(-1);
    expect(message.type).toBe("stream");
    expect(message.stream_id).toBe(7);
    expect(message.display_recipient).toBe("engineering");
    expect(message.subject).toBe("deploys");
    expect(message.timestamp).toBe(1_700_000_000);
    expect(message.sender_id).toBe(9);
  });

  it("falls back to `Channel <id>` when the channel name is unknown", () => {
    const message = buildOptimisticMessage({
      localId: -2,
      content: "hi",
      sender,
      destination: {
        type: "channel",
        streamId: 42,
        streamName: undefined,
        topic: "",
      },
    });
    expect(message.display_recipient).toBe("Channel 42");
  });

  it("escapes the body text and wraps it in a paragraph", () => {
    const message = buildOptimisticMessage({
      localId: -3,
      content: "<script>alert(1)</script>",
      sender,
      destination: {
        type: "channel",
        streamId: 1,
        streamName: "general",
        topic: "x",
      },
    });
    expect(message.content).toBe(
      "<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>",
    );
  });
});

describe("buildOptimisticMessage — direct", () => {
  function user(id: number, name: string): User {
    return {
      user_id: id,
      delivery_email: null,
      email: `u${id}@example.com`,
      full_name: name,
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
    };
  }

  it("includes the viewer in the participant list and resolves recipients", () => {
    const lookup = (id: number): User | undefined =>
      id === 5 ? user(5, "Hamlet") : undefined;
    const message = buildOptimisticMessage({
      localId: -1,
      content: "hi",
      sender,
      destination: {
        type: "direct",
        recipientIds: [5],
        lookupUser: lookup,
      },
    });
    expect(message.type).toBe("private");
    expect(message.subject).toBe("");
    expect(Array.isArray(message.display_recipient)).toBe(true);
    const recipients = message.display_recipient as Exclude<
      Message["display_recipient"],
      string
    >;
    expect(recipients.map((r) => r.id).sort((a, b) => a - b)).toEqual([5, 9]);
    const hamlet = recipients.find((r) => r.id === 5);
    expect(hamlet?.full_name).toBe("Hamlet");
    const me = recipients.find((r) => r.id === 9);
    expect(me?.full_name).toBe("Iago");
  });

  it("falls back to `User <id>` when a recipient is not in the directory", () => {
    const message = buildOptimisticMessage({
      localId: -1,
      content: "hi",
      sender,
      destination: {
        type: "direct",
        recipientIds: [99],
        lookupUser: () => undefined,
      },
    });
    const recipients = message.display_recipient as Exclude<
      Message["display_recipient"],
      string
    >;
    const stranger = recipients.find((r) => r.id === 99);
    expect(stranger?.full_name).toBe("User 99");
  });

  it("deduplicates the participant list when the viewer is in the recipients", () => {
    const message = buildOptimisticMessage({
      localId: -1,
      content: "hi",
      sender,
      destination: {
        type: "direct",
        recipientIds: [9, 5],
        lookupUser: () => undefined,
      },
    });
    const recipients = message.display_recipient as Exclude<
      Message["display_recipient"],
      string
    >;
    expect(recipients.length).toBe(2);
  });
});
