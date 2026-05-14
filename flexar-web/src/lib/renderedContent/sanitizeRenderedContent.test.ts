// Tests for `sanitizeRenderedContent` — the XSS boundary for Zulip's
// server-rendered message HTML.
//
// Two halves, both essential:
//
//   - MALICIOUS INPUT IS NEUTRALISED. Scripts, event-handler
//     attributes, `javascript:` URLs, embedding elements and unknown
//     tags must not survive into the output. A regression here is a
//     stored-XSS hole, so the cases are deliberately exhaustive.
//   - LEGITIMATE MARKUP SURVIVES. Everything Zulip's renderer actually
//     emits — code blocks, mentions, emoji, spoilers, KaTeX, links,
//     tables, lists — must pass through intact, or messages render
//     broken.
//
// `DOMPurify.sanitize` returns a string; assertions parse it back into
// a detached DOM (via the helper below) so structure can be queried,
// and also check the raw string for the absence of dangerous tokens.

import { describe, expect, it } from "vitest";
import { sanitizeRenderedContent } from "./sanitizeRenderedContent";

// Parse a sanitised HTML string into a detached element for querying.
function parse(html: string): HTMLElement {
  const root = document.createElement("div");
  root.innerHTML = html;
  return root;
}

describe("sanitizeRenderedContent — malicious input", () => {
  it("strips <script> tags and their contents", () => {
    const out = sanitizeRenderedContent(
      '<p>hi</p><script>alert("xss")</script>',
    );
    expect(out).not.toContain("<script");
    expect(out).not.toContain("alert");
    expect(parse(out).querySelector("p")?.textContent).toBe("hi");
  });

  it("strips inline event-handler attributes", () => {
    const out = sanitizeRenderedContent(
      '<p onclick="steal()" onmouseover="steal()">text</p>',
    );
    expect(out).not.toContain("onclick");
    expect(out).not.toContain("onmouseover");
    expect(out).not.toContain("steal");
    expect(parse(out).querySelector("p")?.textContent).toBe("text");
  });

  it("strips img onerror handlers", () => {
    const out = sanitizeRenderedContent(
      '<img src="x" onerror="alert(1)" alt="broken">',
    );
    expect(out).not.toContain("onerror");
    expect(out).not.toContain("alert");
  });

  it("drops javascript: URLs on links", () => {
    const out = sanitizeRenderedContent(
      '<a href="javascript:alert(1)">click</a>',
    );
    const anchor = parse(out).querySelector("a");
    // The link text is preserved, but the dangerous href is removed.
    expect(anchor?.getAttribute("href")).toBeNull();
    expect(out).not.toContain("javascript:");
  });

  it("drops data: URLs that could smuggle markup", () => {
    const out = sanitizeRenderedContent(
      '<a href="data:text/html,<script>alert(1)</script>">x</a>',
    );
    expect(out).not.toContain("data:text/html");
    expect(out).not.toContain("<script");
  });

  it("removes <iframe>, <object>, <embed>, <form>", () => {
    const out = sanitizeRenderedContent(
      '<iframe src="evil"></iframe>' +
        '<object data="evil"></object>' +
        '<embed src="evil">' +
        "<form><input></form>",
    );
    expect(out).not.toContain("<iframe");
    expect(out).not.toContain("<object");
    expect(out).not.toContain("<embed");
    expect(out).not.toContain("<form");
    expect(out).not.toContain("<input");
  });

  it("removes <style> tags and their contents", () => {
    const out = sanitizeRenderedContent(
      "<style>body { display: none }</style><p>visible</p>",
    );
    expect(out).not.toContain("<style");
    expect(out).not.toContain("display: none");
    expect(parse(out).querySelector("p")?.textContent).toBe("visible");
  });

  it("drops unknown / non-allowlisted tags but keeps their text", () => {
    const out = sanitizeRenderedContent(
      "<custom-element><marquee>scrolling</marquee></custom-element>",
    );
    expect(out).not.toContain("<custom-element");
    expect(out).not.toContain("<marquee");
    expect(out).toContain("scrolling");
  });

  it("strips non-allowlisted attributes such as a bare style on text", () => {
    // `style` is allowlisted (KaTeX needs it) but DOMPurify still
    // sanitises its value — a url() in a style value is removed.
    const out = sanitizeRenderedContent(
      '<p style="background: url(javascript:alert(1))">x</p>',
    );
    expect(out).not.toContain("javascript:");
  });
});

