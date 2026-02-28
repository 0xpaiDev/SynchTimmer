export function secondsToHms(totalSec: number): { h: number; m: number; s: number } {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return { h, m, s };
}

export function hmsToSeconds(h: number, m: number, s: number): number {
  return h * 3600 + m * 60 + s;
}
