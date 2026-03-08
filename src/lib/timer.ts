export type TimerPhase = "idle" | "prep" | "climb" | "stopped" | "paused";

export interface TimerState {
  phase: TimerPhase;
  remainingMs: number;
}

/**
 * Given the current round parameters and the current local time,
 * calculates what phase we're in and how many ms remain in the total round.
 */
export function computeTimerState(
  startTime: number,        // scheduled start timestamp (ms, server-adjusted)
  climbingMs: number,
  preparationMs: number,
  preparationEnabled: boolean,
  stopped: boolean,
  now: number,              // current local time (ms)
  paused?: boolean,
  pausedElapsedMs?: number
): TimerState {
  if (stopped) {
    return { phase: "stopped", remainingMs: 0 };
  }

  if (paused && pausedElapsedMs !== undefined) {
    const totalMs = preparationEnabled ? preparationMs + climbingMs : climbingMs;
    const elapsed = pausedElapsedMs;
    if (elapsed >= totalMs) return { phase: "paused", remainingMs: 0 };
    if (preparationEnabled && elapsed < preparationMs) {
      return { phase: "paused", remainingMs: preparationMs - elapsed };
    }
    return { phase: "paused", remainingMs: totalMs - elapsed };
  }

  const totalMs = preparationEnabled
    ? preparationMs + climbingMs
    : climbingMs;

  const elapsed = now - startTime;

  if (elapsed < 0) {
    // Not started yet (within the pre-start window)
    return { phase: "idle", remainingMs: totalMs };
  }

  if (elapsed >= totalMs) {
    return { phase: "idle", remainingMs: 0 };
  }

  if (preparationEnabled && elapsed < preparationMs) {
    return { phase: "prep", remainingMs: preparationMs - elapsed };
  }

  return { phase: "climb", remainingMs: totalMs - elapsed };
}
