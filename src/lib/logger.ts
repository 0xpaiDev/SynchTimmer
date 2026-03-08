/**
 * Lightweight persistent logger.
 * Entries are stored in localStorage so they survive page refreshes.
 * Capped at MAX_ENTRIES to prevent unbounded growth.
 */

const KEY = "compsync_logs";
const MAX_ENTRIES = 500;

let entries: string[] = [];

// Load existing logs from localStorage on module init (client-side only)
if (typeof window !== "undefined") {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored) entries = JSON.parse(stored);
  } catch {
    entries = [];
  }
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    // localStorage full or unavailable — degrade gracefully
  }
}

export function log(tag: string, msg: string, data?: Record<string, unknown>) {
  const ts = new Date().toISOString();
  const line = data
    ? `${ts} [${tag}] ${msg} ${JSON.stringify(data)}`
    : `${ts} [${tag}] ${msg}`;
  console.log(line);
  entries.push(line);
  if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
  persist();
}

export function getLogs(): string[] {
  return entries.slice();
}

export function clearLogs() {
  entries = [];
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
