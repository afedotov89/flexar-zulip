// Tests for the typeahead data sources (mention/channel/emoji/topic).
//
// Pure logic only — no React, no DOM. Each suite checks the documented
// filter+sort rules.

import { describe, it, expect } from "vitest";
import type {
  Stream,
  StreamId,
  Subscription,
  Topic,
  User,
  UserId,
} from "../../../domain";
import type { EmojiEntry } from "../../../lib/emoji";
import {
  channelRows,
  emojiRows,
  mentionRows,
  topicRows,
  TYPEAHEAD_MAX_ROWS,
} from "./sources";

function makeUser(id: UserId, full_name: string, email: string): User {
  return {
    user_id: id,
    email,
    delivery_email: null,
    full_name,
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

function makeStream(id: StreamId, name: string): Stream {
  return {
    stream_id: id,
    name,
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
  };
}

function makeSub(
  id: StreamId,
  name: string,
  pinned = false,
): Subscription {
  return {
    stream_id: id,
    name,
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
    color: "#000000",
    pin_to_top: pinned,
    is_muted: false,
    desktop_notifications: null,
    email_notifications: null,
    push_notifications: null,
    audible_notifications: null,
    wildcard_mentions_notify: null,
  };
}

describe("mentionRows", () => {
  const users: Record<UserId, User> = {
    1: makeUser(1, "Alice", "alice@example.com"),
    2: makeUser(2, "Albert Einstein", "albert@example.com"),
    3: makeUser(3, "Bob", "bob@example.com"),
    4: makeUser(4, "Carol Albright", "carol@example.com"),
    5: { ...makeUser(5, "Dave Deactivated", "dave@example.com"), is_active: false },
  };

  it("ranks prefix matches before substring matches", () => {
    const rows = mentionRows("al", users);
    // Alice and Albert prefix-match; Carol Albright substring-matches.
    expect(rows.map((r) => r.label)).toEqual([
      "Albert Einstein",
      "Alice",
      "Carol Albright",
    ]);
  });

  it("matches case-insensitively against names and emails", () => {
    const rows = mentionRows("BERT", users);
    expect(rows.some((r) => r.user.user_id === 2)).toBe(true);
    const rowsByEmail = mentionRows("bob@", users);
    expect(rowsByEmail.some((r) => r.user.user_id === 3)).toBe(true);
  });

  it("excludes deactivated users", () => {
    const rows = mentionRows("dave", users);
    expect(rows).toEqual([]);
  });

  it("returns the full mention syntax in `insertText`", () => {
    const rows = mentionRows("Alice", users);
    expect(rows[0].insertText).toBe("@**Alice**");
  });

  it("returns at most TYPEAHEAD_MAX_ROWS rows", () => {
    const many: Record<UserId, User> = {};
    for (let i = 0; i < 30; i += 1) {
      many[i] = makeUser(i, `User${i}`, `u${i}@example.com`);
    }
    expect(mentionRows("user", many).length).toBe(TYPEAHEAD_MAX_ROWS);
  });

  it("returns alphabetical ordering for an empty query", () => {
    const rows = mentionRows("", users);
    expect(rows.map((r) => r.label)).toEqual([
      "Albert Einstein",
      "Alice",
      "Bob",
      "Carol Albright",
    ]);
  });
});

describe("channelRows", () => {
  const streams: Record<StreamId, Stream> = {
    1: makeStream(1, "engineering"),
    2: makeStream(2, "design"),
    3: makeStream(3, "english-lit"),
    4: makeStream(4, "general"),
  };
  const subscriptions: Record<StreamId, Subscription> = {
    1: makeSub(1, "engineering", false),
    2: makeSub(2, "design", true), // pinned
  };

  it("ranks pinned subscribed channels above other subscribed, above unsubscribed", () => {
    // Query "e" prefix-matches engineering, english-lit; substring-
    // matches design (sub, pinned), general (unsub). Pinned (design)
    // first, then subscribed (engineering), then unsub prefix
    // (english-lit), then unsub substring (general).
    const rows = channelRows("e", streams, subscriptions);
    expect(rows.map((r) => r.label)).toEqual([
      "design",
      "engineering",
      "english-lit",
      "general",
    ]);
  });

  it("falls back to sorting by tier+label within the same group", () => {
    const rows = channelRows("eng", streams, subscriptions);
    // engineering (sub) ranks above english-lit (unsub) because of
    // subscription tier; both prefix-match.
    expect(rows.map((r) => r.label)).toEqual(["engineering", "english-lit"]);
  });

  it("includes the channel mention syntax in `insertText`", () => {
    const rows = channelRows("design", streams, subscriptions);
    expect(rows[0].insertText).toBe("#**design**");
  });

  it("does not duplicate a channel that lives in both maps", () => {
    const rows = channelRows("design", streams, subscriptions);
    expect(rows.filter((r) => r.label === "design").length).toBe(1);
  });
});

describe("emojiRows", () => {
  const corpus: readonly EmojiEntry[] = [
    { shortcode: "smile", glyph: "😄" },
    { shortcode: "smirk", glyph: "😏" },
    { shortcode: "sad", glyph: "😢" },
    { shortcode: "wave", glyph: "👋" },
    { shortcode: "rocket", glyph: "🚀" },
  ];

  it("ranks prefix matches first", () => {
    const rows = emojiRows("sm", corpus);
    expect(rows.map((r) => r.entry.shortcode)).toEqual(["smile", "smirk"]);
  });

  it("includes substring matches under prefix matches", () => {
    const rows = emojiRows("a", corpus);
    expect(rows.map((r) => r.entry.shortcode)).toEqual(["sad", "wave"]);
  });

  it("returns alphabetical order for an empty query", () => {
    const rows = emojiRows("", corpus);
    expect(rows.map((r) => r.entry.shortcode)).toEqual([
      "rocket",
      "sad",
      "smile",
      "smirk",
      "wave",
    ]);
  });

  it("emits `:shortcode:` as the insert text", () => {
    const rows = emojiRows("smile", corpus);
    expect(rows[0].insertText).toBe(":smile:");
  });
});

describe("topicRows", () => {
  const topics: Topic[] = [
    { name: "deploys", max_id: 10 },
    { name: "design notes", max_id: 30 },
    { name: "design review", max_id: 20 },
    { name: "lunch", max_id: 5 },
  ];

  it("ranks prefix matches above substring, recency within tier", () => {
    const rows = topicRows("design", topics);
    expect(rows.map((r) => r.topic.name)).toEqual([
      "design notes",
      "design review",
    ]);
  });

  it("returns recency-sorted order for an empty query", () => {
    const rows = topicRows("", topics);
    expect(rows.map((r) => r.topic.name)).toEqual([
      "design notes",
      "design review",
      "deploys",
      "lunch",
    ]);
  });

  it("renders the empty-string topic as `(general)`", () => {
    const generalTopics: Topic[] = [{ name: "", max_id: 1 }];
    const rows = topicRows("", generalTopics);
    expect(rows[0].label).toBe("(general)");
    expect(rows[0].insertText).toBe("");
  });
});
