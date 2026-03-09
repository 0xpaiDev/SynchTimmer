import { describe, it, expect } from 'vitest';
import { secondsToHms, hmsToSeconds } from '@/lib/timeFormat';

describe('timeFormat utilities', () => {
  describe('secondsToHms()', () => {
    it('should convert 0 seconds to 0h 0m 0s', () => {
      const result = secondsToHms(0);
      expect(result).toEqual({ h: 0, m: 0, s: 0 });
    });

    it('should convert 59 seconds to 0h 0m 59s', () => {
      const result = secondsToHms(59);
      expect(result).toEqual({ h: 0, m: 0, s: 59 });
    });

    it('should convert 60 seconds to 0h 1m 0s', () => {
      const result = secondsToHms(60);
      expect(result).toEqual({ h: 0, m: 1, s: 0 });
    });

    it('should convert 61 seconds to 0h 1m 1s', () => {
      const result = secondsToHms(61);
      expect(result).toEqual({ h: 0, m: 1, s: 1 });
    });

    it('should convert 3600 seconds to 1h 0m 0s', () => {
      const result = secondsToHms(3600);
      expect(result).toEqual({ h: 1, m: 0, s: 0 });
    });

    it('should convert 3661 seconds to 1h 1m 1s', () => {
      const result = secondsToHms(3661);
      expect(result).toEqual({ h: 1, m: 1, s: 1 });
    });

    it('should convert 7199 seconds to 1h 59m 59s', () => {
      const result = secondsToHms(7199);
      expect(result).toEqual({ h: 1, m: 59, s: 59 });
    });

    it('should convert 300 seconds to 0h 5m 0s', () => {
      const result = secondsToHms(300);
      expect(result).toEqual({ h: 0, m: 5, s: 0 });
    });
  });

  describe('hmsToSeconds()', () => {
    it('should convert 0h 0m 0s to 0 seconds', () => {
      const result = hmsToSeconds(0, 0, 0);
      expect(result).toBe(0);
    });

    it('should convert 0h 0m 59s to 59 seconds', () => {
      const result = hmsToSeconds(0, 0, 59);
      expect(result).toBe(59);
    });

    it('should convert 0h 1m 0s to 60 seconds', () => {
      const result = hmsToSeconds(0, 1, 0);
      expect(result).toBe(60);
    });

    it('should convert 1h 0m 0s to 3600 seconds', () => {
      const result = hmsToSeconds(1, 0, 0);
      expect(result).toBe(3600);
    });

    it('should convert 1h 1m 1s to 3661 seconds', () => {
      const result = hmsToSeconds(1, 1, 1);
      expect(result).toBe(3661);
    });
  });

  describe('roundtrip conversion', () => {
    it('should roundtrip 300 seconds (5 minutes)', () => {
      const original = 300;
      const { h, m, s } = secondsToHms(original);
      const back = hmsToSeconds(h, m, s);
      expect(back).toBe(original);
    });

    it('should roundtrip 3661 seconds (1h 1m 1s)', () => {
      const original = 3661;
      const { h, m, s } = secondsToHms(original);
      const back = hmsToSeconds(h, m, s);
      expect(back).toBe(original);
    });
  });
});
