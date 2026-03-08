"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getFirebaseDb } from "@/lib/firebase";
import { ref, onValue } from "firebase/database";
import { calibrateOffset, getServerNow } from "@/lib/sync";
import CountdownDisplay from "@/components/CountdownDisplay";
import ConnectionStatus, { ConnectionState } from "@/components/ConnectionStatus";
import { unlockAudio, preloadCountdown10s } from "@/lib/audio";
import { log, getLogs, clearLogs } from "@/lib/logger";

interface RoundState {
  startTime: number | null;
  climbingSeconds: number;
  preparationSeconds: number;
  preparationEnabled: boolean;
  stopped: boolean;
  recurring: boolean;
  paused: boolean;
  pausedElapsedMs: number;
}

const DEFAULT_STATE: RoundState = {
  startTime: null,
  climbingSeconds: 300,
  preparationSeconds: 60,
  preparationEnabled: false,
  stopped: false,
  recurring: false,
  paused: false,
  pausedElapsedMs: 0,
};

function LogOverlay({ onClose }: { onClose: () => void }) {
  const [entries, setEntries] = useState<string[]>([]);

  useEffect(() => {
    setEntries(getLogs().reverse());
  }, []);

  function handleClear() {
    clearLogs();
    setEntries([]);
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex flex-col"
      onClick={onClose}
    >
      <div
        className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-white/10 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-white font-mono text-sm font-bold">
          Logs ({entries.length})
        </span>
        <div className="flex gap-3">
          <button
            onClick={handleClear}
            className="text-red-400 hover:text-red-300 text-xs font-mono"
          >
            Clear
          </button>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xs font-mono"
          >
            Close
          </button>
        </div>
      </div>
      <div
        className="flex-1 overflow-y-auto p-3 font-mono text-xs text-green-300 space-y-1"
        onClick={(e) => e.stopPropagation()}
      >
        {entries.length === 0 ? (
          <p className="text-gray-500">No logs yet.</p>
        ) : (
          entries.map((e, i) => (
            <p key={i} className="break-all leading-relaxed">
              {e}
            </p>
          ))
        )}
      </div>
    </div>
  );
}

