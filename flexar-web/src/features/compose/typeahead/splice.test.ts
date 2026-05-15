// Tests for the typeahead splice helper.

import { describe, it, expect } from "vitest";
import { spliceTypeahead } from "./splice";

describe("spliceTypeahead", () => {
  it("replaces the trigger+query slice with the replacement and a trailing space", () => {
    const out = spliceTypeahead({
      value: "hi @al",
      start: 3,
      end: 6,
      replacement: "@**Alice**",
    });
    expect(out.value).toBe("hi @**Alice** ");
    expect(out.cursor).toBe("hi @**Alice** ".length);
  });

  it("does not double the space when one is already present after the token", () => {
    const out = spliceTypeahead({
      value: "hi @al world",
      start: 3,
      end: 6,
      replacement: "@**Alice**",
    });
    expect(out.value).toBe("hi @**Alice** world");
    // Cursor lands right after the inserted text (no extra space added).
    expect(out.cursor).toBe("hi @**Alice**".length);
  });

  it("does not add a space before a newline", () => {
    const out = spliceTypeahead({
      value: "@al\nnext line",
      start: 0,
      end: 3,
      replacement: "@**Alice**",
    });
    expect(out.value).toBe("@**Alice**\nnext line");
    expect(out.cursor).toBe("@**Alice**".length);
  });

  it("works for emoji shortcodes", () => {
    const out = spliceTypeahead({
      value: "lol :sm",
      start: 4,
      end: 7,
      replacement: ":smile:",
    });
    expect(out.value).toBe("lol :smile: ");
    expect(out.cursor).toBe("lol :smile: ".length);
  });

  it("works for channel mentions", () => {
    const out = spliceTypeahead({
      value: "see #en",
      start: 4,
      end: 7,
      replacement: "#**engineering**",
    });
    expect(out.value).toBe("see #**engineering** ");
    expect(out.cursor).toBe("see #**engineering** ".length);
  });
});
