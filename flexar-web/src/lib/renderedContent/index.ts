// Flexar Hub Web — rendered message content helpers (Phase 1.7).
//
// Pure, reusable building blocks for safely displaying Zulip's
// server-rendered message HTML: the XSS-boundary sanitiser and the
// in-app narrow-link detector. The `MessageContent` feature component
// composes these; other surfaces that need to show `rendered_content`
// (topic links, edit history, …) can reuse them.

export { sanitizeRenderedContent } from "./sanitizeRenderedContent";
export { parseNarrowLink } from "./narrowLink";
export { unicodeFromEmojiClasses } from "./emojiCodepoint";
export { htmlToPlainText } from "./htmlToPlainText";
