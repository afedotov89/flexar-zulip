// Unit tests for the user-statuses reducers (Phase 4.4).

import { describe, expect, it } from "vitest";
import type { UserStatusEvent } from "../domain";
import {
  applyUserStatusEvent,
  hydrateFromSnapshot,
  type UserStatusMap,
} from "./userStatusesReducer";

function event(overrides: Partial<UserStatusEvent>): UserStatusEvent {
  return {
    id: 1,
    type: "user_status",
    user_id: 5,
    ...overrides,
  };
}

describe("hydrateFromSnapshot", () => {
  it("keeps users with text and/or emoji set", () => {
    const result = hydrateFromSnapshot({
      "5": { status_text: "ooo" },
      "6": { emoji_name: "rocket", emoji_code: "1f680", reaction_type: "unicode_emoji" },
    });
    expect(result[5]?.status_text).toBe("ooo");
    expect(result[6]?.emoji_name).toBe("rocket");
  });

  it("drops users whose snapshot has no text and no emoji", () => {
    const result = hydrateFromSnapshot({
      "5": { away: true },
      "6": { status_text: "" },
    });
    expect(result[5]).toBeUndefined();
    expect(result[6]).toBeUndefined();
  });
});

describe("applyUserStatusEvent", () => {
  it("inserts a new status", () => {
    const state: UserStatusMap = {};
    const result = applyUserStatusEvent(
      state,
      event({ user_id: 7, status_text: "ooo" }),
    );
    expect(result[7]?.status_text).toBe("ooo");
  });

  it("merges only the fields the event sent", () => {
    const state: UserStatusMap = {
      7: {
        status_text: "ooo",
        emoji_name: "rocket",
        emoji_code: "1f680",
        reaction_type: "unicode_emoji",
      },
    };
    const result = applyUserStatusEvent(
      state,
      event({ user_id: 7, status_text: "back" }),
    );
    expect(result[7]).toEqual({
      status_text: "back",
      emoji_name: "rocket",
      emoji_code: "1f680",
      reaction_type: "unicode_emoji",
    });
  });

  it("clears a single field on empty-string", () => {
    const state: UserStatusMap = {
      7: {
        status_text: "ooo",
        emoji_name: "rocket",
        emoji_code: "1f680",
        reaction_type: "unicode_emoji",
      },
    };
    const result = applyUserStatusEvent(
      state,
      event({ user_id: 7, status_text: "" }),
    );
    expect(result[7]?.status_text).toBeUndefined();
    expect(result[7]?.emoji_name).toBe("rocket");
  });

  it("drops a user once both text and emoji are cleared", () => {
    const state: UserStatusMap = {
      7: { status_text: "ooo" },
    };
    const result = applyUserStatusEvent(
      state,
      event({
        user_id: 7,
        status_text: "",
        emoji_name: "",
        emoji_code: "",
        reaction_type: "",
      }),
    );
    expect(result[7]).toBeUndefined();
  });

  it("ignores unrelated event types", () => {
    const state: UserStatusMap = { 7: { status_text: "ooo" } };
    const result = applyUserStatusEvent(state, {
      id: 1,
      type: "heartbeat",
    } as unknown as UserStatusEvent);
    expect(result).toBe(state);
  });
});
