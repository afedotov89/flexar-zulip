// Tests for `useI18n` — verifies catalogue selection + placeholder
// interpolation.

import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useI18n } from "./useI18n";
import { useLocaleStore } from "./localeStore";

// The store uses `persist`, so a previous test's set-locale write
// leaks into localStorage. Reset both the store state and storage
// before each test so every case starts from RU.
beforeEach(() => {
  useLocaleStore.setState({ locale: "ru" });
});

afterEach(() => {
  useLocaleStore.setState({ locale: "ru" });
});

function Probe({ onResult }: { onResult: (i: ReturnType<typeof useI18n>) => void }) {
  const i = useI18n();
  onResult(i);
  return null;
}

describe("useI18n", () => {
  it("returns the RU catalogue by default", () => {
    let captured: ReturnType<typeof useI18n> | undefined;
    render(<Probe onResult={(i) => (captured = i)} />);
    expect(captured!.m.shell.skipToContent).toBe("Перейти к сообщениям");
  });

  it("switches to EN when the locale store changes", () => {
    let captured: ReturnType<typeof useI18n> | undefined;
    render(<Probe onResult={(i) => (captured = i)} />);
    act(() => {
      useLocaleStore.getState().setLocale("en");
    });
    expect(captured!.m.shell.skipToContent).toBe("Skip to messages");
  });

  it("interpolates {key} placeholders via t()", () => {
    let captured: ReturnType<typeof useI18n> | undefined;
    render(<Probe onResult={(i) => (captured = i)} />);
    expect(captured!.t("Hello, {name}!", { name: "Alex" })).toBe(
      "Hello, Alex!",
    );
  });

  it("leaves unknown placeholders verbatim", () => {
    let captured: ReturnType<typeof useI18n> | undefined;
    render(<Probe onResult={(i) => (captured = i)} />);
    expect(captured!.t("a {missing} b", { name: "x" })).toBe("a {missing} b");
  });

  it("returns the template untouched when no params are given", () => {
    let captured: ReturnType<typeof useI18n> | undefined;
    render(<Probe onResult={(i) => (captured = i)} />);
    expect(captured!.t("plain text")).toBe("plain text");
  });
});
