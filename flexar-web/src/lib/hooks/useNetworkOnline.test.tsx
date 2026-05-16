// Tests for `useNetworkOnline` — verify it tracks `navigator.onLine`
// and re-renders on `online` / `offline` window events.

import { act, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useNetworkOnline } from "./useNetworkOnline";

function Probe({ onValue }: { onValue: (v: boolean) => void }) {
  const online = useNetworkOnline();
  onValue(online);
  return null;
}

describe("useNetworkOnline", () => {
  it("returns the current navigator.onLine value", () => {
    const onValue = vi.fn();
    render(<Probe onValue={onValue} />);
    // jsdom defaults navigator.onLine to true.
    expect(onValue).toHaveBeenLastCalledWith(true);
  });

  it("re-renders when an `offline` event fires", () => {
    const onValue = vi.fn();
    render(<Probe onValue={onValue} />);
    onValue.mockClear();
    // Flip the property + dispatch the event; jsdom doesn't move
    // navigator.onLine on its own.
    Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(onValue).toHaveBeenLastCalledWith(false);
    // Restore for other tests.
    Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    expect(onValue).toHaveBeenLastCalledWith(true);
  });
});
