// Catalogue of notification-sound variants for the SoundsShowcase
// audition page. Each variant is a self-contained scheduler over an
// `AudioContext`; nothing else in the app imports this — only the
// showcase page does, and the chosen variant is then copied into
// `src/lib/notifications/sound.ts` as the actual notification.
//
// Variants vary along three axes: pitch register (high vs low), the
// interval between stacked oscillators (perfect-fifth vs major-third
// vs octave), and the rhythm (single strike, double, or triple).

export interface SoundVariant {
  /** Stable id used as React key and as the option value. */
  id: string;
  /** Short label shown on the audition card. */
  name: string;
  /** One-line characterisation shown below the label. */
  description: string;
  /**
   * Schedule the variant on `ctx`, starting at `ctx.currentTime`.
   * Implementations create their own oscillators / gain nodes and
   * leave nothing dangling — every node has a definite stop time.
   */
  play: (ctx: AudioContext) => void;
}

// --- Shared synthesis primitives ------------------------------------

interface StrikeOptions {
  /** When (in `ctx`-clock seconds) the strike begins. */
  startTime: number;
  /** How long the envelope rings, in seconds. */
  duration: number;
  /** Peak gain after the attack ramp (0..1). */
  peakGain: number;
  /** Frequency-and-mix pairs of oscillators stacked into the strike. */
  partials: ReadonlyArray<{ freq: number; mix: number }>;
  /** Oscillator waveform — `triangle` is brighter than `sine`. */
  type?: OscillatorType;
  /** Linear-attack length, in seconds. Default 8 ms. */
  attack?: number;
}

function strike(ctx: AudioContext, options: StrikeOptions): void {
  const {
    startTime,
    duration,
    peakGain,
    partials,
    type = "triangle",
    attack = 0.008,
  } = options;
  const end = startTime + duration;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(peakGain, startTime + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  gain.connect(ctx.destination);

  for (const { freq, mix } of partials) {
    const subGain = ctx.createGain();
    subGain.gain.value = mix;
    subGain.connect(gain);

    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);
    osc.connect(subGain);
    osc.start(startTime);
    osc.stop(end);
  }
}

// --- Variants -------------------------------------------------------

// --- Slack-family helpers -------------------------------------------

/** A single mellow ring at the given root frequency, with its perfect
 *  fifth as an overtone — the Slack-Mellow timbre, parameterised. */
function mellowStrike(
  ctx: AudioContext,
  startTime: number,
  rootFreq: number,
  fifthFreq: number,
  duration: number,
  peakGain: number,
): void {
  strike(ctx, {
    startTime,
    duration,
    peakGain,
    partials: [
      { freq: rootFreq, mix: 1 },
      { freq: fifthFreq, mix: 0.5 },
    ],
  });
}

// --- Doorbell-family helpers ----------------------------------------

/** A descending two-note doorbell from `highFreq` to `lowFreq`, with
 *  each note's perfect-fourth overtone mixed in. The `spacing` is the
 *  gap between the two strikes' start times. */
function doorbell(
  ctx: AudioContext,
  startTime: number,
  highFreq: number,
  lowFreq: number,
  spacing: number,
  firstDuration: number,
  secondDuration: number,
): void {
  strike(ctx, {
    startTime,
    duration: firstDuration,
    peakGain: 0.13,
    partials: [
      { freq: highFreq, mix: 1 },
      { freq: highFreq * 1.5, mix: 0.4 },
    ],
  });
  strike(ctx, {
    startTime: startTime + spacing,
    duration: secondDuration,
    peakGain: 0.13,
    partials: [
      { freq: lowFreq, mix: 1 },
      { freq: lowFreq * 1.5, mix: 0.4 },
    ],
  });
}

