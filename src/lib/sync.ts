/**
 * Fetches server time and calculates the local clock offset.
 * offset = serverTime - Date.now()
 * To get "what the server thinks it is now": Date.now() + offset
 */
export async function calibrateOffset(): Promise<number> {
  const before = Date.now();
  const res = await fetch("/api/time");
  const after = Date.now();
  const { serverTime } = await res.json();

  // Estimate one-way latency as half of round-trip
  const latency = (after - before) / 2;
  const offset = serverTime + latency - after;
  return offset;
}

export function getServerNow(offset: number): number {
  return Date.now() + offset;
}
