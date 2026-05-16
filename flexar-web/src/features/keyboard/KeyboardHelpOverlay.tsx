// Keyboard help overlay (Phase 6.1).
//
// A Modal that renders every entry in `KEYMAP` grouped by section,
// with each chord pretty-printed via `formatShortcut`. Opens on `?`
// (registered as the `help` shortcut), closes via the Modal's own
// dismiss handling.
//
// Single source of truth: the overlay reads `KEYMAP` directly — adding
// a shortcut in `keymap.ts` makes it appear here without further work.

import { useCallback, useState } from "react";
import { Modal } from "../../components/Modal";
import {
  KEYMAP,
  formatShortcut,
  useKeyboardShortcut,
} from "../../lib/keyboard";
import styles from "./KeyboardHelpOverlay.module.css";

export function KeyboardHelpOverlay(): React.JSX.Element {
  const [open, setOpen] = useState(false);

  useKeyboardShortcut(
    "help",
    useCallback((event: KeyboardEvent) => {
      // Don't let the `?` also reach a focused textarea (browser would
      // type it after `preventDefault` is skipped). The chord is
      // Shift+?, scope `global`, so we always pre-empt here.
      event.preventDefault();
      setOpen((prev) => !prev);
    }, []),
  );

  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      title="Горячие клавиши"
      size="md"
    >
      <div className={styles.groups}>
        {KEYMAP.map((group) => (
          <section key={group.heading} className={styles.group}>
            <h3 className={styles.heading}>{group.heading}</h3>
            <dl className={styles.entries}>
              {group.entries.map((entry) => (
                <div key={entry.id} className={styles.entry}>
                  <dt className={styles.label}>{entry.label}</dt>
                  <dd className={styles.chords}>
                    {entry.chords.map((chord, index) => (
                      <span key={index} className={styles.chordWrap}>
                        {index > 0 && (
                          <span className={styles.chordSep}>или</span>
                        )}
                        <kbd className={styles.kbd}>
                          {formatShortcut(chord)}
                        </kbd>
                      </span>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Modal>
  );
}
