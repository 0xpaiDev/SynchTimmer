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

/** Single start beep — fires on prep → climb transition. */
export function playPrepToClimb(): void {
  playBeepAt(880, 400, 0, 0.7);
}

/** Buzz — fires when climb phase ends naturally. */
export function playTimerEnd(): void {
  playBuzzAt(180, 700, 0, 0.7);
}

let countdown10sBuffer: AudioBuffer | null = null;
let countdown10sLoading = false;

/** Preload the 10-second countdown MP3 into the AudioContext buffer. Call after audio is unlocked. */
export async function preloadCountdown10s(): Promise<void> {
  if (countdown10sBuffer || countdown10sLoading) return;
  countdown10sLoading = true;
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const res = await fetch('/countdown-10s.mp3');
    const arrayBuf = await res.arrayBuffer();
    countdown10sBuffer = await ctx.decodeAudioData(arrayBuf);
  } catch (e) {
    console.warn('Failed to preload countdown audio', e);
  } finally {
    countdown10sLoading = false;
  }
}

/** Play the 10-second countdown MP3 — fires once when 10 seconds remain in climb. */
export function playCountdown10s(): void {
  const ctx = getAudioCtx();
  if (!ctx || !countdown10sBuffer) return;
  if (ctx.state !== 'running') ctx.resume();
  const source = ctx.createBufferSource();
  source.buffer = countdown10sBuffer;
  source.connect(ctx.destination);
  source.start();
}
