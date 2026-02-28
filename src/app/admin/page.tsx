"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Suspense } from "react";
import { computeTimerState, TimerPhase } from "@/lib/timer";

function fmtMs(ms: number): string {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const ADMIN_PIN = process.env.NEXT_PUBLIC_ADMIN_PIN ?? "1234";

function generateRoomId(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function AdminInner() {
  const [pin, setPin] = useState("");
  const [authed, setAuthed] = useState(false);
  const [pinError, setPinError] = useState(false);

  const [roomId, setRoomId] = useState(() => generateRoomId());
  const [climbingSeconds, setClimbingSeconds] = useState(300);
  const [preparationSeconds, setPreparationSeconds] = useState(60);
  const [preparationEnabled, setPreparationEnabled] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  // Running clock state
  const [timerStartTime, setTimerStartTime] = useState<number | null>(null);
  const [timerStopped, setTimerStopped] = useState(false);
  const [clockPhase, setClockPhase] = useState<TimerPhase>("idle");
  const [clockRemaining, setClockRemaining] = useState(0);
  const clockConfigRef = useRef({ climbingSeconds, preparationSeconds, preparationEnabled });

  // Confirmation state for destructive actions
  const [confirmAction, setConfirmAction] = useState<"STOP" | "RESET" | null>(null);

  // Keep config ref current so the rAF closure always reads the latest values
  clockConfigRef.current = { climbingSeconds, preparationSeconds, preparationEnabled };

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
      setClockPhase(state.phase);
      setClockRemaining(state.remainingMs);
      if (state.phase !== "stopped" && state.remainingMs > 0) {
        rafId = requestAnimationFrame(tick);
      }
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [timerStartTime, timerStopped]);

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
          }),
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        setStatus(`${type} sent`);
        if (type === "START") {
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
    [roomId, climbingSeconds, preparationSeconds, preparationEnabled]
  );

  if (!authed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-950 text-white">
        <div className="w-80 p-8 rounded-2xl bg-gray-800 shadow-xl">
          <h1 className="text-2xl font-bold mb-6 text-center">Admin Login</h1>
          <form onSubmit={handlePinSubmit} className="flex flex-col gap-4">
            <input
              type="password"
              placeholder="Enter PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-gray-700 text-white text-center text-xl tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            {pinError && <p className="text-red-400 text-sm text-center">Incorrect PIN</p>}
            <button
              type="submit"
              className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-500 font-semibold text-white transition-colors"
            >
              Enter
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-lg mx-auto space-y-6">
        <h1 className="text-3xl font-bold">CompSync Admin</h1>

        {/* Room ID */}
        <section className="bg-gray-800 rounded-xl p-6 space-y-3">
          <h2 className="text-lg font-semibold text-gray-300">Room</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value.toUpperCase())}
              className="flex-1 px-4 py-2 rounded-lg bg-gray-700 text-white font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => setRoomId(generateRoomId())}
              className="px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-500 text-sm transition-colors"
            >
              New
            </button>
          </div>
          <div className="text-sm text-gray-400 break-all">
            Display URL:{" "}
            <a href={displayUrl} target="_blank" className="text-blue-400 underline">
              {displayUrl}
            </a>
          </div>
        </section>

        {/* Timer Config */}
        <section className="bg-gray-800 rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-300">Configuration</h2>

          <label className="flex flex-col gap-1">
            <span className="text-sm text-gray-400">Climbing duration (seconds)</span>
            <input
              type="number"
              min={10}
              max={3600}
              value={climbingSeconds}
              onChange={(e) => setClimbingSeconds(Number(e.target.value))}
              className="px-4 py-2 rounded-lg bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={preparationEnabled}
              onChange={(e) => setPreparationEnabled(e.target.checked)}
              className="w-5 h-5 accent-yellow-400"
            />
            <span className="text-sm text-gray-300">Enable preparation phase</span>
          </label>

          {preparationEnabled && (
            <label className="flex flex-col gap-1">
              <span className="text-sm text-gray-400">Preparation duration (seconds)</span>
              <input
                type="number"
                min={5}
                max={300}
                value={preparationSeconds}
                onChange={(e) => setPreparationSeconds(Number(e.target.value))}
                className="px-4 py-2 rounded-lg bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
          )}
        </section>

        {/* Controls */}
        <section className="bg-gray-800 rounded-xl p-6 space-y-3">
          <h2 className="text-lg font-semibold text-gray-300">Controls</h2>
          {confirmAction ? (
            <div className="flex flex-col gap-3">
              <p className="text-center text-sm text-gray-300">
                Confirm {confirmAction}?
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => { broadcast(confirmAction); setConfirmAction(null); }}
                  className="py-3 rounded-xl bg-red-600 hover:bg-red-500 font-bold text-lg transition-colors"
                >
                  Yes, {confirmAction}
                </button>
                <button
                  onClick={() => setConfirmAction(null)}
                  className="py-3 rounded-xl bg-gray-600 hover:bg-gray-500 font-bold text-lg transition-colors"
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
                className="py-4 rounded-xl bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed font-bold text-lg transition-colors"
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
                className="py-4 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed font-bold text-lg transition-colors"
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
                className="py-4 rounded-xl bg-gray-600 hover:bg-gray-500 font-bold text-lg transition-colors"
              >
                RESET
              </button>
            </div>
          )}
          {status && (
            <p className="text-sm text-center text-gray-400">{status}</p>
          )}
        </section>

        {/* Running clock */}
        {(() => {
          const phaseStyles: Record<TimerPhase, { bg: string; text: string; label: string }> = {
            idle:    { bg: "bg-gray-800",   text: "text-gray-400",   label: "" },
            prep:    { bg: "bg-yellow-900", text: "text-yellow-300", label: "GET READY" },
            climb:   { bg: "bg-green-900",  text: "text-green-300",  label: "CLIMB" },
            stopped: { bg: "bg-red-900",    text: "text-red-400",    label: "STOPPED" },
          };
          const { bg, text, label } = phaseStyles[clockPhase];
          return (
            <section className={`rounded-xl p-6 text-center transition-colors duration-500 ${bg}`}>
              {label && (
                <p className={`text-sm font-bold tracking-widest uppercase mb-1 ${text}`}>
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
