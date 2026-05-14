// Tests for `parseNarrowLink` — detecting in-app Zulip narrow links
// inside rendered message content.
//
// The contract: a `#narrow/…` link into the realm decodes to a
// `Narrow`; an external link, a non-narrow link, or an unparseable
// narrow returns `null` so the caller opens it normally. Being
// conservative (returning `null`) is always the safe fallback.

import { describe, expect, it } from "vitest";
import { parseNarrowLink } from "./narrowLink";

const REALM = "https://chat.example.com";

describe("parseNarrowLink — in-app narrow links", () => {
  it("decodes a relative channel narrow hash", () => {
    const narrow = parseNarrowLink("/#narrow/channel/7-general", REALM);
    expect(narrow).toEqual([{ operator: "channel", operand: 7 }]);
  });

  it("decodes an absolute realm channel+topic narrow", () => {
    const narrow = parseNarrowLink(
      `${REALM}/#narrow/channel/7-general/topic/hello%20world`,
      REALM,
    );
    expect(narrow).toEqual([
      { operator: "channel", operand: 7 },
      { operator: "topic", operand: "hello world" },
    ]);
  });

  it("decodes a dm narrow", () => {
    const narrow = parseNarrowLink("/#narrow/dm/4,7", REALM);
    expect(narrow).toEqual([{ operator: "dm", operand: [4, 7] }]);
  });

  it("decodes the empty (combined feed) narrow hash", () => {
    expect(parseNarrowLink("/#narrow", REALM)).toEqual([]);
  });

  it("ignores the decorative channel slug, reading only the id", () => {
    const narrow = parseNarrowLink(
      "/#narrow/channel/12-some-renamed-channel",
      REALM,
    );
    expect(narrow).toEqual([{ operator: "channel", operand: 12 }]);
  });
});

describe("parseNarrowLink — links that must fall back to normal open", () => {
  it("returns null for an external link", () => {
    expect(parseNarrowLink("https://example.org/page", REALM)).toBeNull();
  });

  it("returns null for a cross-realm Zulip narrow link", () => {
    // Same `#narrow` shape, but a different origin — not our realm.
    expect(
      parseNarrowLink(
        "https://other-realm.zulipchat.com/#narrow/channel/1-x",
        REALM,
      ),
    ).toBeNull();
  });

  it("returns null for an in-realm link that is not a narrow", () => {
    expect(
      parseNarrowLink(`${REALM}/#settings/profile`, REALM),
    ).toBeNull();
    expect(parseNarrowLink(`${REALM}/user_uploads/x.png`, REALM)).toBeNull();
  });

  it("returns null for a malformed narrow operand (codec rejects it)", () => {
    // `channel` operand must be a numeric id; a bare word is malformed.
    expect(
      parseNarrowLink("/#narrow/channel/not-a-number", REALM),
    ).toBeNull();
  });

  it("returns null for a dangling operator with no operand", () => {
    expect(parseNarrowLink("/#narrow/channel", REALM)).toBeNull();
  });

  it("returns null for a malformed href", () => {
    expect(parseNarrowLink("ht!tp://[bad", REALM)).toBeNull();
  });

  it("returns null for an absolute link when the realm URL is unknown", () => {
    // With no realm URL, an absolute cross-origin link cannot be
    // verified as in-realm, so it falls back to a normal open.
    expect(
      parseNarrowLink("https://chat.example.com/#narrow/channel/7", undefined),
    ).toBeNull();
  });
});
