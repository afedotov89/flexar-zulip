// Unit tests for the realtime/auth lifecycle wiring.
//
// `wireRealtimeToAuth` must start the shared connection when the auth
// store reaches `"authenticated"` and stop it otherwise. The connection
// singleton is mocked so the test asserts the start/stop calls without
// running a real long-poll loop; the real `useAuthStore` drives the
// status transitions.

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

// Mock the connection singleton: `lifecycle` imports `realtimeConnection`
// from `./connection`-backed module... actually from `./lifecycle` itself
// creates it. So we mock the `connection` module's class to a stub whose
// instances expose spyable start/stop.
const { start, stop } = vi.hoisted(() => ({
  start: vi.fn(),
  stop: vi.fn(),
}));

vi.mock("./connection", async (importActual) => {
  const actual = await importActual<typeof import("./connection")>();
  return {
    ...actual,
    RealtimeConnection: class {
      start = start;
      stop = stop;
    },
  };
});

// Imported after the mock is registered.
const { wireRealtimeToAuth } = await import("./lifecycle");
const { useAuthStore } = await import("../stores/authStore");

/** Reset the store to a clean signed-out baseline and clear spies. */
function reset(): void {
  start.mockClear();
  stop.mockClear();
  useAuthStore.setState({
    session: null,
    status: "unauthenticated",
    isLoggingIn: false,
    error: null,
  });
}

beforeEach(reset);
afterEach(reset);

describe("wireRealtimeToAuth", () => {
  it("starts the connection immediately if already authenticated", () => {
    useAuthStore.setState({ status: "authenticated" });
    const unsubscribe = wireRealtimeToAuth();
    expect(start).toHaveBeenCalledTimes(1);
    expect(stop).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("stops the connection immediately if not authenticated", () => {
    const unsubscribe = wireRealtimeToAuth();
    expect(stop).toHaveBeenCalledTimes(1);
    expect(start).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("starts on the transition into authenticated", () => {
    const unsubscribe = wireRealtimeToAuth();
    start.mockClear();
    stop.mockClear();

    useAuthStore.setState({ status: "authenticated" });
    expect(start).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  it("stops on the transition out of authenticated (logout)", () => {
    useAuthStore.setState({ status: "authenticated" });
    const unsubscribe = wireRealtimeToAuth();
    start.mockClear();
    stop.mockClear();

    useAuthStore.setState({ status: "unauthenticated" });
    expect(stop).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  it("stops reacting after the returned unsubscribe is called", () => {
    const unsubscribe = wireRealtimeToAuth();
    unsubscribe();
    start.mockClear();
    stop.mockClear();

    useAuthStore.setState({ status: "authenticated" });
    expect(start).not.toHaveBeenCalled();
    expect(stop).not.toHaveBeenCalled();
  });
});
