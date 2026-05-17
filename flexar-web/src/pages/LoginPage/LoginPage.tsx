// Flexar Hub Web — login screen (Phase 1.1).
//
// A standalone full-page screen (its own centered card on a full-height
// backdrop), so it lives OUTSIDE the AppShell layout — same treatment
// as the showcase pages. It collects an email + password, hands them to
// `authStore.login`, and on success lets the route guard take over: an
// authenticated user landing on `/login` is redirected to `/` (or back
// to wherever they were headed).
//
// Built entirely from existing primitives — `Input`, `Button`,
// `Banner` — so it inherits their states (focus-visible, disabled,
// loading) for free. The form is a real <form> with a submit button, so
// Enter submits and the browser's autofill works.

import { useState } from "react";
import type { FormEvent } from "react";
import { Navigate, useLocation } from "react-router-dom";
import type { Location } from "react-router-dom";
import { Banner } from "../../components/Banner";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { useAuthStore } from "../../stores/authStore";
import styles from "./LoginPage.module.css";

/**
 * Router state we may receive from the route guard: the location the
 * user was trying to reach before being bounced to `/login`.
 */
interface LoginRedirectState {
  from?: Location;
}

export function LoginPage(): React.JSX.Element {
  const status = useAuthStore((s) => s.status);
  const isLoggingIn = useAuthStore((s) => s.isLoggingIn);
  const error = useAuthStore((s) => s.error);
  const login = useAuthStore((s) => s.login);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const location = useLocation();

  // Already signed in: don't show the form. Send the user on to wherever
  // the guard captured them heading, or to the feed by default.
  if (status === "authenticated") {
    const state = location.state as LoginRedirectState | null;
    const destination = state?.from?.pathname ?? "/";
    return <Navigate to={destination} replace />;
  }

  const canSubmit = email.trim() !== "" && password !== "" && !isLoggingIn;

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }
    void login(email.trim(), password);
  }

  return (
    <div className={styles.page}>
      <main className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.brand}>Flexar Messenger</h1>
          <p className={styles.subtitle}>Войдите в своё рабочее пространство</p>
        </div>

        {error != null && (
          <Banner tone="danger" title="Не удалось войти">
            {error}
          </Banner>
        )}

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="login-email">
              Email
            </label>
            <Input
              id="login-email"
              type="email"
              name="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoggingIn}
              invalid={error != null}
              autoFocus
              required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="login-password">
              Пароль
            </label>
            <Input
              id="login-password"
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoggingIn}
              invalid={error != null}
              required
            />
          </div>

          <Button
            type="submit"
            fullWidth
            loading={isLoggingIn}
            disabled={!canSubmit}
          >
            Войти
          </Button>
        </form>
      </main>
    </div>
  );
}