describe("sanitizeRenderedContent — legitimate Zulip markup", () => {
  it("keeps basic block text: paragraphs, headings, lists, blockquote", () => {
    const html =
      "<h1>Title</h1><p>A paragraph.</p>" +
      "<ul><li>one</li><li>two</li></ul>" +
      "<ol><li>first</li></ol>" +
      "<blockquote><p>quoted</p></blockquote><hr>";
    const out = sanitizeRenderedContent(html);
    const root = parse(out);
    expect(root.querySelector("h1")?.textContent).toBe("Title");
    expect(root.querySelectorAll("ul li")).toHaveLength(2);
    expect(root.querySelector("ol li")?.textContent).toBe("first");
    expect(root.querySelector("blockquote p")?.textContent).toBe("quoted");
    expect(root.querySelector("hr")).not.toBeNull();
  });

  it("keeps inline and fenced code blocks with highlight markup", () => {
    const html =
      "<p>inline <code>x = 1</code></p>" +
      '<div class="codehilite" data-code-language="Python">' +
      '<pre><span></span><code><span class="k">def</span> ' +
      '<span class="nf">f</span>():</code></pre></div>';
    const out = sanitizeRenderedContent(html);
    const root = parse(out);
    expect(root.querySelector("code")?.textContent).toBe("x = 1");
    const codehilite = root.querySelector(".codehilite");
    expect(codehilite?.getAttribute("data-code-language")).toBe("Python");
    // Pygments token-class spans survive — the CSS highlights them.
    expect(codehilite?.querySelector("span.k")?.textContent).toBe("def");
  });

  it("keeps user, group and topic mentions with their data attributes", () => {
    const html =
      '<span class="user-mention" data-user-id="42">@Alice</span>' +
      '<span class="user-group-mention" data-user-group-id="7">@team</span>' +
      '<span class="topic-mention">@topic</span>';
    const out = sanitizeRenderedContent(html);
    const root = parse(out);
    expect(
      root.querySelector(".user-mention")?.getAttribute("data-user-id"),
    ).toBe("42");
    expect(
      root
        .querySelector(".user-group-mention")
        ?.getAttribute("data-user-group-id"),
    ).toBe("7");
    expect(root.querySelector(".topic-mention")?.textContent).toBe("@topic");
  });

  it("keeps unicode-emoji spans and realm-emoji images", () => {
    const html =
      '<span aria-label="smile" class="emoji emoji-1f604" role="img" ' +
      'title="smile">:smile:</span>' +
      '<img alt=":custom:" class="emoji" src="/user_avatars/emoji/custom.png" ' +
      'title="custom">';
    const out = sanitizeRenderedContent(html);
    const root = parse(out);
    const span = root.querySelector("span.emoji");
    expect(span?.getAttribute("role")).toBe("img");
    expect(span?.getAttribute("aria-label")).toBe("smile");
    const img = root.querySelector("img.emoji");
    expect(img?.getAttribute("src")).toBe(
      "/user_avatars/emoji/custom.png",
    );
    expect(img?.getAttribute("alt")).toBe(":custom:");
  });

  it("keeps the spoiler block structure", () => {
    const html =
      '<div class="spoiler-block">' +
      '<div class="spoiler-header"><p>Header</p></div>' +
      '<div class="spoiler-content" aria-hidden="true">' +
      "<p>hidden body</p></div></div>";
    const out = sanitizeRenderedContent(html);
    const root = parse(out);
    expect(root.querySelector(".spoiler-block")).not.toBeNull();
    expect(root.querySelector(".spoiler-header p")?.textContent).toBe(
      "Header",
    );
    const content = root.querySelector(".spoiler-content");
    expect(content?.getAttribute("aria-hidden")).toBe("true");
    expect(content?.textContent).toContain("hidden body");
  });

  it("keeps KaTeX server-rendered markup including inline styles", () => {
    // KaTeX positions its glyphs with inline `style`; the MathML
    // annotation must survive too (copy-paste / AT access).
    const html =
      '<span class="katex"><span class="katex-mathml">' +
      "<math><semantics><mrow><mi>x</mi></mrow>" +
      '<annotation encoding="application/x-tex">x</annotation>' +
      "</semantics></math></span>" +
      '<span class="katex-html" aria-hidden="true">' +
      '<span class="base" style="height:0.43em;">' +
      '<span class="mord mathnormal">x</span></span></span></span>';
    const out = sanitizeRenderedContent(html);
    const root = parse(out);
    expect(root.querySelector(".katex")).not.toBeNull();
    expect(root.querySelector("math annotation")?.textContent).toBe("x");
    // The inline style KaTeX relies on for layout is preserved.
    expect(root.querySelector(".base")?.getAttribute("style")).toContain(
      "height",
    );
  });

  it("keeps safe links: http(s), mailto, relative and narrow hashes", () => {
    const html =
      '<a href="https://example.com">ext</a>' +
      '<a href="mailto:a@b.com">mail</a>' +
      '<a class="stream" data-stream-id="3" href="/#narrow/channel/3-general">' +
      "#general</a>";
    const out = sanitizeRenderedContent(html);
    const root = parse(out);
    const links = root.querySelectorAll("a");
    expect(links).toHaveLength(3);
    expect(links[0].getAttribute("href")).toBe("https://example.com");
    expect(links[1].getAttribute("href")).toBe("mailto:a@b.com");
    const streamLink = root.querySelector("a.stream");
    expect(streamLink?.getAttribute("data-stream-id")).toBe("3");
    expect(streamLink?.getAttribute("href")).toBe(
      "/#narrow/channel/3-general",
    );
  });

  it("keeps tables with their full structure", () => {
    const html =
      "<table><thead><tr><th>H</th></tr></thead>" +
      "<tbody><tr><td>cell</td></tr></tbody></table>";
    const out = sanitizeRenderedContent(html);
    const root = parse(out);
    expect(root.querySelector("table thead th")?.textContent).toBe("H");
    expect(root.querySelector("table tbody td")?.textContent).toBe("cell");
  });

  it("keeps <time> elements with their datetime attribute", () => {
    const html =
      '<time datetime="2026-05-15T10:00:00Z">2026-05-15T10:00:00Z</time>';
    const out = sanitizeRenderedContent(html);
    const time = parse(out).querySelector("time");
    expect(time?.getAttribute("datetime")).toBe("2026-05-15T10:00:00Z");
  });

  it("is idempotent — sanitising already-clean output is a no-op", () => {
    const html = '<p>hello <code>code</code> <strong>bold</strong></p>';
    const once = sanitizeRenderedContent(html);
    const twice = sanitizeRenderedContent(once);
    expect(twice).toBe(once);
  });
});
