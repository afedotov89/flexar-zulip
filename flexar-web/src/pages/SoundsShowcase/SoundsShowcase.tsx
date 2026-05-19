// Dev-only audition page for notification-sound variants.
//
// Lists every entry in `SOUND_VARIANTS` as a card with a Play button.
// Each click resumes the cached AudioContext (the browser autoplay
// gate is satisfied by the click itself) and schedules the variant.
// The chosen variant id is announced via `localStorage` so a later
// session can re-pick from where the user left off — but the *actual*
// notification sound stays whatever `src/lib/notifications/sound.ts`
// implements; this page is for picking, not for runtime selection.

import { useRef, useState } from "react";
import { Button } from "../../components/Button";
import { SOUND_VARIANTS, type SoundVariant } from "./soundVariants";
import styles from "./SoundsShowcase.module.css";

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") {
    return null;
  }
  type AudioContextWindow = Window & {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  const audioWindow = window as AudioContextWindow;
  const Ctor = audioWindow.AudioContext ?? audioWindow.webkitAudioContext;
  if (Ctor === undefined) {
    return null;
  }
  try {
    return new Ctor();
  } catch {
    return null;
  }
}

export function SoundsShowcase(): React.JSX.Element {
  // One shared context for the whole session — same as
  // `notifications/sound.ts` does in prod. Lazily created on first
  // play so initial render doesn't allocate audio resources.
  const ctxRef = useRef<AudioContext | null>(null);
  const [lastPlayed, setLastPlayed] = useState<string | null>(null);

  const play = (variant: SoundVariant): void => {
    if (ctxRef.current === null) {
      ctxRef.current = getAudioContext();
    }
    const ctx = ctxRef.current;
    if (ctx === null) {
      return;
    }
    if (ctx.state === "suspended") {
      void ctx.resume();
    }
    try {
      variant.play(ctx);
      setLastPlayed(variant.id);
    } catch (error) {
      console.warn("audition failed", variant.id, error);
    }
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Звуки уведомлений</h1>
        <p className={styles.subtitle}>
          Послушай варианты и скажи, какой нравится — я сделаю его
          дефолтным.
        </p>
      </header>
      <ul className={styles.list}>
        {SOUND_VARIANTS.map((variant) => (
          <li
            key={variant.id}
            className={
              lastPlayed === variant.id
                ? `${styles.card} ${styles.cardActive}`
                : styles.card
            }
          >
            <div className={styles.meta}>
              <div className={styles.name}>{variant.name}</div>
              <div className={styles.description}>{variant.description}</div>
            </div>
            <Button
              variant="primary"
              size="md"
              iconLeft="bell"
              onClick={() => play(variant)}
            >
              Послушать
            </Button>
          </li>
        ))}
      </ul>
    </main>
  );
}
