// Flexar Hub Web — app-shell navbar (Phase 0.5).
//
// Full-width top bar with three slots: the app-name (left), a search
// placeholder (center), and an actions cluster (right) holding the
// theme toggle plus a user/actions placeholder. Structural only — the
// search and user slots are labelled placeholders, not real features.

import { useTheme } from "../../theme";
import styles from "./Navbar.module.css";

export function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const nextTheme = theme === "light" ? "dark" : "light";

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
        <span className={styles.userPlaceholder}>User</span>
      </div>
    </header>
  );
}
