// Reconnect backoff math for the realtime connection.
//
// When the long-poll loop hits a transport failure it must not hammer
// the server: it waits, retries, and lengthens the wait on each
// consecutive failure (exponential), with random jitter so a fleet of
// clients that all dropped at once does not reconnect in lockstep
// (the "thundering herd"). A successful poll resets the sequence.
//
// The schedule is a pure function of the attempt count so it can be
// unit-tested without timers; the connection layer owns the actual
// `setTimeout` and the attempt counter.

/** Tunable parameters of the exponential-backoff-with-jitter schedule. */
export interface BackoffOptions {
  /** Delay for the first retry, in milliseconds. */
  baseMs: number;
  /** Hard ceiling the exponential growth is clamped to, in milliseconds. */
  maxMs: number;
  /**
   * Jitter fraction in `[0, 1]`. The computed delay is multiplied by a
   * random factor in `[1 - jitter, 1 + jitter]`. `0` disables jitter.
   */
  jitter: number;
}

/**
 * Default backoff schedule: first retry after 1s, doubling each
 * consecutive failure, capped at 30s, with ±25% jitter.
 */
export const DEFAULT_BACKOFF: BackoffOptions = {
  baseMs: 1_000,
  maxMs: 30_000,
  jitter: 0.25,
};

/**
 * The deterministic (pre-jitter) delay for a given consecutive-failure
 * count: `base * 2^(attempt - 1)`, clamped to `maxMs`. `attempt` is
 * 1-based — the first retry is attempt `1`.
 *
 * Exported separately from `backoffDelay` so the exponential schedule
 * can be asserted exactly, without a random component.
 */
export function backoffBaseDelay(
  attempt: number,
  options: BackoffOptions = DEFAULT_BACKOFF,
): number {
  // `attempt` is 1-based; attempts below 1 are treated as the first.
  const exponent = Math.max(0, attempt - 1);
  const raw = options.baseMs * 2 ** exponent;
  return Math.min(raw, options.maxMs);
}

/**
 * The actual delay to wait before retry `attempt` (1-based): the
 * exponential base delay scaled by a random jitter factor in
 * `[1 - jitter, 1 + jitter]`. `random` is injectable for tests; it
 * defaults to `Math.random` and must return a value in `[0, 1)`.
 */
export function backoffDelay(
  attempt: number,
  options: BackoffOptions = DEFAULT_BACKOFF,
  random: () => number = Math.random,
): number {
  const base = backoffBaseDelay(attempt, options);
  // Map `[0, 1)` onto `[1 - jitter, 1 + jitter)`.
  const factor = 1 - options.jitter + random() * 2 * options.jitter;
  return Math.round(base * factor);
}
