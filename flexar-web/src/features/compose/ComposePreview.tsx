// Flexar Hub Web — compose preview pane (Phase 2.1).
//
// Renders a server-rendered HTML preview of the user's draft Markdown.
// Client-side Markdown rendering would duplicate Zulip's server-side
// renderer, so we ask the server (`apiClient.renderMarkdown`) and pass
// the result through `sanitizeRenderedContent` — the same DOMPurify
// XSS boundary that `MessageContent` uses for fetched message bodies.
//
// We do not import `MessageContent` itself because it lives in the
// `messageFeed` feature and is not part of compose's allowed file
// surface for this phase. The decoration helpers (spoilers, in-app
// narrow link routing) are deliberately omitted from the preview —
// the user is previewing their own draft, not interacting with a
// posted message — so a sanitised innerHTML render is sufficient.
//
// State machine:
//
//   - empty content    → "Nothing to preview." hint, no request.
//   - debouncing       → keep showing the previous render (avoids a
//                        flicker on every keystroke).
//   - in-flight        → keep showing the previous render.
//   - error            → a `Banner` with the server error text.

import { useEffect, useMemo, useRef, useState } from "react";
import { Banner } from "../../components/Banner";
import { apiClient, isApiError } from "../../api";
import { sanitizeRenderedContent } from "../../lib/renderedContent";
import styles from "./ComposePreview.module.css";

export interface ComposePreviewProps {
  /** The current draft content (Markdown). */
  content: string;
}

const PREVIEW_DEBOUNCE_MS = 300;

interface PreviewState {
  /** The most recent successfully rendered HTML, or null if none yet. */
  html: string | null;
  error: string | null;
}

export function ComposePreview({
  content,
}: ComposePreviewProps): React.JSX.Element {
  const trimmed = content.trim();
  const [state, setState] = useState<PreviewState>({ html: null, error: null });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (trimmed === "") {
      setState({ html: null, error: null });
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      apiClient
        .renderMarkdown(trimmed)
        .then((html) => {
          if (!cancelled) {
            setState({ html, error: null });
          }
        })
        .catch((cause: unknown) => {
          if (cancelled) {
            return;
          }
          const message = isApiError(cause)
            ? (cause.body?.msg ?? cause.message)
            : "Could not render preview.";
          setState((current) => ({ html: current.html, error: message }));
        });
    }, PREVIEW_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmed]);

  // Sanitise once per html change. This is the XSS boundary: the result
  // — and only the result — goes into `dangerouslySetInnerHTML`.
  const sanitizedHtml = useMemo(
    () => (state.html === null ? "" : sanitizeRenderedContent(state.html)),
    [state.html],
  );

  if (trimmed === "") {
    return (
      <div className={styles.preview}>
        <p className={styles.placeholder}>Nothing to preview.</p>
      </div>
    );
  }

  return (
    <div className={styles.preview}>
      {state.error !== null && (
        <div className={styles.errorRow}>
          <Banner tone="danger" onDismiss={undefined}>
            {state.error}
          </Banner>
        </div>
      )}
      {state.html !== null && (
        <div
          ref={containerRef}
          className={styles.body}
          // Safe by construction: `sanitizedHtml` is the output of
          // `sanitizeRenderedContent` (DOMPurify, strict allowlist).
          // `state.html` (the raw server response) is never injected.
          dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
        />
      )}
    </div>
  );
}
