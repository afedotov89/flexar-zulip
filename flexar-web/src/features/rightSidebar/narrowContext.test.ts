// Unit tests for the narrow → right-sidebar-context resolver.
//
// `resolveRightSidebarContext` is a pure function of a `Narrow`, so the
// tests just feed it narrow shapes and assert the resolved context.

import { describe, expect, it } from "vitest";
import type { Narrow } from "../../domain";
import { resolveRightSidebarContext } from "./narrowContext";

describe("resolveRightSidebarContext", () => {
  it("is 'none' for an undefined narrow (a special view)", () => {
    expect(resolveRightSidebarContext(undefined)).toEqual({ kind: "none" });
  });

  it("is 'none' for the empty (combined feed) narrow", () => {
    expect(resolveRightSidebarContext([])).toEqual({ kind: "none" });
  });

  it("is 'none' for an is:/has: view narrow", () => {
    const narrow: Narrow = [{ operator: "is", operand: "mentioned" }];
    expect(resolveRightSidebarContext(narrow)).toEqual({ kind: "none" });
  });

  it("resolves a channel narrow to its stream id", () => {
    const narrow: Narrow = [{ operator: "channel", operand: 7 }];
    expect(resolveRightSidebarContext(narrow)).toEqual({
      kind: "channel",
      streamId: 7,
    });
  });

  it("resolves a channel+topic narrow to the channel context", () => {
    const narrow: Narrow = [
      { operator: "channel", operand: 7 },
      { operator: "topic", operand: "deploys" },
    ];
    expect(resolveRightSidebarContext(narrow)).toEqual({
      kind: "channel",
      streamId: 7,
    });
  });

  it("resolves the legacy 'stream' operator like 'channel'", () => {
    const narrow: Narrow = [{ operator: "stream", operand: 12 }];
    expect(resolveRightSidebarContext(narrow)).toEqual({
      kind: "channel",
      streamId: 12,
    });
  });

  it("resolves a dm narrow to its participant ids", () => {
    const narrow: Narrow = [{ operator: "dm", operand: [4, 9] }];
    expect(resolveRightSidebarContext(narrow)).toEqual({
      kind: "dm",
      participantIds: [4, 9],
    });
  });

  it("ignores a dm narrow with a non-numeric operand", () => {
    const narrow: Narrow = [{ operator: "dm", operand: "4,9" }];
    expect(resolveRightSidebarContext(narrow)).toEqual({ kind: "none" });
  });

  it("ignores a dm narrow with an empty participant list", () => {
    const narrow: Narrow = [{ operator: "dm", operand: [] }];
    expect(resolveRightSidebarContext(narrow)).toEqual({ kind: "none" });
  });
});
