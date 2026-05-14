// Flexar Hub Web — sanitiser for Zulip's server-rendered message HTML.
//
// `Message.content` (fetched with markdown applied) is HTML produced by
// Zulip's server-side Markdown renderer. It is *untrusted*,
// message-grade content: any realm member can put arbitrary Markdown —
// and, through edge cases or a compromised server, arbitrary HTML —
// into it. Before that string is ever handed to the DOM (via
// `dangerouslySetInnerHTML`), it MUST pass through this sanitiser.
// This is the application's XSS boundary for message content.
//
// The approach is a *strict allowlist*: DOMPurify is configured to keep
// only the tags and attributes Zulip's renderer is known to emit, and
// to drop everything else. The allowlist is deliberately narrow — it is
// easier to add a tag when we discover Zulip emits it than to reason
// about the blast radius of an over-broad list. Every entry below is
// justified against a specific renderer feature.
//
// What the allowlist covers, mapped to Zulip's renderer
// (`zerver/lib/markdown/`) and the classes in its
// `rendered_markdown.css`:
//
//   - Block text:      p, br, hr, h1–h6, blockquote, pre, code
//   - Lists:           ul, ol, li
//   - Inline emphasis: strong, em, del, span (mentions, emoji,
//                      timestamps, KaTeX, code-highlight tokens)
//   - Tables:          table, thead, tbody, tr, th, td
//   - Links & media:   a, img
//   - Math:            the KaTeX subtree — KaTeX renders server-side to
//                      a `<span class="katex">` tree containing MathML
//                      (math, semantics, annotation, mrow, mi, …) and
//                      an HTML span tree; both are kept.
//
// Hard exclusions (the security-relevant ones): no `<script>`,
// `<style>`, `<iframe>`, `<object>`, `<embed>`, `<form>` or other
// active/embedding elements; no `on*` event-handler attributes;
// `javascript:` and other dangerous URI schemes are rejected by
// DOMPurify's built-in URI policy plus our explicit `ALLOWED_URI_REGEXP`
// (http, https, mailto, and root-relative paths only). `<a target>` is
// not allowlisted here; we re-add a safe `target`/`rel` ourselves at
// render time, not in the sanitiser.

import DOMPurify from "dompurify";

// Tags the sanitiser keeps. Anything not in this set is removed (its
// text content is preserved by DOMPurify unless it is a known
// dangerous tag). Grouped by renderer feature for auditability.
const ALLOWED_TAGS: readonly string[] = [
  // Block-level text structure. `div` is load-bearing in Zulip's
  // renderer: it wraps code blocks (`.codehilite`), spoiler blocks
  // (`.spoiler-block` / `.spoiler-header` / `.spoiler-content`), link
  // previews and image galleries.
  "div",
  "p",
  "br",
  "hr",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "blockquote",
  "pre",
  "code",
  // Lists.
  "ul",
  "ol",
  "li",
  // Inline emphasis and generic inline containers. `span` carries
  // mentions, emoji, timestamps, KaTeX nodes and Pygments
  // code-highlight tokens; `time` is Zulip's `<time:…>` syntax.
  "strong",
  "em",
  "del",
  "span",
  "time",
  // Tables.
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  // Links and images (emoji images, inline image previews).
  "a",
  "img",
  // KaTeX MathML subtree. KaTeX emits a full MathML tree alongside its
  // styled-HTML span tree; keeping it preserves copy-paste and AT
  // access to the math. These are namespaced elements DOMPurify knows.
  "math",
  "semantics",
  "annotation",
  "annotation-xml",
  "mrow",
  "mi",
  "mn",
  "mo",
  "ms",
  "mtext",
  "mspace",
  "msup",
  "msub",
  "msubsup",
  "mfrac",
  "msqrt",
  "mroot",
  "munder",
  "mover",
  "munderover",
  "mtable",
  "mtr",
  "mtd",
  "mpadded",
  "mphantom",
  "menclose",
  "mstyle",
  "merror",
];

