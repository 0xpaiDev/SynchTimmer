"use client";

export type ConnectionState = "connecting" | "connected" | "reconnecting" | "offline";

interface ConnectionStatusProps {
  state: ConnectionState;
}

const config: Record<ConnectionState, { label: string; color: string }> = {
  connecting:   { label: "Connecting...",  color: "bg-yellow-500" },
  connected:    { label: "Connected",      color: "bg-green-500" },
  reconnecting: { label: "Reconnecting...", color: "bg-orange-500" },
  offline:      { label: "Offline",        color: "bg-red-600" },
};

export default function ConnectionStatus({ state }: ConnectionStatusProps) {
  const { label, color } = config[state];

  return (
    <div className="fixed top-3 right-3 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/50 text-white text-sm font-medium z-50">
      <span className={`w-2 h-2 rounded-full ${color}`} />
      {label}
    </div>
  );
}
