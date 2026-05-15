// Tests for the message permalink builder (`messageLink.ts`).
//
// Pure-function suite: covers the channel-message form, the DM forms
// (multi-participant + self-DM), the Zulip topic-segment encoding (the
// `.`-as-`%` substitution), and the fail-soft branches.

import { describe, expect, it } from "vitest";
import type { Message } from "../../domain";
import { buildMessageLink } from "./messageLink";

function channelMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 42,
    type: "stream",
    content: "<p>hi</p>",
    content_type: "text/html",
    subject: "weather",
    topic_links: [],
    stream_id: 7,
    display_recipient: "general",
    recipient_id: 1,
    sender_id: 1,
    sender_email: "a@b",
    sender_full_name: "A",
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

function directMessage(participants: number[], id = 99): Message {
  return {
    ...channelMessage({ id }),
    type: "private",
    subject: "",
    stream_id: undefined,
    display_recipient: participants.map((pid) => ({
      id: pid,
      email: `${pid}@x`,
      full_name: `User ${pid}`,
      is_mirror_dummy: false,
    })),
  };
}

const REALM = "https://chat.example.com";

describe("buildMessageLink — channel messages", () => {
  it("emits the canonical near-message URL", () => {
    const url = buildMessageLink(channelMessage(), {
      realmUrl: REALM,
      viewerId: 1,
    });
    expect(url).toBe(
      "https://chat.example.com/#narrow/channel/7/topic/weather/near/42",
    );
  });

  it("encodes spaces and `.` in the topic the way Zulip's web client does", () => {
    // "release v1.2" → spaces become %20 → become .20; literal `.` becomes
    // `.2E`. So the segment is `release.20v1.2E2`.
    const url = buildMessageLink(
      channelMessage({ subject: "release v1.2" }),
      { realmUrl: REALM, viewerId: 1 },
    );
    expect(url).toBe(
      "https://chat.example.com/#narrow/channel/7/topic/release.20v1.2E2/near/42",
    );
  });

  it("trims a trailing slash from the realm URL so it does not double up", () => {
    const url = buildMessageLink(channelMessage(), {
      realmUrl: `${REALM}/`,
      viewerId: 1,
    });
    expect(url?.startsWith("https://chat.example.com/#")).toBe(true);
  });

  it("returns undefined when the channel message has no stream_id", () => {
    const url = buildMessageLink(channelMessage({ stream_id: undefined }), {
      realmUrl: REALM,
      viewerId: 1,
    });
    expect(url).toBeUndefined();
  });
});

describe("buildMessageLink — direct messages", () => {
  it("excludes the viewer from the participant list and sorts the rest", () => {
    const url = buildMessageLink(directMessage([1, 7, 12]), {
      realmUrl: REALM,
      viewerId: 7,
    });
    expect(url).toBe("https://chat.example.com/#narrow/dm/1,12/near/99");
  });

  it("keeps the single participant for a self-DM (viewer is the only id)", () => {
    const url = buildMessageLink(directMessage([5]), {
      realmUrl: REALM,
      viewerId: 5,
    });
    expect(url).toBe("https://chat.example.com/#narrow/dm/5/near/99");
  });

  it("sorts ids when the viewer is unknown", () => {
    const url = buildMessageLink(directMessage([12, 1, 7]), {
      realmUrl: REALM,
      viewerId: undefined,
    });
    expect(url).toBe("https://chat.example.com/#narrow/dm/1,7,12/near/99");
  });
});

describe("buildMessageLink — fail-soft branches", () => {
  it("returns undefined when the realm URL is unknown", () => {
    const url = buildMessageLink(channelMessage(), {
      realmUrl: undefined,
      viewerId: 1,
    });
    expect(url).toBeUndefined();
  });
});
