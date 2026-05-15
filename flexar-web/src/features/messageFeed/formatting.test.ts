// Unit tests for the feed formatting helpers (Phase 1.6).
//
// `formatMessageTime` and the `Intl`-driven date formatting are
// locale-dependent, so these tests assert on the *logic* that is
// locale-stable: the Today / Yesterday / full-date branching of
// `formatDateSeparator`, and the participant-filtering + fallback of
// `formatDmParticipants`. The exact `Intl` output strings are not
// asserted — they vary by environment locale.

import { describe, expect, it } from "vitest";
import type { User } from "../../domain";
import {
  formatDateSeparator,
  formatDmParticipants,
  formatMessageTime,
} from "./formatting";
import { startOfLocalDay } from "./feedItems";

function makeUser(id: number, fullName: string): User {
  return {
    user_id: id,
    delivery_email: null,
    email: `user${id}@example.com`,
    full_name: fullName,
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

describe("formatMessageTime", () => {
  it("returns a non-empty locale string for a timestamp", () => {
    expect(formatMessageTime(1_700_000_000).length).toBeGreaterThan(0);
  });
});

describe("formatDateSeparator", () => {
  const now = new Date("2026-05-15T12:00:00");

  it("labels the current day as Today", () => {
    const today = startOfLocalDay(Math.floor(now.getTime() / 1000));
    expect(formatDateSeparator(today, now)).toBe("Сегодня");
  });

  it("labels the previous day as Yesterday", () => {
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const yesterday = Math.floor(todayStart.getTime() / 1000) - 24 * 60 * 60;
    expect(formatDateSeparator(yesterday, now)).toBe("Вчера");
  });

  it("uses a full date for an older day in the same year", () => {
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const older = Math.floor(todayStart.getTime() / 1000) - 5 * 24 * 60 * 60;
    const label = formatDateSeparator(older, now);
    expect(label).not.toBe("Сегодня");
    expect(label).not.toBe("Вчера");
    expect(label.length).toBeGreaterThan(0);
  });

  it("includes the year for a day in a different year", () => {
    const lastYear = startOfLocalDay(
      Math.floor(new Date("2024-03-10T12:00:00").getTime() / 1000),
    );
    expect(formatDateSeparator(lastYear, now)).toContain("2024");
  });
});

describe("formatDmParticipants", () => {
  const directory: Record<number, User> = {
    1: makeUser(1, "Alice"),
    2: makeUser(2, "Bob"),
    3: makeUser(3, "Carol"),
  };
  const resolve = (id: number): User | undefined => directory[id];

  it("lists the other participants, dropping the viewer", () => {
    expect(formatDmParticipants([1, 2, 3], 1, resolve)).toBe("Bob, Carol");
  });

  it("falls back to `User <id>` for unknown ids", () => {
    expect(formatDmParticipants([1, 9], 1, resolve)).toBe("User 9");
  });

  it("keeps the viewer's own name for a self-DM", () => {
    expect(formatDmParticipants([1], 1, resolve)).toBe("Alice");
  });

  it("lists everyone when the viewer id is unknown", () => {
    expect(formatDmParticipants([1, 2], undefined, resolve)).toBe(
      "Alice, Bob",
    );
  });
});
