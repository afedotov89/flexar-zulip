// Unit tests for the reconnect backoff schedule.

import { describe, expect, it } from "vitest";
import {
  backoffBaseDelay,
  backoffDelay,
  DEFAULT_BACKOFF,
  type BackoffOptions,
} from "./backoff";

const OPTS: BackoffOptions = { baseMs: 1_000, maxMs: 30_000, jitter: 0.25 };

describe("backoffBaseDelay", () => {
  it("grows exponentially from the base delay", () => {
    expect(backoffBaseDelay(1, OPTS)).toBe(1_000);
    expect(backoffBaseDelay(2, OPTS)).toBe(2_000);
    expect(backoffBaseDelay(3, OPTS)).toBe(4_000);
    expect(backoffBaseDelay(4, OPTS)).toBe(8_000);
    expect(backoffBaseDelay(5, OPTS)).toBe(16_000);
  });

  it("clamps to maxMs once the exponential growth exceeds it", () => {
    expect(backoffBaseDelay(6, OPTS)).toBe(30_000);
    expect(backoffBaseDelay(20, OPTS)).toBe(30_000);
  });

  it("treats attempts below 1 as the first attempt", () => {
    expect(backoffBaseDelay(0, OPTS)).toBe(1_000);
    expect(backoffBaseDelay(-3, OPTS)).toBe(1_000);
  });

  it("uses DEFAULT_BACKOFF when no options are given", () => {
    expect(backoffBaseDelay(1)).toBe(DEFAULT_BACKOFF.baseMs);
  });
});

describe("backoffDelay", () => {
  it("applies the low end of the jitter window when random returns 0", () => {
    // factor = 1 - jitter + 0 = 0.75
    expect(backoffDelay(2, OPTS, () => 0)).toBe(1_500);
  });

  it("applies the high end of the jitter window when random nears 1", () => {
    // factor = 1 - jitter + ~1 * 2 * jitter ≈ 1.25
    expect(backoffDelay(2, OPTS, () => 0.999_999)).toBe(2_500);
  });

  it("applies no jitter at the midpoint random value", () => {
    expect(backoffDelay(3, OPTS, () => 0.5)).toBe(4_000);
  });

  it("keeps jitter applied to the clamped maximum", () => {
    // Base is clamped to 30_000; jitter still scales it.
    expect(backoffDelay(99, OPTS, () => 0)).toBe(22_500);
    expect(backoffDelay(99, OPTS, () => 0.5)).toBe(30_000);
  });

  it("disables jitter when the jitter fraction is 0", () => {
    const noJitter: BackoffOptions = { ...OPTS, jitter: 0 };
    expect(backoffDelay(3, noJitter, () => 0)).toBe(4_000);
    expect(backoffDelay(3, noJitter, () => 0.9)).toBe(4_000);
  });
});
