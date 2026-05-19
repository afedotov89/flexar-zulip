// Flexar Hub Web — notification sound (Phase 3.5).
//
// Plays a brief chime using the Web Audio API. We synthesise the tone
// rather than ship an audio file because:
//
//   - It avoids a network round-trip / asset bundling for ~1 KB of
//     useful payload.
//   - Browsers gate `<audio>` autoplay on a recent user gesture; the
//     dispatcher cannot guarantee one ahead of every notification.
//     `AudioContext` autoplay is also gated, but a context resumed
//     once on the first user click survives — and we suspend
//     gracefully if the gate has not yet been satisfied.
//
// The tone is a "blooming" doorbell — two descending notes (G5 → E5)
// fired close together (90 ms between strike onsets), each with a
// gentle 40 ms attack and a long natural decay (~1.5 s). The tight
// spacing reads as a single two-note motif rather than two separate
// beeps; the slow attack avoids a harsh transient; the long tail
// rings out like a real bell. Each note is two stacked triangle
// oscillators — the root plus a perfect-fifth overtone — for a
// brighter timbre than a pure sine while staying gentle.
//
// Picked by audition in /sounds (the "Doorbell Bloom" variant);
// tweak by re-auditioning there and updating both files together.

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
    // Two descending notes fired tight together. The second strike
    // begins before the first has fully bloomed; the long decays
    // overlap and the pair reads as one sustained chord with a
    // two-note motif at the attack — Slack-Mellow tail, doorbell
    // attack. Frequencies are G5 (784 Hz) → E5 (659.3 Hz); each
    // strike adds its perfect-fifth overtone (the most consonant
    // bell partial) at ~40% mix.
    scheduleBloomStrike(ctx, now, 784);
    scheduleBloomStrike(ctx, now + 0.09, 659.3);
  } catch (error) {
    console.warn("notification sound: failed", error);
  }
}

/**
 * Schedule one "Doorbell Bloom" strike on `ctx` at `startTime` (in the
 * context's clock). Triangle root at `rootFreq` + perfect-fifth
 * overtone, gentle 40 ms attack, ~1.5 s exponential decay.
 */
function scheduleBloomStrike(
  ctx: AudioContext,
  startTime: number,
  rootFreq: number,
): void {
  const duration = 1.5;
  const end = startTime + duration;

  // Shared envelope: gentle attack (slow enough to avoid a harsh
  // transient — "blooming" rather than struck), long exponential
  // decay that lets the chord ring out like a real bell.
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(0.13, startTime + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  gain.connect(ctx.destination);

  // Root note. Triangle wave gives a brighter harmonic profile than
  // a pure sine — reads as "chime" rather than "blip" while staying
  // gentle.
  const root = ctx.createOscillator();
  root.type = "triangle";
  root.frequency.setValueAtTime(rootFreq, startTime);
  root.connect(gain);
  root.start(startTime);
  root.stop(end);

  // Perfect-fifth overtone at 40% amplitude — the fifth is the most
  // consonant interval and the classic bell partial; it's what gives
  // the strike its "ring" rather than a flat hum.
  const fifthGain = ctx.createGain();
  fifthGain.gain.value = 0.4;
  fifthGain.connect(gain);

  const fifth = ctx.createOscillator();
  fifth.type = "triangle";
  fifth.frequency.setValueAtTime(rootFreq * 1.5, startTime);
  fifth.connect(fifthGain);
  fifth.start(startTime);
  fifth.stop(end);
}
