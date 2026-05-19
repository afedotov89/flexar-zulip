import { describe, expect, it } from "vitest";
import { resolveTopicsPolicy } from "./topicsPolicy";

describe("resolveTopicsPolicy", () => {
  it("returns 'mandatory' for disable_empty_topic regardless of realm", () => {
    expect(
      resolveTopicsPolicy({ topics_policy: "disable_empty_topic" }, {}),
    ).toBe("mandatory");
    expect(
      resolveTopicsPolicy(
        { topics_policy: "disable_empty_topic" },
        { realm_mandatory_topics: false },
      ),
    ).toBe("mandatory");
  });

  it("returns 'optional' for allow_empty_topic", () => {
    expect(
      resolveTopicsPolicy(
        { topics_policy: "allow_empty_topic" },
        { realm_mandatory_topics: true },
      ),
    ).toBe("optional");
  });

  it("returns 'empty_only' for empty_topic_only", () => {
    expect(
      resolveTopicsPolicy({ topics_policy: "empty_topic_only" }, {}),
    ).toBe("empty_only");
  });

  it("inherits realm policy when channel says inherit / undefined", () => {
    expect(
      resolveTopicsPolicy(
        { topics_policy: "inherit" },
        { realm_mandatory_topics: true },
      ),
    ).toBe("mandatory");
    expect(
      resolveTopicsPolicy(
        { topics_policy: "inherit" },
        { realm_mandatory_topics: false },
      ),
    ).toBe("optional");
    expect(resolveTopicsPolicy({}, undefined)).toBe("optional");
    expect(resolveTopicsPolicy(undefined, undefined)).toBe("optional");
  });
});
