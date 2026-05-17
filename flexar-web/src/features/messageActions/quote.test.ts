// Tests for buildQuoteBlock — the Zulip-flavored quote prefix for
// "reply with quote".

import { describe, expect, it } from "vitest";
import type { Message } from "../../domain";
import { buildQuoteBlock } from "./quote";

function streamMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 456,
    type: "stream",
    content: "<p>x</p>",
    content_type: "text/html",
    subject: "launch",
    topic_links: [],
    stream_id: 7,
    display_recipient: "design",
    recipient_id: 1,
    sender_id: 123,
    sender_email: "alice@x",
    sender_full_name: "Alice",
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

describe("buildQuoteBlock", () => {
  it("wraps the raw markdown in a quote fence with a sender chip and permalink", () => {
    const out = buildQuoteBlock({
      message: streamMessage(),
      rawContent: "hello *world*",
      realmUrl: "https://chat.example.com",
    });
    expect(out).toContain("@_**Alice|123**");
    expect(out).toContain(
      "[said](https://chat.example.com/#narrow/channel/7-design/topic/launch/near/456)",
    );
    expect(out).toContain("```quote\nhello *world*\n```");
    // Trailing blank line so the caret lands on a fresh line.
    expect(out.endsWith("\n\n")).toBe(true);
  });

  it("omits the permalink when no realm URL is configured", () => {
    const out = buildQuoteBlock({
      message: streamMessage(),
      rawContent: "y",
      realmUrl: undefined,
    });
    expect(out).toContain("@_**Alice|123** said:");
    expect(out).not.toContain("[said]");
  });

  it("omits the permalink for DMs (recipient slug is server-version-fragile)", () => {
    const out = buildQuoteBlock({
      message: streamMessage({
        type: "private",
        stream_id: undefined,
        display_recipient: [
          { id: 8, email: "v@x", full_name: "Viewer", is_mirror_dummy: false },
          { id: 123, email: "alice@x", full_name: "Alice", is_mirror_dummy: false },
        ],
      }),
      rawContent: "hi",
      realmUrl: "https://chat.example.com",
    });
    expect(out).toContain("said:");
    expect(out).not.toContain("/near/");
  });

  it("trims a trailing newline off rawContent to avoid double blank lines in the fence", () => {
    const out = buildQuoteBlock({
      message: streamMessage(),
      rawContent: "hello\n",
      realmUrl: "https://chat.example.com",
    });
    expect(out).toContain("```quote\nhello\n```");
  });
});
