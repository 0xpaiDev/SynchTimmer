import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getServerNow, calibrateOffset } from '@/lib/sync';

// Mock Date.now() for consistent testing
const mockDateNow = vi.spyOn(global.Date, 'now');

describe('sync utilities', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('getServerNow()', () => {
    it('should return Date.now() + offset when offset is 0', () => {
      vi.setSystemTime(1000);
      const result = getServerNow(0);
      expect(result).toBe(1000);
    });

    it('should return Date.now() + offset when offset is 500ms', () => {
      vi.setSystemTime(1000);
      const result = getServerNow(500);
      expect(result).toBe(1500);
    });

    it('should return Date.now() + offset when offset is negative (-200ms)', () => {
      vi.setSystemTime(1000);
      const result = getServerNow(-200);
      expect(result).toBe(800);
    });
  });

  describe('calibrateOffset()', () => {
    it('should calculate offset correctly with RTT=100ms (latency=50ms)', async () => {
      // Simulate: before=1000, fetch takes 100ms, after=1100, serverTime=1050
      // latency = (1100 - 1000) / 2 = 50
      // offset = 1050 + 50 - 1100 = 0
      vi.setSystemTime(1000);

      global.fetch = vi.fn(async () => {
        vi.advanceTimersByTime(100); // simulate 100ms fetch time
        return {
          json: async () => ({ serverTime: 1050 }),
        };
      }) as any;

      const offset = await calibrateOffset();
      // offset = serverTime + latency - after
      // offset = 1050 + 50 - 1100 = 0
      expect(offset).toBe(0);
    });

    it('should calculate offset with RTT=0ms (instant response)', async () => {
      // before=1000, after=1000 (instant), serverTime=1050
      // latency = 0
      // offset = 1050 + 0 - 1000 = 50
      vi.setSystemTime(1000);

      global.fetch = vi.fn(async () => {
        // No time advancement (RTT=0)
        return {
          json: async () => ({ serverTime: 1050 }),
        };
      }) as any;

      const offset = await calibrateOffset();
      expect(offset).toBe(50);
    });

    it('should handle server time behind local time (negative offset)', async () => {
      // before=2000, after=2100, serverTime=1950
      // latency = 50
      // offset = 1950 + 50 - 2100 = -100
      vi.setSystemTime(2000);

      global.fetch = vi.fn(async () => {
        vi.advanceTimersByTime(100); // simulate 100ms fetch time
        return {
          json: async () => ({ serverTime: 1950 }),
        };
      }) as any;

      const offset = await calibrateOffset();
      expect(offset).toBe(-100);
    });

    it('should reject when fetch fails', async () => {
      mockDateNow
        .mockReturnValueOnce(1000)
        .mockReturnValueOnce(1100);

      global.fetch = vi.fn(() =>
        Promise.reject(new Error('Network error'))
      ) as any;

      await expect(calibrateOffset()).rejects.toThrow('Network error');
    });

    it('should reject when response JSON parsing fails', async () => {
      mockDateNow
        .mockReturnValueOnce(1000)
        .mockReturnValueOnce(1100);

      global.fetch = vi.fn(() =>
        Promise.resolve({
          json: () => Promise.reject(new Error('Invalid JSON')),
        })
      ) as any;

      await expect(calibrateOffset()).rejects.toThrow('Invalid JSON');
    });

    it('should handle large offset values correctly', async () => {
      // Simulate significant clock skew
      vi.setSystemTime(1000);

      global.fetch = vi.fn(async () => {
        vi.advanceTimersByTime(200); // simulate 200ms fetch time
        return {
          json: async () => ({ serverTime: 10000 }),
        };
      }) as any;

      const offset = await calibrateOffset();
      // latency = 100, offset = 10000 + 100 - 1200 = 8900
      expect(offset).toBe(8900);
    });
  });
});
