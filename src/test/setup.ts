import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock AudioContext (jsdom has none)
global.AudioContext = vi.fn().mockImplementation(() => ({
  createOscillator: vi.fn(() => ({
    type: 'sine',
    frequency: { setValueAtTime: vi.fn() },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  })),
  createGain: vi.fn(() => ({
    gain: { setValueAtTime: vi.fn() },
    connect: vi.fn(),
  })),
  destination: {},
  currentTime: 0,
})) as any;

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
global.localStorage = localStorageMock as any;

// Mock fetch
global.fetch = vi.fn();

// Mock requestAnimationFrame for testing
// In tests with fake timers, use an immediate implementation
const rafMock = (cb: FrameRequestCallback) => {
  // Try to execute immediately; if in an async context, queue for next tick
  try {
    cb(performance.now());
  } catch (e) {
    // If it fails, try queuing
    queueMicrotask(() => cb(performance.now()));
  }
  return 0;
};

vi.stubGlobal('requestAnimationFrame', rafMock);
vi.stubGlobal('cancelAnimationFrame', (id: number) => {
  // No-op
});
