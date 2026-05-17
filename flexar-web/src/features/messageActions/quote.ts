// Build a Zulip-flavored "reply with quote" block.
//
// Output shape (matches Zulip's own web client convention):
//
//   @_**Alice|123** [said](#narrow/channel/7-design/topic/launch/near/456):
//   ```quote
//   Original message body, verbatim Markdown source.
//   ```
//
//   ‹caret lands here›
//
// The leading silent mention (`@_…`) pings nobody but renders the
// sender's name as a clickable chip in the rendered output. The
// `[said](…)` link points at the source message via Zulip's `/near/`
// permalink scheme, so the reply carries a back-reference. The
// `quote` fenced code block is Zulip's documented way to set a quote
// — `MessageContent`'s CSS already styles it as a left-bordered
// blockquote.
//
// `rawContent` must be the Markdown source (via
// `apiClient.getRawContent`), NOT the server's rendered HTML — a
// nested HTML quote would render as escaped text instead of a real
// quote.

import type { Message } from "../../domain";

export interface QuoteContext {
  /** Message being quoted. */
  message: Message;
  /** Markdown source of the message body (from `apiClient.getRawContent`). */
  rawContent: string;
  /** `Realm.realm_url` — used to build the permalink in the `[said]` link. */
  realmUrl: string | undefined;
}

/**
 * Compose the quote block. Always returns a trailing blank line so
 * the caret lands ready for the user's reply text.
 */
export function buildQuoteBlock({
  message,
  rawContent,
  realmUrl,
}: QuoteContext): string {
  const senderRef = `@_**${message.sender_full_name}|${message.sender_id}**`;
  const permalink = buildPermalink(message, realmUrl);
  const saidLink =
    permalink === null ? "said:" : `[said](${permalink}):`;
  // Trim a single trailing newline off rawContent — `getRawContent`
  // sometimes returns one — to avoid two blank lines inside the
  // fence. Beyond that, the body is verbatim.
  const body = rawContent.replace(/\n+$/, "");
  return `${senderRef} ${saidLink}\n\`\`\`quote\n${body}\n\`\`\`\n\n`;
}

/**
 * Zulip's `/near/<message_id>` permalink scheme — anchors the link to
 * the message inside its narrow. Returns `null` if we can't build a
 * usable URL (no realm URL configured, or message has no
 * channel/topic shape we can serialise).
 */
function buildPermalink(
  message: Message,
  realmUrl: string | undefined,
): string | null {
  if (realmUrl === undefined || realmUrl === "") {
    return null;
  }
  if (message.type === "stream") {
    if (message.stream_id === undefined) {
      return null;
    }
    const channelSlug = `${message.stream_id}-${slug(
      typeof message.display_recipient === "string"
        ? message.display_recipient
        : "stream",
    )}`;
    const topicSlug = encodeURIComponent(message.subject);
    return `${stripTrailingSlash(realmUrl)}/#narrow/channel/${channelSlug}/topic/${topicSlug}/near/${message.id}`;
  }
  // DM: omit the link rather than build a fragile recipient slug
  // (Zulip's DM permalink shape varies by server version). The quote
  // still works as plain `said:` — the body is the important part.
  return null;
}

function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]+/g, "");
}

function stripTrailingSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}
