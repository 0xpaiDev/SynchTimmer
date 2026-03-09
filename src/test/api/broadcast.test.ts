import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock getAdminDb - must come before importing the route
vi.mock('@/lib/firebaseAdmin', () => ({
  getAdminDb: vi.fn(),
}));

import { POST } from '@/app/api/broadcast/route';
import { getAdminDb } from '@/lib/firebaseAdmin';

describe('POST /api/broadcast', () => {
  let mockRef: any;
  let mockDb: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock Firebase ref
    mockRef = {
      set: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue({ val: () => null }),
      update: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
    };

    // Setup mock Database
    mockDb = {
      ref: vi.fn(() => mockRef),
    };

    (getAdminDb as any).mockReturnValue(mockDb);
  });

  // Helper to create a request
  const createRequest = (body: any) => {
    return {
      json: vi.fn().mockResolvedValue(body),
    } as any as NextRequest;
  };

  describe('Validation errors', () => {
    it('should return 400 when type is missing', async () => {
      const req = createRequest({ roomId: 'test-room' });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('Missing type or roomId');
    });

    it('should return 400 when roomId is missing', async () => {
      const req = createRequest({ type: 'START' });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('Missing type or roomId');
    });

    it('should return 400 when type is unknown', async () => {
      const req = createRequest({
        type: 'UNKNOWN_TYPE',
        roomId: 'test-room',
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('Unknown type');
    });
  });

  describe('START action', () => {
    it('should write correct RTDB shape on START', async () => {
      const now = Date.now();
      vi.useFakeTimers();
      vi.setSystemTime(now);

      const req = createRequest({
        type: 'START',
        roomId: 'test-room',
        climbingSeconds: 60,
        preparationSeconds: 30,
        preparationEnabled: true,
        recurring: false,
      });

      const res = await POST(req);
      expect(res.status).toBe(200);

      // Verify set() was called with correct structure
      expect(mockRef.set).toHaveBeenCalledOnce();
      const callArgs = mockRef.set.mock.calls[0][0];

      expect(callArgs.type).toBe('START');
      expect(callArgs.climbingSeconds).toBe(60);
      expect(callArgs.preparationSeconds).toBe(30);
      expect(callArgs.preparationEnabled).toBe(true);
      expect(callArgs.recurring).toBe(false);
      expect(callArgs.stopped).toBe(false);
      expect(callArgs.paused).toBe(false);
      expect(callArgs.pausedElapsedMs).toBe(0);
      expect(callArgs.updatedAt).toBe(now);
      expect(callArgs.expiresAt).toBe(now + 500 + 24 * 60 * 60 * 1000);

      vi.useRealTimers();
    });

    it('should set startTime ~500ms in future', async () => {
      const now = Date.now();
      vi.useFakeTimers();
      vi.setSystemTime(now);

      const req = createRequest({
        type: 'START',
        roomId: 'test-room',
        climbingSeconds: 60,
        preparationSeconds: 30,
        preparationEnabled: true,
      });

      const res = await POST(req);
      const json = await res.json();

      const startTime = new Date(json.startTime).getTime();
      const expectedTime = now + 500;
      expect(startTime).toBe(expectedTime);

      vi.useRealTimers();
    });

    it('should respect recurring flag when set', async () => {
      const req = createRequest({
        type: 'START',
        roomId: 'test-room',
        climbingSeconds: 60,
        preparationSeconds: 30,
        preparationEnabled: true,
        recurring: true,
      });

      const res = await POST(req);
      expect(res.status).toBe(200);

      const callArgs = mockRef.set.mock.calls[0][0];
      expect(callArgs.recurring).toBe(true);
    });

    it('should default recurring to false', async () => {
      const req = createRequest({
        type: 'START',
        roomId: 'test-room',
        climbingSeconds: 60,
        preparationSeconds: 30,
        preparationEnabled: false,
      });

      const res = await POST(req);
      expect(res.status).toBe(200);

      const callArgs = mockRef.set.mock.calls[0][0];
      expect(callArgs.recurring).toBe(false);
    });

    it('should return 400 when climbingSeconds is not a valid number', async () => {
      const req = createRequest({
        type: 'START',
        roomId: 'test-room',
        climbingSeconds: 'abc',
        preparationSeconds: 30,
        preparationEnabled: true,
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('Invalid climbingSeconds');
    });

    it('should return 400 when climbingSeconds is 0', async () => {
      const req = createRequest({
        type: 'START',
        roomId: 'test-room',
        climbingSeconds: 0,
        preparationSeconds: 30,
        preparationEnabled: true,
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('Invalid climbingSeconds');
    });

    it('should return 400 when climbingSeconds exceeds 7200', async () => {
      const req = createRequest({
        type: 'START',
        roomId: 'test-room',
        climbingSeconds: 7201,
        preparationSeconds: 30,
        preparationEnabled: true,
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('Invalid climbingSeconds');
    });
  });

  describe('STOP action', () => {
    it('should call update with stopped=true', async () => {
      const req = createRequest({
        type: 'STOP',
        roomId: 'test-room',
      });

      const res = await POST(req);
      expect(res.status).toBe(200);

      expect(mockRef.update).toHaveBeenCalledOnce();
      const callArgs = mockRef.update.mock.calls[0][0];
      expect(callArgs.stopped).toBe(true);
      expect(callArgs.type).toBe('STOP');
    });
  });

  describe('PAUSE action', () => {
    it('should compute pausedElapsedMs correctly when session exists', async () => {
      vi.useFakeTimers();
      const now = 10000;
      vi.setSystemTime(now);

      const startTime = now - 5000; // 5 seconds ago
      mockRef.get.mockResolvedValue({
        val: () => ({
          type: 'START',
          startTime: new Date(startTime).toISOString(),
          climbingSeconds: 60,
        }),
      });

      const req = createRequest({
        type: 'PAUSE',
        roomId: 'test-room',
      });

      const res = await POST(req);
      expect(res.status).toBe(200);

      expect(mockRef.update).toHaveBeenCalledOnce();
      const callArgs = mockRef.update.mock.calls[0][0];
      expect(callArgs.paused).toBe(true);
      expect(callArgs.type).toBe('PAUSE');
      // pausedElapsedMs should be now - startTime = 10000 - 5000 = 5000
      expect(callArgs.pausedElapsedMs).toBe(5000);

      vi.useRealTimers();
    });

    it('should return 400 when no active session exists', async () => {
      mockRef.get.mockResolvedValue({ val: () => null });

      const req = createRequest({
        type: 'PAUSE',
        roomId: 'test-room',
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('No active session');
    });

    it('should return 400 when session has no startTime', async () => {
      mockRef.get.mockResolvedValue({
        val: () => ({
          type: 'START',
          climbingSeconds: 60,
        }),
      });

      const req = createRequest({
        type: 'PAUSE',
        roomId: 'test-room',
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('No active session');
    });
  });

  describe('RESUME action', () => {
    it('should compute new startTime correctly', async () => {
      vi.useFakeTimers();
      const now = 20000;
      vi.setSystemTime(now);

      const pausedElapsedMs = 5000; // paused after 5 seconds
      mockRef.get.mockResolvedValue({
        val: () => ({
          type: 'PAUSE',
          paused: true,
          pausedElapsedMs,
          climbingSeconds: 60,
        }),
      });

      const req = createRequest({
        type: 'RESUME',
        roomId: 'test-room',
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(mockRef.update).toHaveBeenCalledOnce();
      const callArgs = mockRef.update.mock.calls[0][0];
      expect(callArgs.paused).toBe(false);
      expect(callArgs.type).toBe('RESUME');

      // startTime should be now - pausedElapsedMs = 20000 - 5000 = 15000
      const responseStartTime = new Date(json.startTime).getTime();
      const expectedStartTime = now - pausedElapsedMs;
      expect(responseStartTime).toBe(expectedStartTime);

      vi.useRealTimers();
    });

    it('should return 400 when no paused session exists', async () => {
      mockRef.get.mockResolvedValue({ val: () => null });

      const req = createRequest({
        type: 'RESUME',
        roomId: 'test-room',
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('No paused session');
    });

    it('should return 400 when session is not paused (Fix 3)', async () => {
      mockRef.get.mockResolvedValue({
        val: () => ({
          type: 'START',
          paused: false, // not paused
          pausedElapsedMs: 5000,
          climbingSeconds: 60,
        }),
      });

      const req = createRequest({
        type: 'RESUME',
        roomId: 'test-room',
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('No paused session');
    });

    it('should return 400 when pausedElapsedMs is undefined', async () => {
      mockRef.get.mockResolvedValue({
        val: () => ({
          type: 'START',
          paused: true,
          climbingSeconds: 60,
        }),
      });

      const req = createRequest({
        type: 'RESUME',
        roomId: 'test-room',
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('No paused session');
    });
  });

  describe('RESET action', () => {
    it('should call remove() on the room ref', async () => {
      const req = createRequest({
        type: 'RESET',
        roomId: 'test-room',
      });

      const res = await POST(req);
      expect(res.status).toBe(200);

      expect(mockRef.remove).toHaveBeenCalledOnce();
    });

    it('should return { ok: true } response', async () => {
      const req = createRequest({
        type: 'RESET',
        roomId: 'test-room',
      });

      const res = await POST(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.startTime).toBeUndefined();
    });
  });
});
