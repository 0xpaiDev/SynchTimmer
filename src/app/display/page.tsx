"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getFirebaseDb } from "@/lib/firebase";
import { ref, onValue } from "firebase/database";
import { calibrateOffset, getServerNow } from "@/lib/sync";
import CountdownDisplay from "@/components/CountdownDisplay";
import ConnectionStatus, { ConnectionState } from "@/components/ConnectionStatus";

interface RoundState {
  startTime: number | null;
  climbingSeconds: number;
  preparationSeconds: number;
  preparationEnabled: boolean;
  stopped: boolean;
}

const DEFAULT_STATE: RoundState = {
  startTime: null,
  climbingSeconds: 300,
  preparationSeconds: 60,
  preparationEnabled: false,
  stopped: false,
};

function DisplayInner() {
  const params = useSearchParams();
  const roomId = params.get("room") ?? "default";

  const [connState, setConnState] = useState<ConnectionState>("connecting");
  const [round, setRound] = useState<RoundState>(DEFAULT_STATE);
  const offsetRef = useRef<number>(0);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    async function init() {
      // 1. Calibrate clock offset before subscribing
      try {
        offsetRef.current = await calibrateOffset();
      } catch {
        console.warn("Clock calibration failed, using offset=0");
      }

      // 2. Subscribe to Firebase RTDB — new displays joining mid-round
      //    automatically receive the current persisted state
      const db = getFirebaseDb();
      const roomRef = ref(db, `rooms/${roomId}`);
      setConnState("connecting");

      unsubscribe = onValue(
        roomRef,
        (snapshot) => {
          setConnState("connected");
          const data = snapshot.val();

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

          // If round already expired and not manually stopped, show idle
          if (serverNow >= serverStart + totalMs && !data.stopped) {
            setRound(DEFAULT_STATE);
            return;
          }

          setRound({
            startTime: localStart,
            climbingSeconds: data.climbingSeconds,
            preparationSeconds: data.preparationSeconds,
            preparationEnabled: data.preparationEnabled,
            stopped: data.stopped ?? false,
          });
        },
        (error) => {
          console.error("Firebase error:", error);
          setConnState("offline");
        }
      );
    }

    init();

    return () => {
      unsubscribe?.();
    };
  }, [roomId]);

  return (
    <div className="relative w-full h-screen">
      <ConnectionStatus state={connState} />
      <CountdownDisplay
        startTime={round.startTime}
        climbingSeconds={round.climbingSeconds}
        preparationSeconds={round.preparationSeconds}
        preparationEnabled={round.preparationEnabled}
        stopped={round.stopped}
      />
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
