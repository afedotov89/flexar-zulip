// Flexar Hub Web — message content renderer (Phase 1.7).
//
// Renders a message's `rendered_content` — Zulip's server-side
// Markdown-to-HTML output — safely, themed, and interactive where the
// content needs behaviour. This replaces the Phase 1.6 plain-text
// placeholder; the component name and props are unchanged so
// `MessageRow`'s layout is untouched.
//
// Pipeline:
//
//   1. SANITISE. `Message.content` is untrusted, message-grade HTML.
//      `sanitizeRenderedContent` (the app's XSS boundary) runs it
//      through DOMPurify with a strict allowlist before it can reach
//      the DOM. Only the sanitised string is ever injected.
//   2. INJECT. The sanitised string goes in via `dangerouslySetInnerHTML`
//      — safe by construction now, and the only practical way to keep
//      Zulip's exact class/structure contract that the CSS and the
//      interactive handlers below depend on.
//   3. DECORATE. After injection, `decorateSpoilers` makes spoiler
//      headers keyboard-operable toggles and `decorateLinks` gives
//      external links a safe new-tab target — both done on trusted,
//      post-sanitisation nodes.
//   4. DELEGATE. A single click + keydown handler on the container
//      provides behaviour for the interactive bits — spoilers, in-app
//      narrow links — instead of per-element handlers. This matches the
//      project's "no inline handlers, use event delegation" stance and
//      survives content re-renders cleanly.
//
// Styling lives in `MessageContent.module.css`: the server HTML carries
// fixed class names (`.user-mention`, `.spoiler-block`, `.codehilite`,
// `.katex`, …), targeted with `:global()` selectors scoped under the
// component's root class. Code blocks and KaTeX are styled purely as
// CSS over the server's pre-rendered markup — no client-side highlighter
// or math renderer is involved.

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useNarrowNavigation } from "../../lib/narrow";
import {
  parseNarrowLink,
  sanitizeRenderedContent,
} from "../../lib/renderedContent";
import { useLightboxStore } from "../lightbox";
import { useRealmStore } from "../../stores/realmStore";
import { decorateEmojis } from "./renderedContent/emoji";
import { decorateLinks } from "./renderedContent/links";
import { decorateSpoilers, toggleSpoiler } from "./renderedContent/spoilers";
import styles from "./MessageContent.module.css";

export interface MessageContentProps {
  /** The message's server-rendered HTML body (untrusted). */
  content: string;
}

// Zulip's renderer emits spoiler headers with this class.
const SPOILER_HEADER_CLASS = "spoiler-header";

/**
 * Renders a message body: sanitised `rendered_content`, themed, with
 * spoilers and links wired up via event delegation.
 */
export function MessageContent({
  content,
}: MessageContentProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const realmUrl = useRealmStore((state) => state.realm?.realm_url);
  const { goToNarrow } = useNarrowNavigation();
  const openLightbox = useLightboxStore((s) => s.openImage);

  // Sanitise once per content string. This is the XSS boundary: the
  // result, and only the result, is injected into the DOM below.
  const sanitizedHtml = useMemo(
    () => sanitizeRenderedContent(content),
    [content],
  );

  // After the sanitised HTML is in the DOM, decorate it: make spoiler
  // headers accessible toggles, give external links a safe new-tab
  // target. Re-runs whenever the content (and hence the nodes) change;
  // both decorators are idempotent.
  useEffect(() => {
    const container = containerRef.current;
    if (container !== null) {
      decorateSpoilers(container);
      decorateLinks(container, realmUrl);
      decorateEmojis(container);
    }
  }, [sanitizedHtml, realmUrl]);

  // One delegated click handler for the whole message body, routing by
  // click target:
  //
  //   - on a link: if it is an in-app narrow link, route the SPA
  //     instead of navigating; otherwise let the browser handle it
  //     (the link already carries safe `target`/`rel` from decoration).
  //   - inside a spoiler header (and not on a link): toggle the spoiler.
  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;

      // Links inside a spoiler header must behave as links, not toggle
      // the spoiler — so check for an enclosing anchor first.
      const anchor = target.closest("a");
      if (anchor !== null) {
        const narrow = parseNarrowLink(
          anchor.getAttribute("href") ?? "",
          realmUrl,
        );
        if (narrow !== null) {
          event.preventDefault();
          goToNarrow(narrow);
        }
        return;
      }

      // Click on an inline image — open the lightbox (Phase 4.2). Skip
      // emoji `<img>`s rendered in message bodies (custom realm emoji
      // and the inline emoji decorator) — these are tiny inline tokens,
      // not media. Zulip's renderer marks them with the `emoji` class.
      if (
        target instanceof HTMLImageElement &&
        !target.classList.contains("emoji")
      ) {
        event.preventDefault();
        // The server may emit relative `/user_uploads/...` URLs;
        // `target.src` resolves them against the document, which is
        // what the `<img>` in the lightbox needs.
        openLightbox(target.src, target.alt);
        return;
      }

      const spoilerHeader = target.closest(`.${SPOILER_HEADER_CLASS}`);
      if (spoilerHeader instanceof HTMLElement) {
        toggleSpoiler(spoilerHeader);
      }
    },
    [goToNarrow, realmUrl, openLightbox],
  );

  // Keyboard activation of spoilers: Enter / Space on a focused spoiler
  // header toggles it, mirroring the click path.
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }
      const target = event.target as HTMLElement;
      const spoilerHeader = target.closest(`.${SPOILER_HEADER_CLASS}`);
      if (spoilerHeader instanceof HTMLElement) {
        event.preventDefault();
        toggleSpoiler(spoilerHeader);
      }
    },
    [],
  );

  return (
    <div
      ref={containerRef}
      className={styles.content}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      // Safe by construction: `sanitizedHtml` is the output of
      // `sanitizeRenderedContent` (DOMPurify, strict allowlist). Raw
      // `content` is never injected.
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
}
