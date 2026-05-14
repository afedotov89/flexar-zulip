// Unit tests for the authentication store (`src/stores/authStore`).
//
// The store is the first Zustand store and the auth contract for the
// app, so the tests pin down the behaviour the rest of Phase 1 depends
// on: the `login` success/failure transitions, `logout`, and — most
// importantly — that the shared API client's credentials stay in
// lock-step with the store's `session`.
//
// `fetchApiKey` is exercised through a mock of the shared `apiClient`
// singleton, so the suite runs fully offline and never touches `fetch`.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api";

// Mock the shared API client singleton. `login` calls `fetchApiKey` and
// `setCredentials`; `logout` calls `clearCredentials`. Spying on these
// lets us assert the store keeps the client in sync with its session.
// The mock fns go through `vi.hoisted` so they exist when the hoisted
// `vi.mock` factory runs.
const { fetchApiKey, setCredentials, clearCredentials } = vi.hoisted(() => ({
  fetchApiKey: vi.fn(),
  setCredentials: vi.fn(),
  clearCredentials: vi.fn(),
}));

vi.mock("../api", async (importActual) => {
  const actual = await importActual<typeof import("../api")>();
  return {
    ...actual,
    apiClient: {
      fetchApiKey,
      setCredentials,
      clearCredentials,
    },
  };
});

// Imported after the mock is registered so the store binds to the mock.
const { useAuthStore } = await import("./authStore");

/** Reset store + mocks + storage to a clean signed-out baseline. */
function resetAuth(): void {
  fetchApiKey.mockReset();
  setCredentials.mockReset();
  clearCredentials.mockReset();
  localStorage.clear();
  useAuthStore.setState({
    session: null,
    status: "unauthenticated",
    isLoggingIn: false,
    error: null,
  });
}

beforeEach(resetAuth);
afterEach(resetAuth);

describe("authStore — login", () => {
  it("starts a session and credentials the client on success", async () => {
    fetchApiKey.mockResolvedValue({
      email: "a.fedotov@friflex.com",
      apiKey: "key-123",
      userId: 8,
    });

    await useAuthStore.getState().login("a.fedotov@friflex.com", "pw");

    const state = useAuthStore.getState();
    expect(state.status).toBe("authenticated");
    expect(state.session).toEqual({
      email: "a.fedotov@friflex.com",
      apiKey: "key-123",
      userId: 8,
    });
    expect(state.error).toBeNull();
    expect(state.isLoggingIn).toBe(false);
    // The shared client must end up credentialed with the session.
    expect(setCredentials).toHaveBeenCalledWith({
      email: "a.fedotov@friflex.com",
      apiKey: "key-123",
    });
  });

  it("sets isLoggingIn while the request is in flight", async () => {
    let resolve: (value: {
      email: string;
      apiKey: string;
      userId?: number;
    }) => void = () => {};
    fetchApiKey.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );

    const pending = useAuthStore.getState().login("e@x.com", "pw");
    expect(useAuthStore.getState().isLoggingIn).toBe(true);

    resolve({ email: "e@x.com", apiKey: "k", userId: 1 });
    await pending;
    expect(useAuthStore.getState().isLoggingIn).toBe(false);
  });

  it("surfaces an ApiError message and stays unauthenticated", async () => {
    fetchApiKey.mockRejectedValue(
      new ApiError("Your username or password is incorrect.", "INVALID", 403),
    );

    await useAuthStore.getState().login("e@x.com", "wrong");

    const state = useAuthStore.getState();
    expect(state.status).toBe("unauthenticated");
    expect(state.session).toBeNull();
    expect(state.error).toBe("Your username or password is incorrect.");
    expect(state.isLoggingIn).toBe(false);
    expect(setCredentials).not.toHaveBeenCalled();
  });

  it("uses a generic message for non-ApiError failures", async () => {
    fetchApiKey.mockRejectedValue(new Error("boom"));

    await useAuthStore.getState().login("e@x.com", "pw");

    expect(useAuthStore.getState().error).toBe(
      "Could not sign in. Please try again.",
    );
  });

  it("clears a previous error when a new attempt starts", async () => {
    useAuthStore.setState({ error: "old error" });
    fetchApiKey.mockResolvedValue({ email: "e@x.com", apiKey: "k" });

    await useAuthStore.getState().login("e@x.com", "pw");

    expect(useAuthStore.getState().error).toBeNull();
  });
});

