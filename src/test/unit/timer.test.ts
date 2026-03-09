import { describe, it, expect } from 'vitest';
import { computeTimerState } from '@/lib/timer';

describe('computeTimerState()', () => {
  // Group A: stopped flag (2 cases)
  describe('Group A: stopped flag', () => {
    it('should return stopped phase when stopped=true, regardless of time', () => {
      const result = computeTimerState(
        1000,  // startTime
        5000,  // climbingMs
        3000,  // preparationMs
        true,  // preparationEnabled
        true,  // stopped (TRUE)
        2000,  // now
        false
      );
      expect(result.phase).toBe('stopped');
      expect(result.remainingMs).toBe(0);
    });

    it('should return stopped phase when stopped=true with paused state present', () => {
      const result = computeTimerState(
        1000,
        5000,
        3000,
        true,
        true,  // stopped (TRUE)
        2000,
        true,  // paused
        1000   // pausedElapsedMs
      );
      expect(result.phase).toBe('stopped');
      expect(result.remainingMs).toBe(0);
    });
  });

  // Group B: paused state (6 cases)
  describe('Group B: paused state', () => {
    it('should return paused phase in prep when pausedElapsedMs < preparationMs', () => {
      const result = computeTimerState(
        1000,
        5000,
        3000,
        true,   // preparationEnabled
        false,
        2000,
        true,   // paused
        1000    // pausedElapsedMs (1000 < 3000 prep)
      );
      expect(result.phase).toBe('paused');
      expect(result.remainingMs).toBe(2000); // 3000 - 1000
    });

    it('should return paused phase in climb when pausedElapsedMs >= preparationMs', () => {
      const result = computeTimerState(
        1000,
        5000,
        3000,
        true,   // preparationEnabled
        false,
        2000,
        true,   // paused
        4000    // pausedElapsedMs (4000 > 3000 prep)
      );
      expect(result.phase).toBe('paused');
      expect(result.remainingMs).toBe(4000); // 8000 - 4000
    });

    it('should return paused with remainingMs=0 when pausedElapsedMs >= total', () => {
      const result = computeTimerState(
        1000,
        5000,
        3000,
        true,
        false,
        2000,
        true,   // paused
        8001    // pausedElapsedMs >= 3000+5000
      );
      expect(result.phase).toBe('paused');
      expect(result.remainingMs).toBe(0);
    });

    it('should ignore prep when disabled but return paused phase', () => {
      const result = computeTimerState(
        1000,
        5000,
        3000,
        false,  // preparationEnabled (FALSE)
        false,
        2000,
        true,   // paused
        2000    // pausedElapsedMs
      );
      expect(result.phase).toBe('paused');
      expect(result.remainingMs).toBe(3000); // 5000 - 2000 (prep ignored)
    });

    it('should return paused with correct remaining when prep disabled and at start', () => {
      const result = computeTimerState(
        1000,
        5000,
        3000,
        false,  // preparationEnabled (FALSE)
        false,
        2000,
        true,   // paused
        0       // pausedElapsedMs
      );
      expect(result.phase).toBe('paused');
      expect(result.remainingMs).toBe(5000); // 5000 - 0
    });
  });

  // Group C: pre-start / elapsed < 0 (3 cases)
  describe('Group C: pre-start / elapsed < 0', () => {
    it('should return idle phase when now < startTime (pre-start)', () => {
      const result = computeTimerState(
        5000,  // startTime
        5000,  // climbingMs
        3000,  // preparationMs
        true,
        false,
        2000,  // now (2000 < 5000 start)
        false
      );
      expect(result.phase).toBe('idle');
      expect(result.remainingMs).toBe(8000); // 3000 + 5000 (total duration)
    });

    it('should return idle with full duration when prep enabled and pre-start', () => {
      const result = computeTimerState(
        10000,
        5000,
        3000,
        true,
        false,
        0,    // now (way before start)
        false
      );
      expect(result.phase).toBe('idle');
      expect(result.remainingMs).toBe(8000);
    });

    it('should return idle with just climb duration when prep disabled and pre-start', () => {
      const result = computeTimerState(
        10000,
        5000,
        3000,
        false, // prep disabled
        false,
        0,
        false
      );
      expect(result.phase).toBe('idle');
      expect(result.remainingMs).toBe(5000); // climb only
    });
  });

  // Group D: prep phase boundaries (4 cases)
  describe('Group D: prep phase boundaries', () => {
    it('should return prep phase at start (elapsed = 0)', () => {
      const result = computeTimerState(
        1000,
        5000,
        3000,
        true,   // prep enabled
        false,
        1000,   // now == startTime
        false
      );
      expect(result.phase).toBe('prep');
      expect(result.remainingMs).toBe(3000); // full prep duration
    });

    it('should return prep phase just before prep end (elapsed = prep - 1ms)', () => {
      const result = computeTimerState(
        1000,
        5000,
        3000,
        true,
        false,
        3999,   // now = 1000 + 2999
        false
      );
      expect(result.phase).toBe('prep');
      expect(result.remainingMs).toBe(1); // 3000 - 2999
    });

    it('should return climb phase at prep end boundary (elapsed = prep)', () => {
      const result = computeTimerState(
        1000,
        5000,
        3000,
        true,
        false,
        4000,   // now = 1000 + 3000 (exactly at prep end)
        false
      );
      expect(result.phase).toBe('climb');
      expect(result.remainingMs).toBe(5000); // full climb duration
    });

    it('should skip prep when disabled', () => {
      const result = computeTimerState(
        1000,
        5000,
        3000,
        false,  // prep disabled
        false,
        1000,   // now == startTime
        false
      );
      expect(result.phase).toBe('climb');
      expect(result.remainingMs).toBe(5000);
    });
  });

  // Group E: climb phase (3 cases)
  describe('Group E: climb phase', () => {
    it('should return climb phase mid-climb with prep enabled', () => {
      const result = computeTimerState(
        1000,
        10000,
        3000,
        true,
        false,
        8000,   // now = 1000 + 7000 (3000 prep done, 4000 into climb)
        false
      );
      expect(result.phase).toBe('climb');
      expect(result.remainingMs).toBe(6000); // 13000 - 8000 elapsed
    });

    it('should return climb with 1ms remaining (last millisecond)', () => {
      const result = computeTimerState(
        1000,
        5000,
        3000,
        true,
        false,
        8999,   // now = 1000 + 7999
        false
      );
      expect(result.phase).toBe('climb');
      expect(result.remainingMs).toBe(1); // 8000 - 7999
    });

    it('should return climb phase with no prep enabled', () => {
      const result = computeTimerState(
        1000,
        5000,
        0,      // no prep
        false,  // prep disabled
        false,
        3000,   // now = 1000 + 2000
        false
      );
      expect(result.phase).toBe('climb');
      expect(result.remainingMs).toBe(3000); // 5000 - 2000
    });
  });

  // Group F: natural end (3 cases)
  describe('Group F: natural end', () => {
    it('should return idle when exactly at total time', () => {
      const result = computeTimerState(
        1000,
        5000,
        3000,
        true,
        false,
        9000,   // now = 1000 + 8000 (exactly total duration)
        false
      );
      expect(result.phase).toBe('idle');
      expect(result.remainingMs).toBe(0);
    });

    it('should return idle when well past total time', () => {
      const result = computeTimerState(
        1000,
        5000,
        3000,
        true,
        false,
        15000,  // now >> total
        false
      );
      expect(result.phase).toBe('idle');
      expect(result.remainingMs).toBe(0);
    });

    it('should return idle at end with prep disabled', () => {
      const result = computeTimerState(
        1000,
        5000,
        3000,
        false,  // prep disabled
        false,
        6000,   // now = 1000 + 5000 (exactly at climb end)
        false
      );
      expect(result.phase).toBe('idle');
      expect(result.remainingMs).toBe(0);
    });
  });

  // Group G: boundary precision (4 cases)
  describe('Group G: boundary precision', () => {
    it('should handle 1ms climb duration', () => {
      const result = computeTimerState(
        1000,
        1,      // climbingMs = 1
        0,      // no prep
        false,
        false,
        1000,   // now = startTime
        false
      );
      expect(result.phase).toBe('climb');
      expect(result.remainingMs).toBe(1);
    });

    it('should handle very large time values (no overflow)', () => {
      const largeTime = 1e12; // large timestamp
      const result = computeTimerState(
        largeTime,
        5000,
        3000,
        true,
        false,
        largeTime + 7000,
        false
      );
      expect(result.phase).toBe('climb');
      expect(result.remainingMs).toBe(1000);
    });

    it('should handle zero preparation time', () => {
      const result = computeTimerState(
        1000,
        5000,
        0,      // zero prep
        true,   // but enabled
        false,
        1000,   // now = startTime
        false
      );
      expect(result.phase).toBe('climb');
      expect(result.remainingMs).toBe(5000);
    });

    it('should handle very small elapsed times', () => {
      const result = computeTimerState(
        1000,
        5000,
        3000,
        true,
        false,
        1000.001,  // 0.001ms into session
        false
      );
      expect(result.phase).toBe('prep');
      expect(result.remainingMs).toBeCloseTo(2999.999, 2);
    });
  });

  // Group H: regression / combined logic (3 cases)
  describe('Group H: regression / combined', () => {
    it('should prioritize stopped over paused', () => {
      // Both stopped and paused are true; stopped should win
      const result = computeTimerState(
        1000,
        5000,
        3000,
        true,
        true,   // stopped (TRUE)
        2000,
        true,   // paused (also TRUE, should be ignored)
        1000
      );
      expect(result.phase).toBe('stopped');
      expect(result.remainingMs).toBe(0);
    });

    it('should ignore prep flag when calculating paused elapsed', () => {
      // paused should use prep-aware logic regardless of prep enabled
      const result = computeTimerState(
        1000,
        5000,
        3000,
        false,  // prep disabled (should not affect paused calc)
        false,
        2000,
        true,   // paused
        1000
      );
      expect(result.phase).toBe('paused');
      // Since prep is disabled, total = 5000, remaining = 5000 - 1000
      expect(result.remainingMs).toBe(4000);
    });

    it('should return correct state after round completes and resets', () => {
      // Simulate: session was running, now it has ended and is reset
      const result = computeTimerState(
        1000,
        5000,
        3000,
        true,
        false,  // not stopped
        1000,   // now back at start time
        false
      );
      expect(result.phase).toBe('prep');
      expect(result.remainingMs).toBe(3000);
    });
  });
});
