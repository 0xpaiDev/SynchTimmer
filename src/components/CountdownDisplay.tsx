"use client";

import { useEffect, useRef, useState } from "react";
import { computeTimerState, TimerPhase } from "@/lib/timer";

interface CountdownDisplayProps {
  startTime: number | null;       // scheduled start timestamp (ms, local-adjusted)
  climbingSeconds: number;
  preparationSeconds: number;
  preparationEnabled: boolean;
  stopped: boolean;
}

function formatTime(ms: number): string {
  if (ms <= 0) return "0:00";
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

const phaseStyle: Record<TimerPhase, { bg: string; label: string; text: string }> = {
  idle:    { bg: "bg-gray-900",   label: "",         text: "text-gray-400" },
  prep:    { bg: "bg-yellow-900", label: "GET READY", text: "text-yellow-300" },
  climb:   { bg: "bg-green-900",  label: "CLIMB",    text: "text-green-300" },
  stopped: { bg: "bg-red-900",    label: "STOPPED",  text: "text-red-300" },
};

export default function CountdownDisplay({
  startTime,
  climbingSeconds,
  preparationSeconds,
  preparationEnabled,
  stopped,
}: CountdownDisplayProps) {
  const [timerMs, setTimerMs] = useState(0);
  const [phase, setPhase] = useState<TimerPhase>("idle");
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    function tick() {
      if (startTime === null) {
        setPhase("idle");
        setTimerMs(0);
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const state = computeTimerState(
        startTime,
        climbingSeconds * 1000,
        preparationSeconds * 1000,
        preparationEnabled,
        stopped,
        Date.now()
      );

      setPhase(state.phase);
      setTimerMs(state.remainingMs);

      // Keep running during pre-start window (idle but remainingMs > 0)
      if (state.phase !== "stopped" && state.remainingMs > 0) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [startTime, climbingSeconds, preparationSeconds, preparationEnabled, stopped]);

  const { bg, label, text } = phaseStyle[phase];

  return (
    <div className={`flex flex-col items-center justify-center w-full h-full min-h-screen ${bg} transition-colors duration-500`}>
      {label && (
        <div className={`text-4xl font-bold tracking-widest uppercase mb-6 ${text}`}>
          {label}
        </div>
      )}
      <div className={`text-[20vw] font-mono font-black leading-none ${text} tabular-nums`}>
        {startTime === null && phase === "idle" ? "--:--" : formatTime(timerMs)}
      </div>
    </div>
  );
}
