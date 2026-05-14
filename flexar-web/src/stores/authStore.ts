// Flexar Hub Web — authentication store (Phase 1.1).
//
// This is the first Zustand store in the app and sets the pattern for
// the rest of `src/stores/`:
//   - `create<State>()(...)` with an explicit state interface that
//     bundles data and the actions that mutate it;
//   - the `persist` middleware when (and only when) state must survive a
//     reload — here, the login session;
//   - side effects that must stay in lock-step with the persisted state
//     (installing/clearing the API client's credentials) live in the
//     actions, never scattered across the UI.
//
// Auth model (PRD §4.3): `fetchApiKey` exchanges email + password for an
// API key; the key + email are the session. They are kept in
// `localStorage` for the scaffold phase — a deliberate, documented
// tradeoff (PRD §11: production hardening moves this to an httpOnly
// cookie behind a proxy).
//
// The `status` field is a three-state machine, and the `"unknown"`
// state is load-bearing: between first paint and `initialize()` running
// we do not yet know whether a session exists. The route guard renders
// a neutral loading state for `"unknown"` rather than flashing the login
// page at a user who is in fact signed in.
//
// Resolving `"unknown"` is the job of `initialize()`, called once from
// `App` on mount. We deliberately do NOT resolve it from
// `onRehydrateStorage`: with synchronous storage (`localStorage`),
// `persist` rehydrates *during* `create()`, so the `onRehydrateStorage`
// callback would run while the module-level `useAuthStore` binding is
// still in its temporal dead zone — `useAuthStore.setState(...)` from
// inside it is a no-op. By the time React mounts and effects run, the
// binding is assigned and the session is already hydrated, so
// `initialize()` is both correct and simple.

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { apiClient } from "../api";
import { ApiError } from "../api";

/** A persisted login session: the credentials the API client needs. */
export interface AuthSession {
  /** Zulip API email address of the signed-in account. */
  email: string;
  /** API key obtained from `fetchApiKey`. */
  apiKey: string;
  /** User ID of the account, when the server reported it. */
  userId?: number;
}

/**
 * Where the auth layer is in its lifecycle.
 * - `"unknown"` — `initialize()` has not run yet; we do not know whether
 *   a session exists. Transient, only at startup.
 * - `"unauthenticated"` — no session; the login screen is appropriate.
 * - `"authenticated"` — a session is installed and the API client is
 *   credentialed.
 */
export type AuthStatus = "unknown" | "unauthenticated" | "authenticated";

export interface AuthState {
  /** The active session, or `null` when signed out. */
  session: AuthSession | null;
  /** Lifecycle state; see `AuthStatus`. */
  status: AuthStatus;
  /**
   * Whether a `login` call is in flight. Lets the login form disable
   * its controls and show progress without its own local state.
   */
  isLoggingIn: boolean;
  /**
   * Human-readable error from the last failed `login`, or `null`. Reset
   * when a new `login` attempt starts and on `logout`.
   */
  error: string | null;
  /**
   * Resolve the `"unknown"` startup state. By the time this runs,
   * `persist` has already synchronously hydrated `session` from
   * `localStorage`: if a session is present, credential the API client
   * and become `"authenticated"`; otherwise become `"unauthenticated"`.
   * Called once from `App` on mount. Idempotent — if `status` has
   * already left `"unknown"` (e.g. a StrictMode double-invoke, or a
   * `login` that raced ahead) it is a no-op.
   */
  initialize: () => void;
  /**
   * Exchange credentials for an API key and start a session. On success
   * the API client is credentialed and `status` becomes
   * `"authenticated"`. On failure `error` is populated and the promise
   * still resolves — callers branch on `error`/`status`, they do not
   * need a `try`/`catch`.
   */
  login: (email: string, password: string) => Promise<void>;
  /**
   * End the session: clear the API client's credentials and reset to
   * `"unauthenticated"`. The `persist` middleware drops the stored
   * session as a consequence of the state change.
   */
  logout: () => void;
}

/** localStorage key for the persisted session. */
const STORAGE_KEY = "flexar-hub-auth";

/**
 * Install a session's credentials into the shared API client. Called
 * both after a fresh login and when a persisted session is rehydrated.
 */
function applySession(session: AuthSession): void {
  apiClient.setCredentials({ email: session.email, apiKey: session.apiKey });
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      session: null,
      // Start in `"unknown"`: until `initialize()` runs we cannot tell a
      // signed-in user from a signed-out one. `App` calls `initialize()`
      // on mount, which settles this to `"authenticated"` or
      // `"unauthenticated"`.
      status: "unknown",
      isLoggingIn: false,
      error: null,

      initialize: () => {
        // Idempotent: a second call (StrictMode double-invoke, or after
        // a `login` already moved `status` forward) has nothing to do.
        if (get().status !== "unknown") {
          return;
        }
        const { session } = get();
        if (session != null) {
          applySession(session);
          set({ status: "authenticated" });
        } else {
          set({ status: "unauthenticated" });
        }
      },

      login: async (email, password) => {
        set({ isLoggingIn: true, error: null });
        try {
          const result = await apiClient.fetchApiKey(email, password);
          const session: AuthSession = {
            email: result.email,
            apiKey: result.apiKey,
            userId: result.userId,
          };
          applySession(session);
          set({
            session,
            status: "authenticated",
            isLoggingIn: false,
            error: null,
          });
        } catch (cause) {
          // `fetchApiKey` rejects with `ApiError` for both transport
          // failures and Zulip error envelopes (bad credentials, etc.).
          const message =
            cause instanceof ApiError
              ? cause.message
              : "Could not sign in. Please try again.";
          set({
            session: null,
            status: "unauthenticated",
            isLoggingIn: false,
            error: message,
          });
        }
      },

      logout: () => {
        apiClient.clearCredentials();
        set({
          session: null,
          status: "unauthenticated",
          isLoggingIn: false,
          error: null,
        });
      },
    }),
    {
      name: STORAGE_KEY,
      // Only the session is durable. `status` is resolved by
      // `initialize()`, and `isLoggingIn` / `error` are transient UI
      // state that must not survive a reload.
      partialize: (state) => ({ session: state.session }),
    },
  ),
);
