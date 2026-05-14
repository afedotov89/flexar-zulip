// Tests for the PresenceDot primitive (`src/components/PresenceDot`).
//
// PresenceDot is presentational: it takes a `Presence` prop and renders
// a status dot whose accessible name reflects the coarse active / idle
// / offline state. The freshness comparison runs against the wall clock
// (`Date.now()`), so these tests build timestamps relative to "now".
// The pure freshness thresholds themselves are covered by
// `src/lib/presence.test.ts`.

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PresenceDot } from "./PresenceDot";

/** A Unix-seconds timestamp `secondsAgo` before the current time. */
function secondsAgo(seconds: number): number {
  return Date.now() / 1000 - seconds;
}

describe("PresenceDot", () => {
  it("is offline when presence is undefined", () => {
    render(<PresenceDot presence={undefined} />);
    expect(screen.getByRole("img")).toHaveAccessibleName("не в сети");
  });

  it("is active for a recent active_timestamp", () => {
    render(<PresenceDot presence={{ active_timestamp: secondsAgo(5) }} />);
    expect(screen.getByRole("img")).toHaveAccessibleName("в сети");
  });

  it("is idle for a stale active but recent idle_timestamp", () => {
    render(
      <PresenceDot
        presence={{
          active_timestamp: secondsAgo(10_000),
          idle_timestamp: secondsAgo(5),
        }}
      />,
    );
    expect(screen.getByRole("img")).toHaveAccessibleName("неактивен");
  });

  it("is offline when both timestamps are stale", () => {
    render(
      <PresenceDot
        presence={{
          active_timestamp: secondsAgo(10_000),
          idle_timestamp: secondsAgo(10_000),
        }}
      />,
    );
    expect(screen.getByRole("img")).toHaveAccessibleName("не в сети");
  });

  it("applies a consumer-provided positioning class", () => {
    render(
      <PresenceDot presence={undefined} className="consumer-position" />,
    );
    expect(screen.getByRole("img")).toHaveClass("consumer-position");
  });
});
