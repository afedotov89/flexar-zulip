// Unit tests for the built-in view registry
// (`src/lib/narrow/builtinViews`).
//
// Covers: every view's id/kind/label/path, that narrow views' `path`
// agrees with `narrowToPath(narrow)`, the narrow-vs-special split, and
// the lookup helpers.

import { describe, expect, it } from "vitest";
import { narrowToPath } from "./scheme";
import {
  BUILTIN_VIEWS,
  SPECIAL_VIEWS,
  getBuiltinView,
  type BuiltinViewId,
} from "./builtinViews";

describe("BUILTIN_VIEWS registry", () => {
  it("lists the seven built-in views in sidebar order", () => {
    expect(BUILTIN_VIEWS.map((view) => view.id)).toEqual([
      "inbox",
      "recent",
      "combined",
      "mentions",
      "reactions",
      "starred",
      "drafts",
    ]);
  });

  it("classifies inbox / recent / drafts as special views", () => {
    const specialIds = BUILTIN_VIEWS.filter(
      (view) => view.kind === "special",
    ).map((view) => view.id);
    expect(specialIds).toEqual(["inbox", "recent", "drafts"]);
  });

  it("classifies combined / mentions / reactions / starred as narrow views", () => {
    const narrowIds = BUILTIN_VIEWS.filter(
      (view) => view.kind === "narrow",
    ).map((view) => view.id);
    expect(narrowIds).toEqual([
      "combined",
      "mentions",
      "reactions",
      "starred",
    ]);
  });

  it("gives every view a non-empty ru-RU label", () => {
    for (const view of BUILTIN_VIEWS) {
      expect(view.label.length).toBeGreaterThan(0);
    }
  });

  it("maps each special view to its dedicated path", () => {
    const paths = Object.fromEntries(
      SPECIAL_VIEWS.map((view) => [view.id, view.path]),
    );
    expect(paths).toEqual({
      inbox: "/inbox",
      recent: "/recent",
      drafts: "/drafts",
    });
  });

  it("keeps each narrow view's path in sync with narrowToPath(narrow)", () => {
    for (const view of BUILTIN_VIEWS) {
      if (view.kind === "narrow") {
        expect(view.path).toBe(narrowToPath(view.narrow));
      }
    }
  });

  it("maps the narrow views to their expected narrows and paths", () => {
    const byId = Object.fromEntries(
      BUILTIN_VIEWS.map((view) => [view.id, view]),
    );

    const combined = byId.combined;
    expect(combined.kind).toBe("narrow");
    if (combined.kind === "narrow") {
      expect(combined.narrow).toEqual([]);
      expect(combined.path).toBe("/narrow");
    }

    const mentions = byId.mentions;
    expect(mentions.kind).toBe("narrow");
    if (mentions.kind === "narrow") {
      expect(mentions.narrow).toEqual([
        { operator: "is", operand: "mentioned" },
      ]);
      expect(mentions.path).toBe("/narrow/is/mentioned");
    }

    const starred = byId.starred;
    expect(starred.kind).toBe("narrow");
    if (starred.kind === "narrow") {
      expect(starred.narrow).toEqual([
        { operator: "is", operand: "starred" },
      ]);
      expect(starred.path).toBe("/narrow/is/starred");
    }

    const reactions = byId.reactions;
    expect(reactions.kind).toBe("narrow");
    if (reactions.kind === "narrow") {
      expect(reactions.narrow).toEqual([
        { operator: "has", operand: "reaction" },
        { operator: "sender", operand: "me" },
      ]);
      expect(reactions.path).toBe("/narrow/has/reaction/sender/me");
    }
  });

  it("gives every view a unique path", () => {
    const paths = BUILTIN_VIEWS.map((view) => view.path);
    expect(new Set(paths).size).toBe(paths.length);
  });
});

describe("getBuiltinView", () => {
  it("looks up each view by id", () => {
    for (const view of BUILTIN_VIEWS) {
      expect(getBuiltinView(view.id)).toBe(view);
    }
  });

  it("throws on an unregistered id", () => {
    expect(() => getBuiltinView("nope" as BuiltinViewId)).toThrow(
      /unknown built-in view/,
    );
  });
});
