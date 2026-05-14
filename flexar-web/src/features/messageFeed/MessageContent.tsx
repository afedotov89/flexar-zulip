// Flexar Hub Web — message content renderer (Phase 1.6 seam).
//
// ⚠️ PHASE 1.7 SEAM — READ BEFORE CHANGING ⚠️
//
// `Message.content` is server-rendered, *untrusted* HTML. Hydrating it
// safely — sanitising it and turning it into React elements, wiring up
// mentions / emoji / code blocks / spoilers — is the whole job of
// Phase 1.7. It is deliberately NOT done here.
//
// For Phase 1.6 this component renders the message as **plain text**:
// it strips the HTML tags and shows the textual content, so the feed
// is fully functional and demonstrable without ever putting untrusted
// HTML into the DOM. There is **no `dangerouslySetInnerHTML`** in this
// file, and there must not be one until Phase 1.7 replaces this body
// with the real sanitized-hydration pipeline.
//
// Phase 1.7's contract: keep this component's name and props
// (`MessageContent({ content })`) so the feed's row layout does not
// change; swap only the *body* — the tag-stripping below — for the
// sanitiser + element tree.

import styles from "./MessageContent.module.css";

export interface MessageContentProps {
  /** The message's server-rendered HTML body (untrusted). */
  content: string;
}

// Strip HTML tags and decode the handful of entities Zulip's renderer
// emits in text positions, yielding a plain-text approximation of the
// message. This is a *temporary* 1.6 measure — see the file header.
//
// Done with a detached DOM node rather than a regex: setting
// `innerHTML` on an element that is never inserted into the document
// parses the markup without executing it (no scripts run, no resources
// load), and reading `textContent` back gives correctly-decoded text.
// In the node test environment `document` is present (jsdom), so this
// works there too.
function htmlToPlainText(html: string): string {
  if (typeof document === "undefined") {
    // Defensive: no DOM at all. Fall back to a coarse tag strip.
    return html.replace(/<[^>]*>/g, "").trim();
  }
  const parser = document.createElement("div");
  parser.innerHTML = html;
  return (parser.textContent ?? "").trim();
}

/**
 * Renders a message body. Phase 1.6: plain text only (tags stripped).
 * Phase 1.7 replaces the body with sanitized HTML hydration — see the
 * file header.
 */
export function MessageContent({
  content,
}: MessageContentProps): React.JSX.Element {
  const text = htmlToPlainText(content);
  return <div className={styles.content}>{text}</div>;
}
