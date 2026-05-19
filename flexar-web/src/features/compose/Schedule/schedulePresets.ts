// Pure helpers for the schedule-send menu (Phase 4.5, redesign).
//
// Two responsibilities, both kept side-effect-free so they unit-test
// without mounting React or stubbing time:
//
//   - `presetTimes(now)` returns the context-aware quick presets the
//     menu offers. The set adapts to the current moment so we never
//     surface a preset that's already in the past, and we deduplicate
//     when two would resolve to the same day-and-hour ("Завтра в 9:00"
//     == "В понедельник в 9:00" on Sundays). A trailing "Своё время"
//     entry is added by the menu component so users can pick any
//     date / time the browser's datetime input allows.
//
//   - `parseDateTimeLocal` / `formatDateTimeLocal` convert between an
//     `<input type="datetime-local">` value (a `YYYY-MM-DDTHH:mm`
//     string in local time) and a `Date`. The browser does the
//     locale-respecting picker; we only do the shape glue.

/** Description of one preset row in the menu. */
export interface SchedulePreset {
  /** Stable id used as the React key and aria-label suffix. */
  id:
    | "in-an-hour"
    | "this-evening"
    | "tomorrow-morning"
    | "monday-morning";
  /** Short ru-RU label shown in the row. */
  label: string;
  /** The absolute send time the preset resolves to. */
  date: Date;
}

/** Local hour for the "morning" presets. */
const MORNING_HOUR = 9;
/** Local hour for the "evening" preset. */
const EVENING_HOUR = 18;
/**
 * If the current local hour is already at or past this, the "Сегодня
 * вечером" preset is dropped — it would either be in the past or so
 * close to now that it's effectively a click-by-mistake hazard.
 */
const EVENING_CUTOFF_HOUR = 17;

/**
 * Build the quick-schedule preset list, anchored to `now`. The set
 * adapts: we always include "Через час" and "Завтра в 09:00", and
 * conditionally add the evening / Monday rows when they would resolve
 * to a distinct future moment.
 */
export function presetTimes(now: Date = new Date()): SchedulePreset[] {
  const presets: SchedulePreset[] = [];

  presets.push({
    id: "in-an-hour",
    label: "Через час",
    date: new Date(now.getTime() + 60 * 60 * 1000),
  });

  if (now.getHours() < EVENING_CUTOFF_HOUR) {
    presets.push({
      id: "this-evening",
      label: `Сегодня в ${formatHour(EVENING_HOUR)}`,
      date: atHourOfDay(now, EVENING_HOUR),
    });
  }

  const tomorrow = startOfNextDay(now);
  presets.push({
    id: "tomorrow-morning",
    label: `Завтра в ${formatHour(MORNING_HOUR)}`,
    date: atHourOfDay(tomorrow, MORNING_HOUR),
  });

  // Drop the Monday row when tomorrow IS Monday — the two presets
  // would resolve to the same instant and look like a duplicate.
  const monday = nextMondayFrom(now);
  if (!isSameDay(monday, tomorrow)) {
    presets.push({
      id: "monday-morning",
      label: `В понедельник в ${formatHour(MORNING_HOUR)}`,
      date: atHourOfDay(monday, MORNING_HOUR),
    });
  }

  return presets;
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
 * earlier than `MORNING_HOUR:00` we still pick the *upcoming* Monday
 * — picking "today" would risk a preset that's only minutes away.
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
function atHourOfDay(date: Date, hour: number): Date {
  const next = new Date(date);
  next.setHours(hour, 0, 0, 0);
  return next;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** "HH:MM" zero-padded — small helper so labels read consistently. */
function formatHour(hour: number): string {
  return `${hour.toString().padStart(2, "0")}:00`;
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
