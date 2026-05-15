// Translate Zulip server error responses to Russian (Phase 5.x polish).
//
// Until the project's full i18n machinery lands (Phase 6.3) the UI
// surfaces are written in Russian directly. The Zulip server, by
// contrast, returns error messages in English — pasting those into
// otherwise-Russian banners reads jarring. This helper bridges the gap
// for the well-known error messages our UI can actually trigger:
//
//   - if the cause is an `ApiError` whose body's `msg` matches a known
//     English fragment, return the matching Russian translation;
//   - otherwise, fall back to the server's message verbatim — a stale
//     translation table is worse than the original text;
//   - non-`ApiError` causes get a generic Russian message.
//
// The table is intentionally narrow: only messages from the operations
// the web client performs (edit, delete, schedule, react, etc.). It is
// not a general Zulip-translation library; this stays in the project
// until the i18n module of Phase 6.3 supersedes it.

import { isApiError } from "../../api";

/**
 * Translation entries — server message fragment → Russian sentence.
 * `match` is checked as a case-sensitive substring of `error.body.msg`,
 * so we don't have to guess at server-side wording for variable parts
 * (limits, ids, names) and a single phrase can cover several variants.
 *
 * Order matters: the first matching entry wins, so list more specific
 * fragments before more general ones.
 */
const KNOWN_TRANSLATIONS: ReadonlyArray<{
  match: string;
  ru: string;
}> = [
  // Editing / deleting messages
  {
    match: "The time limit for editing this message has passed",
    ru: "Время для редактирования сообщения истекло.",
  },
  {
    match: "The time limit for deleting this message has passed",
    ru: "Время для удаления сообщения истекло.",
  },
  {
    match: "You don't have permission to edit this message",
    ru: "У вас нет прав на редактирование этого сообщения.",
  },
  {
    match: "You don't have permission to delete this message",
    ru: "У вас нет прав на удаление этого сообщения.",
  },
  // Subscriptions
  {
    match: "Unable to access channel",
    ru: "Нет доступа к каналу.",
  },
  // Scheduled messages
  {
    match: "Scheduled message does not exist",
    ru: "Отложенное сообщение не найдено.",
  },
  {
    match: "Scheduled delivery time must be in the future",
    ru: "Время отправки должно быть в будущем.",
  },
  // Status / settings
  {
    match: "status_text is too long",
    ru: "Слишком длинный текст статуса.",
  },
  // Reactions
  {
    match: "Reaction doesn't exist",
    ru: "Реакция не найдена.",
  },
  {
    match: "Reaction already exists",
    ru: "Такая реакция уже стоит.",
  },
  // Typing / submessages — generic widget cases
  {
    match: "Invalid json for submessage",
    ru: "Некорректный формат данных виджета.",
  },
];

/**
 * Convert any caught error from an `apiClient` call into a single-line
 * Russian message suitable for a `<Banner>`. Pass `fallback` to override
 * the generic "Не удалось выполнить действие." last-ditch wording.
 */
export function describeApiError(
  cause: unknown,
  fallback = "Не удалось выполнить действие.",
): string {
  if (isApiError(cause)) {
    const serverMsg = cause.body?.msg ?? cause.message;
    if (serverMsg !== undefined && serverMsg !== "") {
      for (const entry of KNOWN_TRANSLATIONS) {
        if (serverMsg.includes(entry.match)) {
          return entry.ru;
        }
      }
      // Untranslated server message — return verbatim. Better the user
      // sees the English one-liner than a vague generic.
      return serverMsg;
    }
  }
  if (cause instanceof Error && cause.message !== "") {
    return cause.message;
  }
  return fallback;
}
