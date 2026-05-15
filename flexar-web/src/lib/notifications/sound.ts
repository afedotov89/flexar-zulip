// Flexar Hub Web — notification sound (Phase 3.5).
//
// Plays a single short tone using the Web Audio API. We synthesise the
// blip rather than ship an audio file because:
//
//   - It avoids a network round-trip / asset bundling for ~1 KB of
//     useful payload.
//   - Browsers gate `<audio>` autoplay on a recent user gesture; the
//     dispatcher cannot guarantee one ahead of every notification.
//     `AudioContext` autoplay is also gated, but a context resumed
//     once on the first user click survives — and we suspend
//     gracefully if the gate has not yet been satisfied.
//
// The tone is a brief, gentle two-note rising blip (~200 ms total) at
// a fixed low volume. Loud or long sounds in a chat client are an
// anti-pattern.

let cachedContext: AudioContext | null = null;

function getContext(): AudioContext | null {
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
  if (cachedContext === null) {
    try {
      cachedContext = new Ctor();
    } catch {
      return null;
    }
  }
  return cachedContext;
}

/**
 * Play the notification blip. No-ops in non-browser environments and
 * silently drops if the audio context has not been unlocked by a user
 * gesture yet (the next gesture-led play succeeds).
 */
export function playNotificationSound(): void {
  const ctx = getContext();
  if (ctx === null) {
    return;
  }
  // Browsers autoplay-gate `AudioContext`; the first call may be in a
  // suspended state. Resume best-effort and, if the gate refuses,
  // swallow the rejection — this is fire-and-forget audio.
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {
      // ignored — see above
    });
  }
  try {
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
    gain.connect(ctx.destination);

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(660, now);
    osc.frequency.linearRampToValueAtTime(880, now + 0.12);
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + 0.22);
  } catch (error) {
    console.warn("notification sound: failed", error);
  }
}
