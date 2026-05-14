// Tests for `MessageContent` — the rendered-message-body component.
//
// `MessageContent` sanitises Zulip's `rendered_content`, injects it,
// and wires up interactivity via event delegation. These tests cover
// the behaviour that the sanitiser/codec unit tests cannot: that the
// sanitised content actually reaches the DOM, that spoilers toggle on
// click *and* keyboard, that an in-app narrow link routes the SPA
// instead of navigating away, and that external links get a safe
// new-tab target.
//
// `user-event` is not installed; interactions use `fireEvent`.

import { render, screen, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";
import { useRealmStore } from "../../stores/realmStore";
import { MessageContent } from "./MessageContent";

const REALM_URL = "https://chat.example.com";

// Mount `MessageContent` under a router, with the realm store seeded so
// narrow-link detection has an origin to match. Renders the current
// pathname alongside, so a test can assert in-app navigation happened.
function renderContent(content: string) {
  useRealmStore.setState({ realm: { realm_url: REALM_URL } });
  const utils = render(
    <MemoryRouter initialEntries={["/narrow"]}>
      <MessageContent content={content} />
      <LocationProbe />
    </MemoryRouter>,
  );
  return utils;
}

function LocationProbe() {
  const { pathname } = useLocation();
  return <div data-testid="pathname">{pathname}</div>;
}

afterEach(() => {
  useRealmStore.setState({ realm: null });
});

describe("MessageContent — rendering", () => {
  it("renders sanitised content and strips dangerous markup", () => {
    const { container } = renderContent(
      '<p>safe text</p><script>alert("xss")</script>',
    );
    expect(screen.getByText("safe text")).toBeInTheDocument();
    expect(container.querySelector("script")).toBeNull();
  });

  it("renders rich markup: a code block and a mention", () => {
    const { container } = renderContent(
      '<p>see <span class="user-mention" data-user-id="9">@Bob</span></p>' +
        '<div class="codehilite"><pre><code>x = 1</code></pre></div>',
    );
    expect(container.querySelector(".user-mention")?.textContent).toBe(
      "@Bob",
    );
    expect(container.querySelector(".codehilite code")?.textContent).toBe(
      "x = 1",
    );
  });
});

describe("MessageContent — spoilers", () => {
  const SPOILER_HTML =
    '<div class="spoiler-block">' +
    '<div class="spoiler-header"><p>Spoiler</p></div>' +
    '<div class="spoiler-content" aria-hidden="true">' +
    "<p>the secret</p></div></div>";

  it("decorates the spoiler header as an accessible, collapsed toggle", () => {
    const { container } = renderContent(SPOILER_HTML);
    const header = container.querySelector(".spoiler-header");
    expect(header?.getAttribute("role")).toBe("button");
    expect(header?.getAttribute("tabindex")).toBe("0");
    expect(header?.getAttribute("aria-expanded")).toBe("false");
    const body = container.querySelector(".spoiler-content");
    expect(header?.getAttribute("aria-controls")).toBe(body?.id);
    expect(body?.classList.contains("spoiler-content-open")).toBe(false);
  });

  it("toggles the spoiler open and closed on click", () => {
    const { container } = renderContent(SPOILER_HTML);
    const header = container.querySelector(".spoiler-header") as HTMLElement;
    const body = container.querySelector(".spoiler-content") as HTMLElement;

    fireEvent.click(header);
    expect(header.getAttribute("aria-expanded")).toBe("true");
    expect(body.getAttribute("aria-hidden")).toBe("false");
    expect(body.classList.contains("spoiler-content-open")).toBe(true);

    fireEvent.click(header);
    expect(header.getAttribute("aria-expanded")).toBe("false");
    expect(body.getAttribute("aria-hidden")).toBe("true");
    expect(body.classList.contains("spoiler-content-open")).toBe(false);
  });

  it("toggles the spoiler with the Enter and Space keys", () => {
    const { container } = renderContent(SPOILER_HTML);
    const header = container.querySelector(".spoiler-header") as HTMLElement;

    fireEvent.keyDown(header, { key: "Enter" });
    expect(header.getAttribute("aria-expanded")).toBe("true");

    fireEvent.keyDown(header, { key: " " });
    expect(header.getAttribute("aria-expanded")).toBe("false");
  });
});

describe("MessageContent — links", () => {
  it("routes an in-app narrow link through the SPA router", () => {
    const { container } = renderContent(
      '<p><a class="stream" data-stream-id="7" ' +
        'href="/#narrow/channel/7-general">#general</a></p>',
    );
    const link = container.querySelector("a") as HTMLAnchorElement;
    // In-app links are left as same-document anchors (no new tab).
    expect(link.getAttribute("target")).toBeNull();

    fireEvent.click(link);
    // The SPA routes to the channel narrow. The codec emits bare
    // channel ids (the `-general` slug is decorative and dropped).
    expect(screen.getByTestId("pathname").textContent).toBe(
      "/narrow/channel/7",
    );
  });

  it("gives an external link a safe new-tab target", () => {
    const { container } = renderContent(
      '<p><a href="https://example.org/page">external</a></p>',
    );
    const link = container.querySelector("a") as HTMLAnchorElement;
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");

    // Clicking does not route the SPA — the pathname is unchanged.
    fireEvent.click(link);
    expect(screen.getByTestId("pathname").textContent).toBe("/narrow");
  });

  it("does not toggle a spoiler when a link inside its header is clicked", () => {
    const { container } = renderContent(
      '<div class="spoiler-block">' +
        '<div class="spoiler-header">' +
        '<p>see <a href="https://example.org">link</a></p></div>' +
        '<div class="spoiler-content" aria-hidden="true">' +
        "<p>body</p></div></div>",
    );
    const header = container.querySelector(".spoiler-header") as HTMLElement;
    const link = container.querySelector("a") as HTMLAnchorElement;

    fireEvent.click(link);
    // The link click is handled as a link, not as a spoiler toggle.
    expect(header.getAttribute("aria-expanded")).toBe("false");
  });
});