function DisplayInner() {
  const params = useSearchParams();
  // Use || so that an empty ?room= param also falls back to "default"
  const roomId = params.get("room") || "default";

  const [connState, setConnState] = useState<ConnectionState>("connecting");
  const [round, setRound] = useState<RoundState>(DEFAULT_STATE);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const offsetRef = useRef<number>(0);
  const retryCountRef = useRef<number>(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const recalibTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Prevent screen sleep
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    const acquire = async () => {
      try { lock = await navigator.wakeLock?.request("screen"); } catch { /* unsupported */ }
    };
    acquire();
    const onVisibility = () => { if (document.visibilityState === "visible") acquire(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      lock?.release();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (cancelled) return;

      // 1. Calibrate clock offset
      try {
        const prev = offsetRef.current;
        offsetRef.current = await calibrateOffset();
        if (retryCountRef.current === 0) {
          log("sync", `initial calibration offset=${offsetRef.current}ms`);
        } else {
          log("sync", `recalibrated after reconnect offset=${offsetRef.current}ms drift=${offsetRef.current - prev}ms`);
        }
      } catch {
        log("sync", "calibration failed, using offset=0");
      }

      if (cancelled) return;

      // 2. Subscribe to Firebase RTDB
      const db = getFirebaseDb();
      const roomRef = ref(db, `rooms/${roomId}`);
      setConnState("connecting");
      log("firebase", `subscribing room=${roomId}`);

      // Clean up any previous subscription
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;

      const unsub = onValue(
        roomRef,
        (snapshot) => {
          if (cancelled) return;
          const wasRetrying = retryCountRef.current > 0;
          if (wasRetrying) {
            log("firebase", `reconnected after ${retryCountRef.current} attempt(s)`);
          }
          retryCountRef.current = 0;
          setConnState("connected");

          const data = snapshot.val();
          log("firebase", `snapshot received`, {
            hasData: !!data,
            type: data?.type ?? null,
            startTime: data?.startTime ?? null,
            stopped: data?.stopped ?? null,
          });

          if (!data) {
            setRound(DEFAULT_STATE);
            return;
          }

          const serverStart = new Date(data.startTime).getTime();
          const localStart = serverStart - offsetRef.current;
          const serverNow = getServerNow(offsetRef.current);
          const totalMs =
            (data.preparationEnabled ? data.preparationSeconds * 1000 : 0) +
            data.climbingSeconds * 1000;

          // If round already expired and not manually stopped:
          // - Non-recurring: go idle
          // - Recurring: compute which round we're currently on (no Firebase write needed)
          if (serverNow >= serverStart + totalMs && !data.stopped) {
            if (data.recurring) {
              const elapsed = serverNow - serverStart;
              const n = Math.floor(elapsed / totalMs);
              const curServerStart = serverStart + n * totalMs;
              log("display", `recurring catch-up to round ${n}`, {
                elapsed: Math.round(elapsed / 1000) + "s",
                totalMs: Math.round(totalMs / 1000) + "s",
              });
              setRound({
                startTime: curServerStart - offsetRef.current,
                climbingSeconds: data.climbingSeconds,
                preparationSeconds: data.preparationSeconds,
                preparationEnabled: data.preparationEnabled,
                stopped: false,
                recurring: true,
              });
              return;
            }
            log("display", "early-expiry guard fired → idle", {
              serverNow,
              serverStart,
              totalMs,
              offset: offsetRef.current,
            });
            setRound(DEFAULT_STATE);
            return;
          }

          // Auto-kill: session older than 24h
          if (data.expiresAt && Date.now() >= data.expiresAt) {
            setRound(DEFAULT_STATE);
            return;
          }

          setRound({
            startTime: localStart,
            climbingSeconds: data.climbingSeconds,
            preparationSeconds: data.preparationSeconds,
            preparationEnabled: data.preparationEnabled,
            stopped: data.stopped ?? false,
            recurring: data.recurring ?? false,
            paused: data.paused ?? false,
            pausedElapsedMs: data.pausedElapsedMs ?? 0,
          });
        },
        (error) => {
          if (cancelled) return;
          const delay = Math.min(2000 * Math.pow(2, retryCountRef.current), 30000);
          log("firebase", `error — retrying in ${delay}ms (attempt ${retryCountRef.current + 1})`, {
            message: error.message,
          });
          setConnState("offline");
          retryCountRef.current += 1;
          retryTimerRef.current = setTimeout(() => {
            if (!cancelled) init();
          }, delay);
        }
      );

      unsubscribeRef.current = unsub;
    }

    init();

    // Periodic offset recalibration every 5 minutes
    recalibTimerRef.current = setInterval(async () => {
      if (cancelled) return;
      try {
        const prev = offsetRef.current;
        offsetRef.current = await calibrateOffset();
        log("sync", `recalibrated offset=${offsetRef.current}ms drift=${offsetRef.current - prev}ms`);
      } catch {
        log("sync", "periodic recalibration failed");
      }
    }, 5 * 60 * 1000);

    return () => {
      cancelled = true;
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
      if (retryTimerRef.current !== null) clearTimeout(retryTimerRef.current);
      if (recalibTimerRef.current !== null) clearInterval(recalibTimerRef.current);
    };
  }, [roomId]);

  // Recurring: display fires the next START when round expires — works even when admin is closed
  useEffect(() => {
    if (!round.recurring || !round.startTime || round.stopped || round.paused) return;

    const totalMs =
      (round.preparationEnabled ? round.preparationSeconds * 1000 : 0) +
      round.climbingSeconds * 1000;
    const delay = round.startTime + totalMs - Date.now();
    if (delay <= 0) return;

    const timerId = setTimeout(() => {
      // 1. Advance the display immediately — no network required.
      //    nextLocalStart is deterministic: currentStart + totalMs.
      const nextLocalStart = (round.startTime ?? 0) + totalMs;
      log("display", "recurring local advance");
      setRound(prev => ({ ...prev, startTime: nextLocalStart }));

      // 2. Sync Firebase in the background so other displays also advance.
      //    Failure here is fine — this display is already running the next round.
      fetch("/api/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "START",
          roomId,
          climbingSeconds: round.climbingSeconds,
          preparationSeconds: round.preparationSeconds,
          preparationEnabled: round.preparationEnabled,
          recurring: round.recurring,
        }),
      })
        .then(() => log("display", "recurring firebase sync: OK"))
        .catch(() => log("display", "recurring firebase sync: failed (running locally)"));
    }, delay);

    return () => clearTimeout(timerId);
  }, [round.startTime, round.recurring, round.stopped, roomId]);

  return (
    <div className="relative w-full h-screen">
      <ConnectionStatus state={connState} />
      <CountdownDisplay
        startTime={round.startTime}
        climbingSeconds={round.climbingSeconds}
        preparationSeconds={round.preparationSeconds}
        preparationEnabled={round.preparationEnabled}
        stopped={round.stopped}
        audioUnlocked={audioUnlocked}
        paused={round.paused}
        pausedElapsedMs={round.pausedElapsedMs}
      />

      {/* Audio unlock overlay */}
      {!audioUnlocked && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 cursor-pointer"
          onClick={() => {
            unlockAudio();
            preloadCountdown10s();
            setAudioUnlocked(true);
          }}
        >
          <p className="text-white text-2xl font-bold tracking-widest uppercase select-none">
            Tap to Enable Sound
          </p>
        </div>
      )}

      {/* Log button */}
      <button
        onClick={() => setShowLogs(true)}
        className="fixed bottom-3 right-3 z-40 px-2 py-1 rounded bg-black/40 text-white/40 hover:text-white/80 font-mono text-xs select-none"
        aria-label="Show logs"
      >
        LOG
      </button>

      {/* Log overlay */}
      {showLogs && <LogOverlay onClose={() => setShowLogs(false)} />}
    </div>
  );
}

export default function DisplayPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
          Loading...
        </div>
      }
    >
      <DisplayInner />
    </Suspense>
  );
}
