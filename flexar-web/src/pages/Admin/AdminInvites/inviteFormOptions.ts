// Shared option lists and helpers for the invite-related modals
// (Phase 5.4). Both SendInviteModal and CreateReusableInviteLinkModal
// expose the same Role + Expiration selectors, plus a date formatter
// used by the AdminInvites list.

import type { SelectOption } from "../../../components/Select";
import { type Role, RoleValues } from "../../../domain";

export const roleOptions: SelectOption[] = [
  { value: String(RoleValues.Owner), label: "Владелец" },
  { value: String(RoleValues.Administrator), label: "Администратор" },
  { value: String(RoleValues.Moderator), label: "Модератор" },
  { value: String(RoleValues.Member), label: "Участник" },
  { value: String(RoleValues.Guest), label: "Гость" },
];

export const roleLabels: Record<Role, string> = {
  [RoleValues.Owner]: "Владелец",
  [RoleValues.Administrator]: "Администратор",
  [RoleValues.Moderator]: "Модератор",
  [RoleValues.Member]: "Участник",
  [RoleValues.Guest]: "Гость",
};

// Owner / admin / moderator stand out (accent); member / guest are
// neutral pills. Mirrors the visual weight in AdminUsers.
export function badgeVariantForRole(role: Role): "neutral" | "accent" {
  if (
    role === RoleValues.Owner ||
    role === RoleValues.Administrator ||
    role === RoleValues.Moderator
  ) {
    return "accent";
  }
  return "neutral";
}

// "Бессрочно" maps to `null`; the rest are positive minute counts the
// server accepts as `invite_expires_in_minutes`.
export const NEVER_EXPIRES = "never";

export const expirationOptions: SelectOption[] = [
  { value: "1440", label: "1 день" },
  { value: "10080", label: "7 дней" },
  { value: "43200", label: "30 дней" },
  { value: NEVER_EXPIRES, label: "Бессрочно" },
];

/** Parse the Select string back into the API's `number | null`. */
export function parseExpiration(value: string): number | null {
  if (value === NEVER_EXPIRES) {
    return null;
  }
  return Number(value);
}

/** Format a unix-seconds expiry into the Russian locale, or "Бессрочно". */
export function formatExpiry(expiry: number | null): string {
  if (expiry === null) {
    return "Бессрочно";
  }
  return `До ${new Date(expiry * 1000).toLocaleDateString("ru-RU")}`;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Split a textarea blob into trimmed, comma-or-newline-separated emails. */
export function parseEmails(raw: string): string[] {
  return raw
    .split(/[,\n]/)
    .map((part) => part.trim())
    .filter((part) => part !== "");
}

/** Whether every parsed token looks like an email. Empty list → false. */
export function allValidEmails(emails: readonly string[]): boolean {
  if (emails.length === 0) {
    return false;
  }
  return emails.every((email) => EMAIL_PATTERN.test(email));
}
