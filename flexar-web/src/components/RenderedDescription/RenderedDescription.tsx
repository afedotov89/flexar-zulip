// Renders server-side Zulip-flavored Markdown (channel descriptions,
// realm description, …) through the same XSS boundary as
// `MessageContent`, plus the emoji-class decoration that turns
// `<span class="emoji emoji-1f680">:rocket:</span>` into a real glyph.
//
// Why a separate primitive (not just reuse `MessageContent`):
//   - descriptions are inline, not message-body — they sit in
//     sidebars and one-line rows. `MessageContent` carries
//     message-grade CSS (paragraph spacing, code blocks, …) that
//     would look broken here.
//   - descriptions never spoil / lightbox / mention-narrow — the
//     delegated click handler on `MessageContent` would be dead
//     code for them.
//
// Same safety contract: `rendered_description` from the server is the
// only string we ever inject, and it goes through DOMPurify with the
// strict allowlist. `description` (the Markdown source) must NOT be
// passed here — wire `rendered_description` instead.

import { useEffect, useMemo, useRef } from "react";
import { sanitizeRenderedContent } from "../../lib/renderedContent";
import { decorateEmojis } from "../../features/messageFeed/renderedContent/emoji";
import styles from "./RenderedDescription.module.css";

export interface RenderedDescriptionProps {
  /** `Stream.rendered_description` from the server — already HTML. */
  html: string;
  /** Optional element tag; defaults to `span` (inline contexts). */
  as?: "span" | "div";
  className?: string;
}

export function RenderedDescription({
  html,
  as = "span",
  className,
}: RenderedDescriptionProps): React.JSX.Element {
  const sanitised = useMemo(() => sanitizeRenderedContent(html), [html]);
  const ref = useRef<HTMLElement>(null);

  // Decorate the rendered tree's `.emoji-<codepoint>` spans into real
  // glyphs — same effect chain `MessageContent` runs after every
  // sanitised re-render.
  useEffect(() => {
    if (ref.current !== null) {
      decorateEmojis(ref.current);
    }
  }, [sanitised]);

  const classes = [styles.description, className].filter(Boolean).join(" ");

  if (as === "div") {
    return (
      <div
        ref={ref as React.RefObject<HTMLDivElement>}
        className={classes}
        // Safe by construction — see file header.
        dangerouslySetInnerHTML={{ __html: sanitised }}
      />
    );
  }
  return (
    <span
      ref={ref as React.RefObject<HTMLSpanElement>}
      className={classes}
      dangerouslySetInnerHTML={{ __html: sanitised }}
    />
  );
}
