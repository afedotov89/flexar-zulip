// Unit tests for the typing indicator's name formatter (Phase 4.3).

import { describe, expect, it } from "vitest";
import { formatTypingNames } from "./TypingIndicator";

describe("formatTypingNames", () => {
  it("returns an empty string for an empty list", () => {
    expect(formatTypingNames([])).toBe("");
  });

  it("formats a single typer", () => {
    expect(formatTypingNames(["Alice"])).toBe("Alice печатает…");
  });

  it("joins two typers with `and`", () => {
    expect(formatTypingNames(["Alice", "Bob"])).toBe(
      "Alice и Bob печатают…",
    );
  });

  it("collapses three or more typers to `Alice and N others`", () => {
    expect(formatTypingNames(["Alice", "Bob", "Carol"])).toBe(
      "Alice и ещё 2 печатают…",
    );
    expect(formatTypingNames(["Alice", "Bob", "Carol", "Dave"])).toBe(
      "Alice и ещё 3 печатают…",
    );
  });
});
