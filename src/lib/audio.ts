let _ctx: AudioContext | null = null;

function getAudioCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!_ctx) _ctx = new AudioContext();
  return _ctx;
}

/** Call inside a user-gesture handler to unlock the AudioContext early. */
export function unlockAudio(): void {
  const ctx = getAudioCtx();
  if (ctx && ctx.state === "suspended") ctx.resume();
}

/** Schedules a single oscillator tone starting at ctx.currentTime + offsetSec. */
function playBeepAt(
  freq: number,
  durationMs: number,
  offsetSec: number,
  gainValue = 0.4
): void {
  const ctx = getAudioCtx();
  if (!ctx) return;
  // iOS Safari suspends AudioContext after inactivity; re-resume before scheduling
  if (ctx.state !== "running") ctx.resume();
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.connect(g);
  g.connect(ctx.destination);
  osc.type = "sine";
  const t0 = ctx.currentTime + offsetSec;
  const t1 = t0 + durationMs / 1000;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(gainValue, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t1);
  osc.start(t0);
  osc.stop(t1);
}

/** Schedules a short square-wave click at ctx.currentTime + offsetSec. */
function playClickAt(offsetSec: number): void {
  const ctx = getAudioCtx();
  if (!ctx) return;
  if (ctx.state !== "running") ctx.resume();
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.connect(g);
  g.connect(ctx.destination);
  osc.type = "square";
  const t0 = ctx.currentTime + offsetSec;
  const t1 = t0 + 0.02;
  osc.frequency.setValueAtTime(1000, t0);
  g.gain.setValueAtTime(0.9, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t1);
  osc.start(t0);
  osc.stop(t1);
}

/** Schedules a sawtooth buzz starting at ctx.currentTime + offsetSec. */
function playBuzzAt(
  freq: number,
  durationMs: number,
  offsetSec: number,
  gainValue = 0.7
): void {
  const ctx = getAudioCtx();
  if (!ctx) return;
  if (ctx.state !== "running") ctx.resume();
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.connect(g);
  g.connect(ctx.destination);
  osc.type = "sawtooth";
  const t0 = ctx.currentTime + offsetSec;
  const t1 = t0 + durationMs / 1000;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(gainValue, t0);
  g.gain.linearRampToValueAtTime(0.001, t1);
  osc.start(t0);
  osc.stop(t1);
}

/** Single 880 Hz beep — fires when 1 minute of climb time remains. */
export function playOneMinWarning(): void {
  playBeepAt(880, 300, 0);
}

/** Ascending 3-tone burst — fires on prep → climb transition. */
export function playPrepToClimb(): void {
  [440, 660, 880].forEach((freq, i) => playBeepAt(freq, 120, i * 0.12));
}

/** 4 rapid clicks then a buzz — fires when climb phase ends naturally. */
export function playTimerEnd(): void {
  [0, 0.08, 0.16, 0.24].forEach((offset) => playClickAt(offset));
  playBuzzAt(180, 700, 0.38, 0.7);
}

/** Two ascending tones — fires at exactly 5 seconds remaining. */
export function playFiveSecWarning(): void {
  playBeepAt(600, 100, 0, 0.6);
  playBeepAt(900, 100, 0.12, 0.8);
}

/** Single escalating beep — fires once per second for the last 10 seconds of climb. */
export function playLastSecondsBeep(secsLeft: number): void {
  const gain = 0.4 + (10 - secsLeft) * 0.06;
  playBeepAt(880, 80, 0, gain);
}
