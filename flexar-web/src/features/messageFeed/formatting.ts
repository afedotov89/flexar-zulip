// Flexar Hub Web — feed display formatting helpers (Phase 1.6).
//
// Small pure functions that turn raw message data into the strings the
// feed shows: message timestamps, date-separator labels, and DM
// participant lists. Kept here (feed-only, not general-purpose) and
// unit-tested in `./formatting.test.ts`.
//
// All formatting is viewer-local and uses the platform `Intl` APIs, so
// it follows the browser's locale and timezone without extra config.

import type { UnixTimestamp, User, UserId } from "../../domain";

// Reused formatters — constructing `Intl.*Format` is comparatively
// expensive, so they are built once at module load.
const TIME_FORMAT = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});

const DAY_FORMAT = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
});

const DAY_WITH_YEAR_FORMAT = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

/** The clock time of a message, e.g. `14:05` / `2:05 PM` (locale-driven). */
export function formatMessageTime(timestamp: UnixTimestamp): string {
  return TIME_FORMAT.format(new Date(timestamp * 1000));
}

/**
 * The label for a date-separator row: `Today` / `Yesterday` for the two
 * most recent days, otherwise the full date. The year is included only
 * when it differs from the current year, to keep recent separators
 * short. `now` is injectable so the logic is testable without mocking
 * the clock.
 */
export function formatDateSeparator(
  dayStart: UnixTimestamp,
  now: Date = new Date(),
): string {
  const day = new Date(dayStart * 1000);

  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const oneDayMs = 24 * 60 * 60 * 1000;
  const diffDays = Math.round(
    (todayStart.getTime() - day.getTime()) / oneDayMs,
  );

  if (diffDays === 0) {
    return "Today";
  }
  if (diffDays === 1) {
    return "Yesterday";
  }
  return day.getFullYear() === now.getFullYear()
    ? DAY_FORMAT.format(day)
    : DAY_WITH_YEAR_FORMAT.format(day);
}

/**
 * The display label for a DM recipient bar: the names of the other
 * participants, comma-joined. The viewer is dropped from the list (a
 * DM with yourself keeps your own name so the bar is never empty).
 * Unknown user ids — not yet in `usersStore` — fall back to
 * `User <id>`, so the bar always renders something readable.
 */
export function formatDmParticipants(
  participantIds: readonly UserId[],
  ownUserId: UserId | undefined,
  resolveUser: (id: UserId) => User | undefined,
): string {
  const others = participantIds.filter((id) => id !== ownUserId);
  // A self-DM has no "other" participants — show the viewer's own name.
  const ids = others.length > 0 ? others : participantIds;
  const names = ids.map((id) => resolveUser(id)?.full_name ?? `User ${id}`);
  return names.join(", ");
}
