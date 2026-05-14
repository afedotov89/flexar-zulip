// Tests for the authenticated-route guard (`src/app/RequireAuth`).
//
// The guard maps the auth store's three-state `status` machine onto
// three render outcomes. The `"unknown"` case is the load-bearing one:
// during `persist` rehydration the guard must show a loading screen and
// must NOT redirect — redirecting would flash the login page at a user
// who turns out to be signed in. The store hook is mocked so each test
// stages one `status` value.

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { AuthState } from "../../stores/authStore";

let storeState: AuthState;

vi.mock("../../stores/authStore", () => ({
  useAuthStore: <T,>(selector: (s: AuthState) => T): T => selector(storeState),
}));

const { RequireAuth } = await import("./RequireAuth");

function stateWith(status: AuthState["status"]): AuthState {
  return {
    session: status === "authenticated" ? { email: "e@x.com", apiKey: "k" } : null,
    status,
    isLoggingIn: false,
    error: null,
    initialize: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
  };
}

/** Render the guard over a protected route, with a /login sink. */
function renderGuard(): void {
  render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route element={<RequireAuth />}>
          <Route path="/" element={<div>Protected content</div>} />
        </Route>
        <Route path="/login" element={<div>Login screen</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  storeState = stateWith("unknown");
});

describe("RequireAuth", () => {
  it("shows a loading screen while status is unknown", () => {
    storeState = stateWith("unknown");
    renderGuard();

    expect(screen.getByText("Loading your workspace…")).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
    // No redirect, no protected content during rehydration.
    expect(screen.queryByText("Login screen")).not.toBeInTheDocument();
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
  });

  it("redirects to /login when unauthenticated", () => {
    storeState = stateWith("unauthenticated");
    renderGuard();

    expect(screen.getByText("Login screen")).toBeInTheDocument();
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
  });

  it("renders the protected outlet when authenticated", () => {
    storeState = stateWith("authenticated");
    renderGuard();

    expect(screen.getByText("Protected content")).toBeInTheDocument();
    expect(screen.queryByText("Login screen")).not.toBeInTheDocument();
  });
});
