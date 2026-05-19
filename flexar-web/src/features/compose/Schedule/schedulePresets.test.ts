// Unit tests for the schedule-popover preset / parsing helpers.

import { describe, expect, it } from "vitest";
import {
  formatDateTimeLocal,
  parseDateTimeLocal,
  presetTimes,
  toUnixSeconds,
} from "./schedulePresets";

describe("presetTimes", () => {
  it("on a midday Wednesday gives in-an-hour, this-evening, tomorrow, and Monday", () => {
    // Wednesday 2024-05-15 at 12:00 local time.
    const now = new Date(2024, 4, 15, 12, 0, 0);
    const presets = presetTimes(now);
    expect(presets.map((p) => p.id)).toEqual([
      "in-an-hour",
      "this-evening",
      "tomorrow-morning",
      "monday-morning",
    ]);
    // "Через час": exactly one hour from now.
    expect(presets[0]?.date.getTime()).toBe(now.getTime() + 60 * 60 * 1000);
    // "Сегодня в 18:00": same day, 18:00.
    expect(presets[1]?.date.getDate()).toBe(15);
    expect(presets[1]?.date.getHours()).toBe(18);
    // "Завтра в 09:00": Thu 2024-05-16 09:00.
    expect(presets[2]?.date.getDay()).toBe(4);
    expect(presets[2]?.date.getDate()).toBe(16);
    expect(presets[2]?.date.getHours()).toBe(9);
    // "В понедельник в 09:00": Mon 2024-05-20 09:00.
    expect(presets[3]?.date.getDay()).toBe(1);
    expect(presets[3]?.date.getDate()).toBe(20);
    expect(presets[3]?.date.getHours()).toBe(9);
  });

  it("after the evening cutoff drops 'Сегодня вечером'", () => {
    // Wednesday at 18:30 — past the 17:00 cutoff, so showing 18:00
    // today would be in the past / minutes away.
    const now = new Date(2024, 4, 15, 18, 30, 0);
    const ids = presetTimes(now).map((p) => p.id);
    expect(ids).not.toContain("this-evening");
    expect(ids).toContain("tomorrow-morning");
  });

  it("on a Sunday drops the Monday row because tomorrow IS Monday", () => {
    // Sunday 2024-05-19 at 11:00 — tomorrow == Monday, so the two
    // would resolve to the same instant.
    const now = new Date(2024, 4, 19, 11, 0, 0);
    const ids = presetTimes(now).map((p) => p.id);
    expect(ids).toContain("tomorrow-morning");
    expect(ids).not.toContain("monday-morning");
  });

  it("on a Monday before 09:00 picks the *next* Monday, not today", () => {
    // Monday 2024-05-20 at 07:00.
    const now = new Date(2024, 4, 20, 7, 0, 0);
    const monday = presetTimes(now).find(
      (p) => p.id === "monday-morning",
    )?.date;
    // Wraps a full week forward.
    expect(monday?.getDate()).toBe(27);
    expect(monday?.getDay()).toBe(1);
  });
});

describe("formatDateTimeLocal / parseDateTimeLocal", () => {
  it("round-trips a date through the input format", () => {
    const date = new Date(2024, 4, 15, 9, 30, 0);
    const value = formatDateTimeLocal(date);
    expect(value).toBe("2024-05-15T09:30");
    const parsed = parseDateTimeLocal(value);
    expect(parsed?.getTime()).toBe(date.getTime());
  });

  it("returns null for empty input", () => {
    expect(parseDateTimeLocal("")).toBeNull();
  });

  it("returns null for a value the browser would not produce", () => {
    expect(parseDateTimeLocal("not-a-date")).toBeNull();
  });
});

describe("toUnixSeconds", () => {
  it("floors to whole seconds and matches the API contract (UTC)", () => {
    const date = new Date(Date.UTC(2024, 4, 15, 12, 0, 0));
    expect(toUnixSeconds(date)).toBe(1715774400);
  });
});
