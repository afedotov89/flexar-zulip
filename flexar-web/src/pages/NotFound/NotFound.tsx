// Flexar Hub Web — not-found page placeholder (Phase 0.5).
//
// The catch-all `*` route. Structural placeholder with a link back to
// the feed; richer empty-state design is a later concern.

import { Link } from "react-router-dom";
import styles from "./NotFound.module.css";

export function NotFound() {
  return (
    <div className={styles.notFound}>
      <p className={styles.title}>Страница не найдена</p>
      <Link to="/" className={styles.homeLink}>
        Вернуться к ленте
      </Link>
    </div>
  );
}