export const SOUND_VARIANTS: readonly SoundVariant[] = [
  // --- Slack-family ----------------------------------------------
  {
    id: "slack-mellow",
    name: "Slack Mellow",
    description:
      "База: A4+E5 (фифт), один удар, decay 1.0 с. Спокойный фон.",
    play: (ctx) => mellowStrike(ctx, ctx.currentTime, 440, 659.3, 1.0, 0.14),
  },
  {
    id: "slack-bright",
    name: "Slack Bright",
    description:
      "Та же база A4+E5, но фифт громче (0.7 вместо 0.5) — звонче, ярче.",
    play: (ctx) =>
      strike(ctx, {
        startTime: ctx.currentTime,
        duration: 1.0,
        peakGain: 0.14,
        partials: [
          { freq: 440, mix: 1 },
          { freq: 659.3, mix: 0.7 },
        ],
      }),
  },

  // --- Doorbell-family: tight peaks, long Slack-Mellow-style tail
  // Each variant fires two notes close together (≤150 мс between
  // strike onsets), but each note rings out for ~1.2 с — so the
  // attack reads as a quick two-note motif and the *tail* is a
  // single sustained chord, the way Slack Mellow lingers.
  {
    id: "doorbell-tight",
    name: "Doorbell Tight",
    description:
      "База G5→E5, пики через 120 мс, оба тянутся 1.2 с — две ноты сливаются в один длинный звон.",
    play: (ctx) => doorbell(ctx, ctx.currentTime, 784, 659.3, 0.12, 1.2, 1.2),
  },
  {
    id: "doorbell-tight-wide",
    name: "Doorbell Tight Wide",
    description:
      "Шире интервал: G5→C5 (перфект-фифт вниз), пики через 130 мс, оба тянутся 1.2 с.",
    play: (ctx) =>
      doorbell(ctx, ctx.currentTime, 784, 523.3, 0.13, 1.2, 1.2),
  },
  {
    id: "doorbell-tight-bright",
    name: "Doorbell Tight Bright",
    description:
      "Высокие ноты B5→G5, пики через 110 мс, оба тянутся 1.0 с — светлый перезвон.",
    play: (ctx) => doorbell(ctx, ctx.currentTime, 987.8, 784, 0.11, 1.0, 1.0),
  },
  {
    id: "doorbell-tight-low",
    name: "Doorbell Tight Low",
    description:
      "Низкие ноты E5→C5, пики через 130 мс, оба тянутся 1.3 с — глубже, теплее.",
    play: (ctx) =>
      doorbell(ctx, ctx.currentTime, 659.3, 523.3, 0.13, 1.3, 1.3),
  },
  {
    id: "doorbell-bloom",
    name: "Doorbell Bloom",
    description:
      "G5→E5, пики через 90 мс, мягкий attack 40 мс на обеих, тянутся 1.5 с — «распускающийся» звон.",
    play: (ctx) => {
      const now = ctx.currentTime;
      strike(ctx, {
        startTime: now,
        duration: 1.5,
        peakGain: 0.13,
        attack: 0.04,
        partials: [
          { freq: 784, mix: 1 },
          { freq: 784 * 1.5, mix: 0.4 },
        ],
      });
      strike(ctx, {
        startTime: now + 0.09,
        duration: 1.5,
        peakGain: 0.13,
        attack: 0.04,
        partials: [
          { freq: 659.3, mix: 1 },
          { freq: 659.3 * 1.5, mix: 0.4 },
        ],
      });
    },
  },
  {
    id: "doorbell-tight-triplet",
    name: "Doorbell Tight Triplet",
    description:
      "Три ноты G5 → E5 → C5 через 90 мс, каждая тянется 1.2 с — три быстрых пика и один длинный хвост.",
    play: (ctx) => {
      const now = ctx.currentTime;
      const notes: Array<[number, number]> = [
        [784, 0],
        [659.3, 0.09],
        [523.3, 0.18],
      ];
      for (const [freq, offset] of notes) {
        strike(ctx, {
          startTime: now + offset,
          duration: 1.2,
          peakGain: 0.11,
          partials: [
            { freq, mix: 1 },
            { freq: freq * 1.5, mix: 0.4 },
          ],
        });
      }
    },
  },
];
