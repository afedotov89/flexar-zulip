// Tests for the network-status banner — exercise the offline /
// reconnecting-debounce / reconnected-success state machine.

import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConnectionStatus } from "../../realtime";
import { useLocaleStore } from "../../lib/i18n";

// Drive the realtime status via a module-level variable plus a
// per-listener callback. Tests mutate `status` and call `notify()` to
// simulate a status transition.
let status: ConnectionStatus = "connected";
const listeners = new Set<(s: ConnectionStatus) => void>();
function notify(): void {
  for (const listener of listeners) {
    listener(status);
  }
}
vi.mock("../../realtime", () => ({
  realtimeConnection: {
    getStatus: () => status,
    onStatusChange: (l: (s: ConnectionStatus) => void) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    onInitialState: () => () => {},
    subscribe: () => () => {},
  },
}));

const { NetworkStatusBanner } = await import("./NetworkStatusBanner");

beforeEach(() => {
  status = "connected";
  listeners.clear();
  Object.defineProperty(navigator, "onLine", {
    value: true,
    configurable: true,
  });
  // Locale persists across tests — pin RU so banner copy assertions
  // line up with the RU catalogue.
  useLocaleStore.setState({ locale: "ru" });
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("NetworkStatusBanner", () => {
  it("renders nothing when online and connected", () => {
    const { container } = render(<NetworkStatusBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the offline banner when navigator goes offline", () => {
    const { container } = render(<NetworkStatusBanner />);
    Object.defineProperty(navigator, "onLine", {
      value: false,
      configurable: true,
    });
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(container).not.toBeEmptyDOMElement();
    expect(
      screen.getByText(/Нет соединения с интернетом/i),
    ).toBeInTheDocument();
  });

  it("debounces reconnecting — short blip stays silent", () => {
    const { container } = render(<NetworkStatusBanner />);
    status = "reconnecting";
    act(() => {
      notify();
    });
    // Just under the grace window (4s).
    act(() => {
      vi.advanceTimersByTime(3500);
    });
    expect(container).toBeEmptyDOMElement();
    // Recovery before the timer fires — no banner ever shows.
    status = "connected";
    act(() => {
      notify();
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the reconnecting banner after the grace window", () => {
    render(<NetworkStatusBanner />);
    status = "reconnecting";
    act(() => {
      notify();
    });
    act(() => {
      vi.advanceTimersByTime(4100);
    });
    expect(
      screen.getByText(/Восстанавливаем соединение/i),
    ).toBeInTheDocument();
  });

  it("flashes a success banner after a real outage and auto-hides it", () => {
    const { container } = render(<NetworkStatusBanner />);
    // First, an outage that we actually surfaced.
    status = "reconnecting";
    act(() => {
      notify();
    });
    act(() => {
      vi.advanceTimersByTime(4100);
    });
    expect(
      screen.getByText(/Восстанавливаем соединение/i),
    ).toBeInTheDocument();
    // Then recovery.
    status = "connected";
    act(() => {
      notify();
    });
    expect(screen.getByText(/Соединение восстановлено/i)).toBeInTheDocument();
    // Auto-dismiss after a few seconds.
    act(() => {
      vi.advanceTimersByTime(3100);
    });
    expect(container).toBeEmptyDOMElement();
  });

  it("does NOT flash success on a clean first connect", () => {
    const { container } = render(<NetworkStatusBanner />);
    // Connection comes up clean (no outage was ever shown).
    status = "connected";
    act(() => {
      notify();
    });
    expect(container).toBeEmptyDOMElement();
  });
});
