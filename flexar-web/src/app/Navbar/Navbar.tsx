// Flexar Hub Web — app-shell navbar (Phase 0.5, logout added 1.1).
//
// Full-width top bar with three slots: the app-name (left), a search
// placeholder (center), and an actions cluster (right). The actions
// cluster holds the theme toggle plus — once a session exists — the
// signed-in account's email and a logout control. The search slot is
// still a labelled placeholder, not a real feature.

import { useNavigate } from "react-router-dom";
import { Button } from "../../components/Button";
import { useAuthStore } from "../../stores/authStore";
import { useTheme } from "../../theme";
import styles from "./Navbar.module.css";

export function Navbar(): React.JSX.Element {
  const { theme, toggleTheme } = useTheme();
  const nextTheme = theme === "light" ? "dark" : "light";

  const session = useAuthStore((s) => s.session);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  function handleLogout(): void {
    logout();
    // Send the user to the login screen immediately. The route guard
    // would also catch this on the next render, but navigating here
    // keeps the transition crisp.
    void navigate("/login", { replace: true });
  }

  return (
    <header className={styles.navbar}>
      <div className={styles.brand}>Flexar Hub</div>

      <div className={styles.search}>
        <span className={styles.searchPlaceholder}>Search placeholder</span>
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.themeToggle}
          onClick={toggleTheme}
          aria-label={`Switch to ${nextTheme} theme`}
        >
          {theme === "light" ? "Dark" : "Light"} theme
        </button>
        {session != null && (
          <div className={styles.account}>
            <span className={styles.accountEmail} title={session.email}>
              {session.email}
            </span>
            <Button variant="secondary" size="sm" onClick={handleLogout}>
              Log out
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
