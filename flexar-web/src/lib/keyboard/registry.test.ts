// Tests for the keyboard registry — lifecycle, scope handling, and
// LIFO ordering for Escape.

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  _resetForTests,
  _subscriptionCount,
  dispatch,
  isEditableTarget,
  subscribeShortcut,
} from "./registry";

afterEach(() => {
  _resetForTests();
});

function keydown(
  key: string,
  modifiers: Partial<{
    ctrl: boolean;
    meta: boolean;
    shift: boolean;
    alt: boolean;
  }> = {},
  target: EventTarget | null = null,
): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    key,
    ctrlKey: modifiers.ctrl,
    metaKey: modifiers.meta,
    shiftKey: modifiers.shift,
    altKey: modifiers.alt,
    cancelable: true,
  });
  if (target !== null) {
    Object.defineProperty(event, "target", { value: target });
  }
  return event;
}

describe("subscribeShortcut", () => {
  it("invokes the handler on a matching event", () => {
    const handler = vi.fn();
    subscribeShortcut("compose", handler);
    dispatch(keydown("c"));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("ignores non-matching events", () => {
    const handler = vi.fn();
    subscribeShortcut("compose", handler);
    dispatch(keydown("x"));
    expect(handler).not.toHaveBeenCalled();
  });

  it("throws on an unknown id so typos surface at mount time", () => {
    expect(() =>
      subscribeShortcut("does-not-exist", () => {}),
    ).toThrowError(/does-not-exist/);
  });

  it("returns an unsubscribe function that detaches the handler", () => {
    const handler = vi.fn();
    const unsubscribe = subscribeShortcut("compose", handler);
    unsubscribe();
    dispatch(keydown("c"));
    expect(handler).not.toHaveBeenCalled();
    expect(_subscriptionCount()).toBe(0);
  });

  it("supports multiple chord aliases on one entry", () => {
    const handler = vi.fn();
    subscribeShortcut("feed-next", handler);
    dispatch(keydown("j"));
    dispatch(keydown("ArrowDown"));
    expect(handler).toHaveBeenCalledTimes(2);
  });
});

describe("scope handling", () => {
  it("default-scope handlers do NOT fire when typing in a textarea", () => {
    const handler = vi.fn();
    subscribeShortcut("feed-next", handler);
    const textarea = document.createElement("textarea");
    dispatch(keydown("j", {}, textarea));
    expect(handler).not.toHaveBeenCalled();
  });

  it("global-scope handlers fire even inside a textarea", () => {
    const handler = vi.fn();
    subscribeShortcut("search", handler);
    const textarea = document.createElement("textarea");
    dispatch(keydown("k", { meta: true }, textarea));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("escape fires inside a textarea (it's global)", () => {
    const handler = vi.fn();
    subscribeShortcut("escape", handler);
    const textarea = document.createElement("textarea");
    dispatch(keydown("Escape", {}, textarea));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("default-scope handlers fire when focus is on a button", () => {
    const handler = vi.fn();
    subscribeShortcut("feed-next", handler);
    const button = document.createElement("button");
    dispatch(keydown("j", {}, button));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("checkbox inputs do NOT count as editable", () => {
    const handler = vi.fn();
    subscribeShortcut("feed-next", handler);
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    dispatch(keydown("j", {}, checkbox));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("contenteditable elements DO count as editable", () => {
    const handler = vi.fn();
    subscribeShortcut("feed-next", handler);
    const div = document.createElement("div");
    div.setAttribute("contenteditable", "true");
    // jsdom doesn't auto-derive isContentEditable from the attribute;
    // force the prop.
    Object.defineProperty(div, "isContentEditable", { value: true });
    dispatch(keydown("j", {}, div));
    expect(handler).not.toHaveBeenCalled();
  });
});

describe("LIFO ordering for Escape", () => {
  it("the most-recently-subscribed Escape handler fires first and stops", () => {
    const outer = vi.fn();
    const inner = vi.fn();
    subscribeShortcut("escape", outer);
    subscribeShortcut("escape", inner);
    dispatch(keydown("Escape"));
    expect(inner).toHaveBeenCalledTimes(1);
    expect(outer).not.toHaveBeenCalled();
  });

  it("after the top handler unsubscribes, the next one wins", () => {
    const outer = vi.fn();
    const inner = vi.fn();
    subscribeShortcut("escape", outer);
    const unsubscribeInner = subscribeShortcut("escape", inner);
    unsubscribeInner();
    dispatch(keydown("Escape"));
    expect(outer).toHaveBeenCalledTimes(1);
    expect(inner).not.toHaveBeenCalled();
  });

  it("non-Escape chords fall through to all matching handlers", () => {
    const a = vi.fn();
    const b = vi.fn();
    subscribeShortcut("feed-next", a);
    subscribeShortcut("feed-next", b);
    dispatch(keydown("j"));
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it("preventDefault stops propagation through the stack", () => {
    const outer = vi.fn();
    const inner = vi.fn((event: KeyboardEvent) => event.preventDefault());
    subscribeShortcut("feed-next", outer);
    subscribeShortcut("feed-next", inner);
    dispatch(keydown("j"));
    expect(inner).toHaveBeenCalledTimes(1);
    expect(outer).not.toHaveBeenCalled();
  });
});

describe("isEditableTarget", () => {
  it("text-like input → true", () => {
    const input = document.createElement("input");
    input.type = "text";
    expect(isEditableTarget(input)).toBe(true);
  });

  it("search input → true", () => {
    const input = document.createElement("input");
    input.type = "search";
    expect(isEditableTarget(input)).toBe(true);
  });

  it("checkbox input → false", () => {
    const input = document.createElement("input");
    input.type = "checkbox";
    expect(isEditableTarget(input)).toBe(false);
  });

  it("textarea → true", () => {
    expect(isEditableTarget(document.createElement("textarea"))).toBe(true);
  });

  it("plain div → false", () => {
    expect(isEditableTarget(document.createElement("div"))).toBe(false);
  });

  it("null → false", () => {
    expect(isEditableTarget(null)).toBe(false);
  });
});
