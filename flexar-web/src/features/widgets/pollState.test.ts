// Unit tests for the poll-widget state derivation (Phase 4.7).

import { describe, expect, it } from "vitest";
import type { Submessage } from "../../domain";
import {
  buildNewOptionContent,
  buildVoteContent,
  derivePollState,
  detectPoll,
} from "./pollState";

function widget(content: object, senderId: number, id: number): Submessage {
  return {
    id,
    message_id: 1,
    sender_id: senderId,
    msg_type: "widget",
    content: JSON.stringify(content),
  };
}

describe("detectPoll", () => {
  it("returns null on an empty submessages array", () => {
    expect(detectPoll([])).toBeNull();
  });

  it("returns null when the first submessage is not a widget", () => {
    expect(
      detectPoll([
        { id: 1, message_id: 1, sender_id: 1, msg_type: "other", content: "{}" },
      ]),
    ).toBeNull();
  });

  it("returns null on a non-poll widget", () => {
    expect(
      detectPoll([widget({ widget_type: "todo", extra_data: {} }, 1, 1)]),
    ).toBeNull();
  });

  it("parses question and options from a poll widget", () => {
    const meta = detectPoll([
      widget(
        {
          widget_type: "poll",
          extra_data: { question: "Lunch?", options: ["Pasta", "Sushi"] },
        },
        1,
        1,
      ),
    ]);
    expect(meta).toEqual({
      type: "poll",
      question: "Lunch?",
      optionTexts: ["Pasta", "Sushi"],
    });
  });

  it("treats malformed JSON as non-poll", () => {
    expect(
      detectPoll([
        { id: 1, message_id: 1, sender_id: 1, msg_type: "widget", content: "{" },
      ]),
    ).toBeNull();
  });
});

describe("derivePollState", () => {
  it("seeds canned options with `canned,<idx>` keys", () => {
    const state = derivePollState([
      widget(
        {
          widget_type: "poll",
          extra_data: { question: "?", options: ["A", "B"] },
        },
        1,
        1,
      ),
    ]);
    expect(state?.options.map((o) => [o.key, o.text])).toEqual([
      ["canned,0", "A"],
      ["canned,1", "B"],
    ]);
  });

  it("appends user-added options under `<sender>,<idx>`", () => {
    const state = derivePollState([
      widget(
        {
          widget_type: "poll",
          extra_data: { question: "?", options: ["A"] },
        },
        1,
        1,
      ),
      widget({ type: "new_option", idx: 0, option: "C" }, 5, 2),
    ]);
    expect(state?.options.map((o) => [o.key, o.text])).toEqual([
      ["canned,0", "A"],
      ["5,0", "C"],
    ]);
  });

  it("suppresses a new_option event whose text duplicates an existing option", () => {
    const state = derivePollState([
      widget(
        {
          widget_type: "poll",
          extra_data: { question: "?", options: ["A"] },
        },
        1,
        1,
      ),
      widget({ type: "new_option", idx: 0, option: "A" }, 5, 2),
    ]);
    expect(state?.options).toHaveLength(1);
  });

  it("toggles a voter on and off", () => {
    const state = derivePollState([
      widget(
        {
          widget_type: "poll",
          extra_data: { question: "?", options: ["A"] },
        },
        1,
        1,
      ),
      widget({ type: "vote", key: "canned,0", vote: 1 }, 7, 2),
      widget({ type: "vote", key: "canned,0", vote: 1 }, 8, 3),
      widget({ type: "vote", key: "canned,0", vote: -1 }, 7, 4),
    ]);
    expect(state?.options[0]?.voters).toEqual([8]);
    expect(state?.hasVoted("canned,0", 7)).toBe(false);
    expect(state?.hasVoted("canned,0", 8)).toBe(true);
  });

  it("ignores vote events for unknown keys", () => {
    const state = derivePollState([
      widget(
        {
          widget_type: "poll",
          extra_data: { question: "?", options: ["A"] },
        },
        1,
        1,
      ),
      widget({ type: "vote", key: "missing,9", vote: 1 }, 7, 2),
    ]);
    expect(state?.options[0]?.voters).toEqual([]);
  });

  it("applies a question-edit event", () => {
    const state = derivePollState([
      widget(
        {
          widget_type: "poll",
          extra_data: { question: "?", options: ["A"] },
        },
        1,
        1,
      ),
      widget({ type: "question", question: "Lunch?" }, 1, 2),
    ]);
    expect(state?.question).toBe("Lunch?");
  });
});

describe("buildVoteContent / buildNewOptionContent", () => {
  it("emits a vote toggle that flips the prior state", () => {
    expect(buildVoteContent("canned,0", false)).toBe(
      JSON.stringify({ type: "vote", key: "canned,0", vote: 1 }),
    );
    expect(buildVoteContent("canned,0", true)).toBe(
      JSON.stringify({ type: "vote", key: "canned,0", vote: -1 }),
    );
  });

  it("emits a new_option event", () => {
    expect(buildNewOptionContent(3, "Soup")).toBe(
      JSON.stringify({ type: "new_option", idx: 3, option: "Soup" }),
    );
  });
});
