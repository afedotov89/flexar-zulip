// Pure helpers for the schedule-send popover (Phase 4.5).
//
// Two responsibilities, both kept side-effect-free so they unit-test
// without mounting React or stubbing time:
//
//   - `presetTimes(now)` returns the four presets the popover offers
//     ("Tomorrow morning" / "Tomorrow afternoon" / "Monday morning" /
//     "Monday afternoon"). The semantics match Zulip's web client so
//     a user moving between the apps does not get surprised.
//
//   - `parseDateTimeLocal` / `formatDateTimeLocal` convert between an
//     `<input type="datetime-local">` value (a `YYYY-MM-DDTHH:mm`
//     string in local time) and a `Date`. The browser does the
//     locale-respecting picker; we only do the shape glue.

/** Description of one preset row in the popover. */
export interface SchedulePreset {
  /** Stable id used as the React key and aria-label suffix. */
  id: "tomorrow-morning" | "tomorrow-afternoon" | "monday-morning" | "monday-afternoon";
  /** Short ru-RU label shown in the row. */
  label: string;
  /** The absolute send time the preset resolves to. */
  date: Date;
}

/**
 * The four send-later presets, anchored to `now`. "Morning" is 09:00
 * local time; "afternoon" is 15:00. "Monday" is the next Monday — when
 * `now` is itself a Monday earlier than 09:00, that same Monday counts;
 * otherwise the next one.
 */
export function presetTimes(now: Date = new Date()): SchedulePreset[] {
  const tomorrow = startOfNextDay(now);
  const monday = nextMondayFrom(now);
  return [
    {
      id: "tomorrow-morning",
      label: "Завтра, 09:00",
      date: atHour(tomorrow, 9),
    },
    {
      id: "tomorrow-afternoon",
      label: "Завтра, 15:00",
      date: atHour(tomorrow, 15),
    },
    {
      id: "monday-morning",
      label: "В понедельник, 09:00",
      date: atHour(monday, 9),
    },
    {
      id: "monday-afternoon",
      label: "В понедельник, 15:00",
      date: atHour(monday, 15),
    },
  ];
}

/** Local-midnight of the day after `now`. */
function startOfNextDay(now: Date): Date {
  const next = new Date(now);
  next.setHours(0, 0, 0, 0);
  next.setDate(next.getDate() + 1);
  return next;
}

/**
 * The next Monday at local-midnight. When `now` is already a Monday
 * earlier than 09:00 we still pick the *upcoming* Monday — picking
 * "today" would just duplicate the "Tomorrow morning" preset on
 * Sundays. The two-day-spread keeps the four presets distinct.
 */
function nextMondayFrom(now: Date): Date {
  const candidate = new Date(now);
  candidate.setHours(0, 0, 0, 0);
  // `getDay()` returns 0 for Sunday … 6 for Saturday. Days until next
  // Monday: from Sunday it is 1; from Monday itself we want 7 (to skip
  // forward); from Saturday it is 2; etc.
  const today = candidate.getDay();
  const daysUntilMonday = today === 1 ? 7 : (8 - today) % 7;
  candidate.setDate(candidate.getDate() + daysUntilMonday);
  return candidate;
}

/** Return a copy of `date` with local hour set to `hour` (minute=0). */
function atHour(date: Date, hour: number): Date {
  const next = new Date(date);
  next.setHours(hour, 0, 0, 0);
  return next;
}

/**
 * Parse the value of an `<input type="datetime-local">` (`YYYY-MM-DDTHH:mm`
 * in *local* time) into a `Date`. Returns `null` when the value is empty
 * or unparseable.
 */
export function parseDateTimeLocal(value: string): Date | null {
  if (value === "") {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

/**
 * Format a `Date` for `<input type="datetime-local">`'s `value` /
 * `min` attributes. The input expects local time as `YYYY-MM-DDTHH:mm`.
 */
export function formatDateTimeLocal(date: Date): string {
  const pad = (n: number): string => n.toString().padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/** Convert a `Date` to a UTC unix-second timestamp (the API contract). */
export function toUnixSeconds(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}