describe("authStore — initialize", () => {
  it("rehydrates a stored session and credentials the client", async () => {
    // The cold-start "autologin" path: a previous run persisted a
    // session. Seed `localStorage` exactly as `persist` would have, ask
    // `persist` to re-read it, then reset `status` to the `"unknown"`
    // startup value the store really begins in. `initialize()` must
    // then settle to `"authenticated"` and credential the API client.
    localStorage.setItem(
      "flexar-hub-auth",
      JSON.stringify({
        state: { session: { email: "e@x.com", apiKey: "k", userId: 5 } },
        version: 0,
      }),
    );
    await useAuthStore.persist.rehydrate();
    useAuthStore.setState({ status: "unknown" });
    setCredentials.mockClear();

    useAuthStore.getState().initialize();

    const state = useAuthStore.getState();
    expect(state.status).toBe("authenticated");
    expect(state.session).toEqual({
      email: "e@x.com",
      apiKey: "k",
      userId: 5,
    });
    expect(setCredentials).toHaveBeenCalledWith({
      email: "e@x.com",
      apiKey: "k",
    });
  });

  it("settles to unauthenticated on a cold start with no stored session", () => {
    // The path every brand-new user hits: `localStorage` is empty, so
    // `persist` hydrated `session` as `null`. `initialize()` must move
    // `status` off `"unknown"` to `"unauthenticated"` — leaving it on
    // `"unknown"` would hang the app on its loading screen forever.
    useAuthStore.setState({ session: null, status: "unknown" });

    useAuthStore.getState().initialize();

    expect(useAuthStore.getState().status).toBe("unauthenticated");
    expect(setCredentials).not.toHaveBeenCalled();
  });

  it("is idempotent once status has left unknown", () => {
    // A second call — e.g. React StrictMode double-invoking the mount
    // effect — must not re-run side effects or clobber state.
    useAuthStore.setState({
      session: { email: "e@x.com", apiKey: "k" },
      status: "authenticated",
    });

    useAuthStore.getState().initialize();

    expect(useAuthStore.getState().status).toBe("authenticated");
    expect(setCredentials).not.toHaveBeenCalled();
  });
});

describe("authStore — logout", () => {
  it("clears the session and the client's credentials", () => {
    useAuthStore.setState({
      session: { email: "e@x.com", apiKey: "k" },
      status: "authenticated",
    });

    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.status).toBe("unauthenticated");
    expect(state.session).toBeNull();
    expect(state.error).toBeNull();
    expect(clearCredentials).toHaveBeenCalledOnce();
  });
});

describe("authStore — persistence", () => {
  it("persists only the session, not transient UI state", async () => {
    fetchApiKey.mockResolvedValue({
      email: "e@x.com",
      apiKey: "k",
      userId: 2,
    });

    await useAuthStore.getState().login("e@x.com", "pw");

    const stored = localStorage.getItem("flexar-hub-auth");
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored as string) as {
      state: Record<string, unknown>;
    };
    expect(parsed.state).toEqual({
      session: { email: "e@x.com", apiKey: "k", userId: 2 },
    });
    // `status`, `isLoggingIn`, `error` must not be persisted.
    expect(parsed.state).not.toHaveProperty("status");
    expect(parsed.state).not.toHaveProperty("isLoggingIn");
    expect(parsed.state).not.toHaveProperty("error");
  });

  it("drops the persisted session on logout", () => {
    useAuthStore.setState({
      session: { email: "e@x.com", apiKey: "k" },
      status: "authenticated",
    });

    useAuthStore.getState().logout();

    const stored = localStorage.getItem("flexar-hub-auth");
    const parsed = JSON.parse(stored as string) as {
      state: { session: unknown };
    };
    expect(parsed.state.session).toBeNull();
  });
});