// Attributes the sanitiser keeps. The class/data-* attributes are the
// *contract* between Zulip's renderer and our CSS + event delegation:
// `.user-mention[data-user-id]`, `.spoiler-block`, `.codehilite`,
// `.emoji`, `.katex` and so on. `style` is allowed ONLY because KaTeX's
// server-rendered HTML positions its glyphs with inline `style`
// (heights, vertical offsets) and is unusable without it — DOMPurify
// still parses and sanitises those style values, dropping anything with
// a URL or expression. No `style` attribute can carry script.
const ALLOWED_ATTR: readonly string[] = [
  // Universal: classes drive all our styling/behaviour hooks.
  "class",
  "title",
  // Links.
  "href",
  // Images.
  "src",
  "alt",
  "width",
  "height",
  // Accessibility attributes Zulip's renderer sets (emoji `role="img"`
  // + `aria-label`, spoiler `aria-hidden`, etc.).
  "role",
  "aria-hidden",
  "aria-label",
  // `<time>` machine-readable value.
  "datetime",
  // Renderer data-* hooks: mention targets, code language, channel /
  // topic ids on stream links. Enumerated rather than `data-*`-wildcard
  // so the allowlist stays a closed, auditable set.
  "data-user-id",
  "data-user-group-id",
  "data-stream-id",
  "data-code-language",
  // KaTeX inline positioning — see the note above.
  "style",
  // MathML structural attributes.
  "encoding",
  "mathvariant",
  "displaystyle",
  "scriptlevel",
];

// Permitted URI schemes for `href` / `src`. Root-relative (`/…`) and
// fragment (`#…`) and plain relative paths are allowed; the only
// absolute schemes are http(s) and mailto. This rejects `javascript:`,
// `data:` (so a `data:text/html` link cannot smuggle markup), `vbscript:`
// and friends. Mirrors the spirit of Zulip's own `sanitize_url`.
const ALLOWED_URI_REGEXP = /^(?:https?:|mailto:|[^a-z]|[a-z+.-]+(?:[^a-z+.:-]|$))/i;

// `style` is allowlisted only for KaTeX, whose server-rendered HTML
// positions glyphs with inline length values (`height`, `width`,
// `margin`, `top`, `vertical-align`, …) — it never uses `url()`,
// `expression()`, `@import` or behaviours. DOMPurify does not deeply
// sanitise CSS property *values*, so this hook is the guard: any
// `style` attribute whose value contains a function-call / at-rule
// token that could fetch or execute is dropped wholesale. Legitimate
// KaTeX styles pass untouched; nothing dangerous can ride in on a
// `style` attribute.
const DANGEROUS_STYLE_TOKEN = /url\s*\(|expression\s*\(|javascript:|@import|behaviou?r\s*:/i;

let hookInstalled = false;

function installStyleGuardHook(): void {
  if (hookInstalled) {
    return;
  }
  hookInstalled = true;
  DOMPurify.addHook("uponSanitizeAttribute", (_node, data) => {
    if (data.attrName === "style" && DANGEROUS_STYLE_TOKEN.test(data.attrValue)) {
      data.keepAttr = false;
    }
  });
}

/**
 * Sanitise Zulip's server-rendered message HTML into a string that is
 * safe to inject via `dangerouslySetInnerHTML`.
 *
 * The result keeps only the strict allowlist of tags/attributes above;
 * scripts, event handlers, embedding elements and dangerous URI schemes
 * are removed. This is a pure function — same input, same output, no
 * DOM side effects (DOMPurify parses into a detached document).
 */
export function sanitizeRenderedContent(html: string): string {
  installStyleGuardHook();
  return DOMPurify.sanitize(html, {
    // The explicit allowlists below ARE the policy. Note: `ALLOWED_TAGS`
    // / `ALLOWED_ATTR` and `USE_PROFILES` are mutually exclusive in
    // DOMPurify — setting a profile makes it ignore the allowlists — so
    // no profile is used. The MathML elements KaTeX emits are listed in
    // `ALLOWED_TAGS` directly; SVG is deliberately absent (Zulip's
    // message renderer emits none, and SVG is a common XSS vector).
    ALLOWED_TAGS: [...ALLOWED_TAGS],
    ALLOWED_ATTR: [...ALLOWED_ATTR],
    ALLOWED_URI_REGEXP,
    // Drop, rather than escape, the contents of forbidden tags like
    // `<script>` / `<style>`: their text is not message content.
    FORBID_CONTENTS: ["script", "style"],
  });
}
