// Unit tests for the search-query parser (Phase 3.1).

import { describe, expect, it } from "vitest";
import { parseSearchQuery } from "./parseQuery";

describe("parseSearchQuery", () => {
  it("returns the empty narrow for an empty / whitespace query", () => {
    expect(parseSearchQuery("")).toEqual([]);
    expect(parseSearchQuery("   ")).toEqual([]);
  });

  it("collapses bare words into a single search term", () => {
    expect(parseSearchQuery("hello world")).toEqual([
      { operator: "search", operand: "hello world" },
    ]);
  });

  it("parses from:/sender:, channel:/stream:, and topic:", () => {
    expect(parseSearchQuery("from:alice@example.com")).toEqual([
      { operator: "sender", operand: "alice@example.com" },
    ]);
    expect(parseSearchQuery("sender:alice@example.com")).toEqual([
      { operator: "sender", operand: "alice@example.com" },
    ]);
    expect(parseSearchQuery("channel:engineering")).toEqual([
      { operator: "channel", operand: "engineering" },
    ]);
    expect(parseSearchQuery("stream:11")).toEqual([
      { operator: "channel", operand: 11 },
    ]);
    expect(parseSearchQuery("topic:design")).toEqual([
      { operator: "topic", operand: "design" },
    ]);
  });

  it("parses is:, has:, near:, id:", () => {
    expect(parseSearchQuery("is:starred")).toEqual([
      { operator: "is", operand: "starred" },
    ]);
    expect(parseSearchQuery("has:link")).toEqual([
      { operator: "has", operand: "link" },
    ]);
    expect(parseSearchQuery("near:42")).toEqual([
      { operator: "near", operand: 42 },
    ]);
    expect(parseSearchQuery("id:42")).toEqual([
      { operator: "id", operand: 42 },
    ]);
  });

  it("parses dm:/pm-with: with a numeric id list as a sorted array", () => {
    expect(parseSearchQuery("dm:5,7")).toEqual([
      { operator: "dm", operand: [5, 7] },
    ]);
    expect(parseSearchQuery("pm-with:7,5")).toEqual([
      { operator: "dm", operand: [5, 7] },
    ]);
  });

  it("falls back to a string operand for dm: emails the server resolves", () => {
    expect(parseSearchQuery("dm:alice@example.com")).toEqual([
      { operator: "dm", operand: "alice@example.com" },
    ]);
  });

  it("parses dm-including: as the dm-including operator", () => {
    expect(parseSearchQuery("dm-including:5")).toEqual([
      { operator: "dm-including", operand: [5] },
    ]);
    expect(parseSearchQuery("group-pm-with:alice@example.com")).toEqual([
      { operator: "dm-including", operand: "alice@example.com" },
    ]);
  });

  it("supports negation with the leading - prefix", () => {
    expect(parseSearchQuery("-is:starred")).toEqual([
      { operator: "is", operand: "starred", negated: true },
    ]);
  });

  it("respects double-quoted values containing spaces", () => {
    expect(parseSearchQuery('topic:"design review"')).toEqual([
      { operator: "topic", operand: "design review" },
    ]);
  });

  it("parses a mixed query of operators and free text", () => {
    expect(
      parseSearchQuery("from:alice topic:design hello world is:starred"),
    ).toEqual([
      { operator: "sender", operand: "alice" },
      { operator: "topic", operand: "design" },
      { operator: "is", operand: "starred" },
      { operator: "search", operand: "hello world" },
    ]);
  });

  it("treats unknown operators as free-text tokens", () => {
    // `bogus:value` is not in the alias table — it falls into free text
    // (the colon is preserved in the literal contribution to free text
    // because the user's intent is unclear; surfacing the raw string
    // makes it easier to debug than silently dropping it).
    const narrow = parseSearchQuery("bogus:value something");
    expect(narrow).toEqual([
      { operator: "search", operand: "bogus:value something" },
    ]);
  });
});
