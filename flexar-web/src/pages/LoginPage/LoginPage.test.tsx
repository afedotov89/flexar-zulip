// Tests for the login screen (`src/pages/LoginPage`).
//
// The page is presentation over `authStore`: it collects email +
// password, calls `login`, reflects `isLoggingIn`/`error`, and redirects
// once authenticated. The store's own logic is covered in
// `authStore.test.ts`; here we mock the store hook so the tests focus on
// the screen's wiring — submit behaviour, disabled/loading states, the
// error banner, and the authenticated redirect.

import { render, screen, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { AuthState } from "../../stores/authStore";

// Mock the auth store. `useAuthStore` is a selector hook in the real
// store; the mock applies the component's selector to a controllable
// state object so each test can stage `status`/`error`/`isLoggingIn`.
const login = vi.fn();
let storeState: AuthState;

vi.mock("../../stores/authStore", () => ({
  useAuthStore: <T,>(selector: (s: AuthState) => T): T => selector(storeState),
}));

const { LoginPage } = await import("./LoginPage");

function baseState(): AuthState {
  return {
    session: null,
    status: "unauthenticated",
    isLoggingIn: false,
    error: null,
    initialize: vi.fn(),
    login,
    logout: vi.fn(),
  };
}

/** Render LoginPage at /login with a /feed sink to observe redirects. */
function renderLogin(): void {
  render(
    <MemoryRouter initialEntries={["/login"]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<div>Feed sink</div>} />
        <Route path="/feed" element={<div>Captured destination</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  login.mockReset();
  storeState = baseState();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("LoginPage", () => {
  it("renders the email and password fields and submit button", () => {
    renderLogin();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Пароль")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Войти" }),
    ).toBeInTheDocument();
  });

  it("keeps submit disabled until both fields are filled", () => {
    renderLogin();
    const submit = screen.getByRole("button", { name: "Войти" });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "a.fedotov@friflex.com" },
    });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Пароль"), {
      target: { value: "pw" },
    });
    expect(submit).toBeEnabled();
  });

  it("calls login with the trimmed email and the password on submit", () => {
    renderLogin();
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "  a.fedotov@friflex.com  " },
    });
    fireEvent.change(screen.getByLabelText("Пароль"), {
      target: { value: "secret" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Войти" }));

    expect(login).toHaveBeenCalledWith("a.fedotov@friflex.com", "secret");
  });

  it("does not call login when fields are empty", () => {
    renderLogin();
    // Submit the form directly; the guard inside handleSubmit blocks it.
    fireEvent.submit(screen.getByLabelText("Email").closest("form")!);
    expect(login).not.toHaveBeenCalled();
  });

  it("shows a spinner and disables inputs while logging in", () => {
    storeState = { ...baseState(), isLoggingIn: true };
    renderLogin();

    expect(screen.getByRole("button", { name: /Войти/ })).toBeDisabled();
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeDisabled();
    expect(screen.getByLabelText("Пароль")).toBeDisabled();
  });

  it("shows the error banner when login failed", () => {
    storeState = {
      ...baseState(),
      error: "Your username or password is incorrect.",
    };
    renderLogin();

    expect(screen.getByText("Не удалось войти")).toBeInTheDocument();
    expect(
      screen.getByText("Your username or password is incorrect."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("redirects to / when already authenticated", () => {
    storeState = {
      ...baseState(),
      status: "authenticated",
      session: { email: "e@x.com", apiKey: "k" },
    };
    renderLogin();

    expect(screen.getByText("Feed sink")).toBeInTheDocument();
    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
  });

  it("redirects authenticated users to the captured destination", () => {
    storeState = {
      ...baseState(),
      status: "authenticated",
      session: { email: "e@x.com", apiKey: "k" },
    };
    render(
      <MemoryRouter
        initialEntries={[
          { pathname: "/login", state: { from: { pathname: "/feed" } } },
        ]}
      >
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/feed" element={<div>Captured destination</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Captured destination")).toBeInTheDocument();
  });
});
