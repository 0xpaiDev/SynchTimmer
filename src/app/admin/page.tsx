"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Suspense } from "react";
import { computeTimerState, TimerPhase } from "@/lib/timer";
import { secondsToHms, hmsToSeconds } from "@/lib/timeFormat";
import { playOneMinWarning, playPrepToClimb, playTimerEnd, playFiveSecWarning } from "@/lib/audio";

function fmtMs(ms: number): string {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const ADMIN_PIN = process.env.NEXT_PUBLIC_ADMIN_PIN ?? "1234";

function generateRoomId(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function AdminInner() {
  // Auth
  const [pin, setPin] = useState("");
  const [authed, setAuthed] = useState(false);
  const [pinError, setPinError] = useState(false);

  // Room
  const [roomId, setRoomId] = useState(() => generateRoomId());

  // Timer config
  const [climbingSeconds, setClimbingSeconds] = useState(300);
  const [preparationSeconds, setPreparationSeconds] = useState(60);
  const [preparationEnabled, setPreparationEnabled] = useState(false);
  const [recurring, setRecurring] = useState(false);

  // Time input modes
  const [climbInputMode, setClimbInputMode] = useState<"s" | "hms">("s");
  const [prepInputMode, setPrepInputMode] = useState<"s" | "hms">("s");

  // Admin / UI state
  const [status, setStatus] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [muted, setMuted] = useState(false);

  // Confirmation state for destructive actions
  const [confirmAction, setConfirmAction] = useState<"STOP" | "RESET" | null>(null);

  // Running clock state
  const [timerStartTime, setTimerStartTime] = useState<number | null>(null);
  const [timerStopped, setTimerStopped] = useState(false);
  const [clockPhase, setClockPhase] = useState<TimerPhase>("idle");
  const [clockRemaining, setClockRemaining] = useState(0);

  // Refs — keep values fresh in rAF closures without restarting the loop
  const clockConfigRef = useRef({ climbingSeconds, preparationSeconds, preparationEnabled });
  clockConfigRef.current = { climbingSeconds, preparationSeconds, preparationEnabled };

  const recurringRef = useRef(false);
  recurringRef.current = recurring;

  const mutedRef = useRef(false);
  mutedRef.current = muted;

  // Recurring debounce guard — set sync before async broadcast call
  const hasAutoRestartedRef = useRef(false);

  // Phase/remaining tracking for audio + auto-restart
  const prevPhaseAdminRef = useRef<TimerPhase>("idle");
  const prevRemainingAdminRef = useRef(0);

  // Sound fired flags
  const adminSound1minFiredRef = useRef(false);
  const adminSoundStartFiredRef = useRef(false);
  const adminSoundEndFiredRef = useRef(false);
  const adminSound5secFiredRef = useRef(false);

  // Stable ref to latest broadcast fn — avoids restarting the rAF loop on config changes
  const broadcastRef = useRef<((type: "START" | "RESET" | "STOP") => Promise<void>) | null>(null);

  const displayUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/display?room=${roomId}`
      : `/display?room=${roomId}`;

  function handlePinSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pin === ADMIN_PIN) {
      setAuthed(true);
      setPinError(false);
    } else {
      setPinError(true);
      setPin("");
    }
  }

  const broadcast = useCallback(
    async (type: "START" | "RESET" | "STOP") => {
      setStatus(null);
      try {
        const res = await fetch("/api/broadcast", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type,
            roomId,
            climbingSeconds,
            preparationSeconds,
            preparationEnabled,
            recurring,
          }),
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        setStatus(`${type} sent`);
        if (type === "START") {
          // Reset all per-round flags so the new round starts clean
          hasAutoRestartedRef.current = false;
          adminSound1minFiredRef.current = false;
          adminSoundStartFiredRef.current = false;
          adminSoundEndFiredRef.current = false;
          adminSound5secFiredRef.current = false;
          prevPhaseAdminRef.current = "idle";
          prevRemainingAdminRef.current = 0;
          setIsRunning(true);
          setTimerStopped(false);
          setTimerStartTime(Date.parse(data.startTime));
        }
        if (type === "STOP") {
          setIsRunning(false);
          setTimerStopped(true);
        }
        if (type === "RESET") {
          setIsRunning(false);
          setTimerStartTime(null);
          setTimerStopped(false);
        }
      } catch (err) {
        setStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
    [roomId, climbingSeconds, preparationSeconds, preparationEnabled, recurring]
  );

  // Keep broadcastRef current every render
  broadcastRef.current = broadcast;

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

  // rAF-driven clock
  useEffect(() => {
    if (timerStartTime === null) {
      setClockPhase("idle");
      setClockRemaining(0);
      return;
    }
    let rafId: number;
    const tick = () => {
      const { climbingSeconds, preparationSeconds, preparationEnabled } = clockConfigRef.current;
      const state = computeTimerState(
        timerStartTime,
        climbingSeconds * 1000,
        preparationSeconds * 1000,
        preparationEnabled,
        timerStopped,
        Date.now()
      );

      // --- Audio triggers ---
      if (!mutedRef.current) {
        if (
          prevPhaseAdminRef.current === "prep" &&
          state.phase === "climb" &&
          !adminSoundStartFiredRef.current
        ) {
          adminSoundStartFiredRef.current = true;
          playPrepToClimb();
        }
        if (
          state.phase === "climb" &&
          state.remainingMs <= 60_000 &&
          prevRemainingAdminRef.current > 60_000 &&
          !adminSound1minFiredRef.current
        ) {
          adminSound1minFiredRef.current = true;
          playOneMinWarning();
        }
        if (
          prevPhaseAdminRef.current === "climb" &&
          state.phase === "idle" &&
          !timerStopped &&
          !adminSoundEndFiredRef.current
        ) {
          adminSoundEndFiredRef.current = true;
          playTimerEnd();
        }
        if (
          state.phase === "climb" &&
          state.remainingMs <= 5_000 &&
          prevRemainingAdminRef.current > 5_000 &&
          !adminSound5secFiredRef.current
        ) {
          adminSound5secFiredRef.current = true;
          playFiveSecWarning();
        }
      }

      // --- Recurring auto-restart ---
      if (
        prevPhaseAdminRef.current === "climb" &&
        state.phase === "idle" &&
        !timerStopped &&
        recurringRef.current &&
        !hasAutoRestartedRef.current
      ) {
        hasAutoRestartedRef.current = true; // sync guard — prevents double-fire on next frame
        broadcastRef.current?.("START");
      }

      prevPhaseAdminRef.current = state.phase;
      prevRemainingAdminRef.current = state.remainingMs;

      setClockPhase(state.phase);
      setClockRemaining(state.remainingMs);
      if (state.phase !== "stopped" && state.remainingMs > 0) {
        rafId = requestAnimationFrame(tick);
      }
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [timerStartTime, timerStopped]);

  // Derived HMS values for display in HMS input mode
  const climbHms = secondsToHms(climbingSeconds);
  const prepHms = secondsToHms(preparationSeconds);

  // PIN screen
  if (!authed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#111111] text-[#f4f4f4]">
        <div className="mb-8 text-center">
          <p className="text-[#f97316] text-sm font-bold tracking-[0.3em] uppercase mb-1">Boulder House</p>
          <h1 className="text-4xl font-black text-[#f4f4f4] tracking-tight">CompSync</h1>
        </div>
        <div className="w-80 p-8 rounded-2xl bg-[#1c1c1c] border border-white/10 shadow-2xl">
          <h2 className="text-xl font-bold mb-6 text-center text-[#f4f4f4]">Admin Login</h2>
          <form onSubmit={handlePinSubmit} className="flex flex-col gap-4">
            <input
              type="password"
              placeholder="Enter PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-[#111111] border border-white/10 text-[#f4f4f4] text-center text-xl tracking-widest focus:outline-none focus:ring-2 focus:ring-[#f97316]"
              autoFocus
            />
            {pinError && <p className="text-red-400 text-sm text-center">Incorrect PIN</p>}
            <button
              type="submit"
              className="w-full py-3 rounded-lg bg-[#f97316] hover:bg-orange-400 font-bold text-white transition-colors"
            >
              Enter
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#111111] text-[#f4f4f4] p-6 md:p-8">
      <div className="max-w-lg mx-auto space-y-5">

        {/* Header */}
        <header className="flex items-center justify-between mb-2">
          <div>
            <p className="text-[#f97316] text-xs font-bold tracking-[0.3em] uppercase">Boulder House</p>
            <h1 className="text-2xl font-black text-[#f4f4f4] tracking-tight">CompSync</h1>
          </div>
          <button
            onClick={() => setMuted((m) => !m)}
            title={muted ? "Unmute" : "Mute"}
            className="p-2 rounded-lg bg-[#1c1c1c] border border-white/10 hover:border-[#f97316]/50 transition-colors text-[#9ca3af] hover:text-[#f4f4f4]"
            aria-label={muted ? "Unmute sounds" : "Mute sounds"}
          >
            {muted ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="1" y1="1" x2="23" y2="23" />
                <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              </svg>
            )}
          </button>
        </header>

        {/* Room */}
        <section className="bg-[#1c1c1c] rounded-xl p-5 space-y-3 border border-white/[0.08]">
          <h2 className="text-xs font-bold tracking-widest uppercase text-[#9ca3af]">Room</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value.toUpperCase())}
              className="flex-1 px-4 py-2 rounded-lg bg-[#111111] border border-white/10 text-[#f4f4f4] font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-[#f97316]"
            />
            <button
              onClick={() => setRoomId(generateRoomId())}
              className="px-4 py-2 rounded-lg bg-[#111111] border border-white/10 hover:border-[#f97316]/40 text-[#9ca3af] hover:text-[#f4f4f4] text-sm transition-colors"
            >
              New
            </button>
          </div>
          <div className="text-xs text-[#9ca3af] break-all">
            Display URL:{" "}
            <a href={displayUrl} target="_blank" className="text-[#f97316] underline hover:text-orange-300">
              {displayUrl}
            </a>
          </div>
        </section>

        {/* Configuration */}
        <section className="bg-[#1c1c1c] rounded-xl p-5 space-y-4 border border-white/[0.08]">
          <h2 className="text-xs font-bold tracking-widest uppercase text-[#9ca3af]">Configuration</h2>

          {/* Climbing duration */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#9ca3af] font-medium uppercase tracking-wide">Climbing Duration</span>
              <div className="flex rounded-lg overflow-hidden border border-white/10 text-xs">
                <button
                  onClick={() => setClimbInputMode("s")}
                  className={`px-2.5 py-1 transition-colors ${climbInputMode === "s" ? "bg-[#f97316] text-white" : "bg-[#111111] text-[#9ca3af] hover:text-[#f4f4f4]"}`}
                >
                  sec
                </button>
                <button
                  onClick={() => setClimbInputMode("hms")}
                  className={`px-2.5 py-1 transition-colors ${climbInputMode === "hms" ? "bg-[#f97316] text-white" : "bg-[#111111] text-[#9ca3af] hover:text-[#f4f4f4]"}`}
                >
                  h:m:s
                </button>
              </div>
            </div>
            {climbInputMode === "s" ? (
              <input
                type="number"
                min={10}
                max={3600}
                value={climbingSeconds}
                onChange={(e) => setClimbingSeconds(Number(e.target.value))}
                className="px-4 py-2.5 rounded-lg bg-[#111111] border border-white/10 text-[#f4f4f4] focus:outline-none focus:ring-2 focus:ring-[#f97316]"
              />
            ) : (
              <div className="flex gap-2">
                {([
                  { label: "h", val: climbHms.h, max: 1, onChange: (v: number) => setClimbingSeconds(hmsToSeconds(v, climbHms.m, climbHms.s)) },
                  { label: "m", val: climbHms.m, max: 59, onChange: (v: number) => setClimbingSeconds(hmsToSeconds(climbHms.h, v, climbHms.s)) },
                  { label: "s", val: climbHms.s, max: 59, onChange: (v: number) => setClimbingSeconds(hmsToSeconds(climbHms.h, climbHms.m, v)) },
                ] as const).map(({ label, val, max, onChange }) => (
                  <div key={label} className="flex flex-col items-center gap-0.5 flex-1">
                    <input
                      type="number"
                      min={0}
                      max={max}
                      value={val}
                      onChange={(e) => onChange(Number(e.target.value))}
                      className="w-full px-2 py-2.5 rounded-lg bg-[#111111] border border-white/10 text-[#f4f4f4] text-center focus:outline-none focus:ring-2 focus:ring-[#f97316]"
                    />
                    <span className="text-xs text-[#9ca3af]">{label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Prep toggle */}
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={preparationEnabled}
              onChange={(e) => setPreparationEnabled(e.target.checked)}
              className="w-5 h-5 accent-[#f97316] rounded"
            />
            <span className="text-sm text-[#f4f4f4]">Enable preparation phase</span>
          </label>

          {/* Prep duration */}
          {preparationEnabled && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#9ca3af] font-medium uppercase tracking-wide">Preparation Duration</span>
                <div className="flex rounded-lg overflow-hidden border border-white/10 text-xs">
                  <button
                    onClick={() => setPrepInputMode("s")}
                    className={`px-2.5 py-1 transition-colors ${prepInputMode === "s" ? "bg-[#f97316] text-white" : "bg-[#111111] text-[#9ca3af] hover:text-[#f4f4f4]"}`}
                  >
                    sec
                  </button>
                  <button
                    onClick={() => setPrepInputMode("hms")}
                    className={`px-2.5 py-1 transition-colors ${prepInputMode === "hms" ? "bg-[#f97316] text-white" : "bg-[#111111] text-[#9ca3af] hover:text-[#f4f4f4]"}`}
                  >
                    m:s
                  </button>
                </div>
              </div>
              {prepInputMode === "s" ? (
                <input
                  type="number"
                  min={5}
                  max={300}
                  value={preparationSeconds}
                  onChange={(e) => setPreparationSeconds(Number(e.target.value))}
                  className="px-4 py-2.5 rounded-lg bg-[#111111] border border-white/10 text-[#f4f4f4] focus:outline-none focus:ring-2 focus:ring-[#f97316]"
                />
              ) : (
                <div className="flex gap-2">
                  {([
                    { label: "m", val: prepHms.m + prepHms.h * 60, max: 5, onChange: (v: number) => setPreparationSeconds(hmsToSeconds(0, v, prepHms.s)) },
                    { label: "s", val: prepHms.s, max: 59, onChange: (v: number) => setPreparationSeconds(hmsToSeconds(0, prepHms.m + prepHms.h * 60, v)) },
                  ] as const).map(({ label, val, max, onChange }) => (
                    <div key={label} className="flex flex-col items-center gap-0.5 flex-1">
                      <input
                        type="number"
                        min={0}
                        max={max}
                        value={val}
                        onChange={(e) => onChange(Number(e.target.value))}
                        className="w-full px-2 py-2.5 rounded-lg bg-[#111111] border border-white/10 text-[#f4f4f4] text-center focus:outline-none focus:ring-2 focus:ring-[#f97316]"
                      />
                      <span className="text-xs text-[#9ca3af]">{label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Recurring toggle */}
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={recurring}
              onChange={(e) => setRecurring(e.target.checked)}
              className="w-5 h-5 accent-[#f97316] rounded"
            />
            <span className="text-sm text-[#f4f4f4]">
              Recurring <span className="text-[#9ca3af] text-xs">(auto-restart)</span>
            </span>
          </label>
        </section>

        {/* Controls */}
        <section className="bg-[#1c1c1c] rounded-xl p-5 space-y-3 border border-white/[0.08]">
          <h2 className="text-xs font-bold tracking-widest uppercase text-[#9ca3af]">Controls</h2>
          {confirmAction ? (
            <div className="flex flex-col gap-3">
              <p className="text-center text-sm text-[#9ca3af]">Confirm {confirmAction}?</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => { broadcast(confirmAction); setConfirmAction(null); }}
                  className="py-3 rounded-xl bg-[#dc2626] hover:bg-red-500 font-bold text-lg text-white transition-colors"
                >
                  Yes, {confirmAction}
                </button>
                <button
                  onClick={() => setConfirmAction(null)}
                  className="py-3 rounded-xl bg-[#4b5563] hover:bg-[#6b7280] font-bold text-lg text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => broadcast("START")}
                disabled={isRunning}
                className="py-4 rounded-xl bg-[#16a34a] hover:bg-green-500 disabled:opacity-30 disabled:cursor-not-allowed font-black text-lg text-white transition-colors"
              >
                START
              </button>
              <button
                onClick={() => {
                  if (clockPhase === "prep" || clockPhase === "climb") {
                    setConfirmAction("STOP");
                  } else {
                    broadcast("STOP");
                  }
                }}
                disabled={!isRunning}
                className="py-4 rounded-xl bg-[#dc2626] hover:bg-red-500 disabled:opacity-30 disabled:cursor-not-allowed font-black text-lg text-white transition-colors"
              >
                STOP
              </button>
              <button
                onClick={() => {
                  if (clockPhase === "prep" || clockPhase === "climb") {
                    setConfirmAction("RESET");
                  } else {
                    broadcast("RESET");
                  }
                }}
                className="py-4 rounded-xl bg-[#4b5563] hover:bg-[#6b7280] font-black text-lg text-white transition-colors"
              >
                RESET
              </button>
            </div>
          )}
          {status && (
            <p className="text-xs text-center text-[#9ca3af]">{status}</p>
          )}
        </section>

        {/* Running clock */}
        {(() => {
          const phaseStyles: Record<TimerPhase, { bg: string; text: string; label: string; border: string }> = {
            idle:    { bg: "bg-[#1c1c1c]",    text: "text-[#9ca3af]",   label: "",          border: "border-white/[0.08]" },
            prep:    { bg: "bg-yellow-900/60", text: "text-yellow-300",  label: "GET READY", border: "border-yellow-500/30" },
            climb:   { bg: "bg-green-900/60",  text: "text-green-300",   label: "CLIMB",     border: "border-green-500/30" },
            stopped: { bg: "bg-red-900/60",    text: "text-red-400",     label: "STOPPED",   border: "border-red-500/30" },
          };
          const { bg, text, label, border } = phaseStyles[clockPhase];
          return (
            <section className={`rounded-xl p-6 text-center transition-colors duration-500 border ${bg} ${border}`}>
              {label && (
                <p className={`text-xs font-black tracking-[0.4em] uppercase mb-2 ${text}`}>
                  {label}
                </p>
              )}
              <p className={`text-6xl font-mono font-black tabular-nums ${text}`}>
                {timerStartTime !== null ? fmtMs(clockRemaining) : "--:--"}
              </p>
            </section>
          );
        })()}

      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense>
      <AdminInner />
    </Suspense>
  );
}
