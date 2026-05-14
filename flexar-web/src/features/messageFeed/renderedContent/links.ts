// Flexar Hub Web — link handling for rendered message content.
//
// Links inside a message fall into two kinds:
//
//   - In-app narrow links — Zulip `#narrow/…` links into the realm.
//     These are routed within the SPA; detection + decoding lives in
//     `src/lib/renderedContent/narrowLink`, and `MessageContent`'s
//     delegated click handler does the routing.
//   - Everything else — external links, plain web URLs. These open in
//     a new browser tab. To do that safely they need `target="_blank"`
//     with `rel="noopener noreferrer"` so the opened page cannot reach
//     back into this app via `window.opener`.
//
// `decorateLinks` applies that safe `target`/`rel` to external links
// once the sanitised HTML is in the DOM. (The sanitiser deliberately
// does not allowlist `target`, so it is added here, on trusted,
// post-sanitisation nodes only.) In-app narrow links are left as plain
// same-document anchors: the delegated handler intercepts their click
// and routes instead, and if interception ever fails they degrade to a
// normal in-page navigation rather than a new tab.

import type { Narrow } from "../../../domain";
import { parseNarrowLink } from "../../../lib/renderedContent";

// Marks an anchor as already processed so re-running `decorateLinks`
// is idempotent across content re-renders.
const DECORATED_FLAG = "data-link-decorated";

/**
 * Give every external link inside `container` a safe new-tab target.
 * In-app narrow links (recognised via `realmUrl`) are left untouched —
 * they are handled by the SPA router. Idempotent.
 */
export function decorateLinks(
  container: HTMLElement,
  realmUrl: string | undefined,
): void {
  const anchors = container.querySelectorAll<HTMLAnchorElement>("a[href]");
  for (const anchor of anchors) {
    if (anchor.getAttribute(DECORATED_FLAG) === "true") {
      continue;
    }
    anchor.setAttribute(DECORATED_FLAG, "true");

    const narrow: Narrow | null = parseNarrowLink(
      anchor.getAttribute("href") ?? "",
      realmUrl,
    );
    if (narrow !== null) {
      // In-app link: leave it as a same-document anchor; the delegated
      // click handler routes it. No new tab.
      continue;
    }

    // External link: open in a new tab, severed from this window.
    anchor.setAttribute("target", "_blank");
    anchor.setAttribute("rel", "noopener noreferrer");
  }
}
