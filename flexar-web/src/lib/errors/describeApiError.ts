// Translate Zulip server error responses to Russian (Phase 5.x polish).
//
// Until the project's full i18n machinery lands (Phase 6.3) the UI
// surfaces are written in Russian directly. The Zulip server, by
// contrast, returns error messages in English — pasting those into
// otherwise-Russian banners reads jarring. This helper bridges the gap
// for the well-known error messages our UI can actually trigger.
//
// ── Error classification ───────────────────────────────────────────
//
// Errors thrown from `apiClient` come in two distinct kinds and need
// different UX:
//
//   1. **Transport-level** (`ApiError` with code `NETWORK_ERROR` /
//      `TIMEOUT` / `ABORTED` / `MISSING_CREDENTIALS`) — there is no
//      server response, so `body` is undefined and `message` carries
//      a raw browser-level string like `"Failed to fetch"`. We must
//      NOT show that to the user — it's a generic English techspeak
//      that says nothing actionable. Each transport code gets its
//      own human-readable Russian message.
//
//   2. **Server-level** (`ApiError` with an HTTP status and a parsed
//      `body.msg`) — the server's English `msg` is a concrete
//      diagnosis (rate limit hit, time window expired, etc.). We
//      translate the well-known phrases via the `KNOWN_TRANSLATIONS`
//      table and fall back to the server message verbatim for
//      unknown phrases — a stale translation table would be worse
//      than the original text.
//
// The translation table is intentionally narrow: only messages from
// the operations the web client performs (edit, delete, schedule,
// react, etc.). It is not a general Zulip-translation library; this
// stays in the project until the i18n module of Phase 6.3 supersedes
// it.

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
 * Russian messages for the transport-level `ApiError` codes that have
 * no server body. These are user-visible: keep them short, concrete,
 * and actionable — they're the line the user sees in a `<Banner>`
 * after any failed action.
 */
const TRANSPORT_MESSAGES: Record<string, string> = {
  NETWORK_ERROR:
    "Не удалось связаться с сервером. Проверьте интернет и попробуйте ещё раз.",
  TIMEOUT: "Сервер не ответил вовремя. Попробуйте ещё раз.",
  ABORTED: "Запрос был отменён.",
  MISSING_CREDENTIALS: "Сессия истекла, войдите заново.",
};

/**
 * Convert any caught error from an `apiClient` call into a single-line
 * Russian message suitable for a `<Banner>`. Pass `fallback` to override
 * the generic "Не удалось выполнить действие." last-ditch wording.
 *
 * Classification (see the file header for full rationale):
 *   - `ApiError` with a transport code → predefined Russian sentence
 *     from `TRANSPORT_MESSAGES`. Never expose the raw browser-level
 *     `message` (e.g. "Failed to fetch") — it tells the user nothing.
 *   - `ApiError` with a server body → translate `body.msg` via
 *     `KNOWN_TRANSLATIONS`, fall back to the verbatim server msg if
 *     untranslated.
 *   - Anything else → the plain message or the generic fallback.
 */
export function describeApiError(
  cause: unknown,
  fallback = "Не удалось выполнить действие.",
): string {
  if (isApiError(cause)) {
    // Transport-level: no server body, so `message` carries a raw
    // browser/runtime string — replace it with a human-readable one
    // keyed by code.
    if (cause.body === undefined) {
      return TRANSPORT_MESSAGES[cause.code] ?? fallback;
    }
    // Server-level: `body.msg` is the server's diagnosis. Try to
    // translate, otherwise pass through verbatim.
    const serverMsg = cause.body.msg ?? cause.message;
    if (serverMsg !== undefined && serverMsg !== "") {
      for (const entry of KNOWN_TRANSLATIONS) {
        if (serverMsg.includes(entry.match)) {
          return entry.ru;
        }
      }
      return serverMsg;
    }
  }
  if (cause instanceof Error && cause.message !== "") {
    return cause.message;
  }
  return fallback;
}
