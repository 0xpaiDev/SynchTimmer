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

/** Single 880 Hz beep — fires when 1 minute of climb time remains. */
export function playOneMinWarning(): void {
  playBeepAt(880, 300, 0);
}

/** Ascending 3-tone burst — fires on prep → climb transition. */
export function playPrepToClimb(): void {
  [440, 660, 880].forEach((freq, i) => playBeepAt(freq, 120, i * 0.12));
}

/** Triple descending beep — fires when climb phase ends naturally. */
export function playTimerEnd(): void {
  [660, 550, 440].forEach((freq, i) => playBeepAt(freq, 220, i * 0.22));
}
