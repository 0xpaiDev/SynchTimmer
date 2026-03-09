import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { type, roomId, ...rest } = body;

  if (!type || !roomId) {
    return NextResponse.json({ error: "Missing type or roomId" }, { status: 400 });
  }

  const VALID_TYPES = ["START", "STOP", "PAUSE", "RESUME", "RESET"];
  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: "Unknown type" }, { status: 400 });
  }

  const db = getAdminDb();
  const roomRef = db.ref(`rooms/${roomId}`);

  let startTime: string | undefined;
  if (type === "START") {
    const cs = Number(rest.climbingSeconds);
    if (!Number.isFinite(cs) || cs < 1 || cs > 7200) {
      return NextResponse.json({ error: "Invalid climbingSeconds" }, { status: 400 });
    }
    const now = Date.now();
    startTime = new Date(now + 500).toISOString();
    await roomRef.set({
      type: "START",
      startTime,
      climbingSeconds: rest.climbingSeconds,
      preparationSeconds: rest.preparationSeconds,
      preparationEnabled: rest.preparationEnabled,
      recurring: rest.recurring ?? false,
      stopped: false,
      paused: false,
      pausedElapsedMs: 0,
      updatedAt: now,
      expiresAt: now + 500 + 24 * 60 * 60 * 1000,
    });
  } else if (type === "PAUSE") {
    const snap = await roomRef.get();
    const existing = snap.val();
    if (!existing || !existing.startTime) {
      return NextResponse.json({ error: "No active session" }, { status: 400 });
    }
    const now = Date.now();
    const pausedElapsedMs = now - Date.parse(existing.startTime);
    await roomRef.update({ type: "PAUSE", paused: true, pausedElapsedMs, updatedAt: now });
    return NextResponse.json({ ok: true });
  } else if (type === "RESUME") {
    const snap = await roomRef.get();
    const existing = snap.val();
    if (!existing || !existing.paused || existing.pausedElapsedMs === undefined) {
      return NextResponse.json({ error: "No paused session" }, { status: 400 });
    }
    const now = Date.now();
    startTime = new Date(now - existing.pausedElapsedMs).toISOString();
    await roomRef.update({ type: "RESUME", paused: false, startTime, updatedAt: now });
  } else if (type === "RESET") {
    await roomRef.remove();
  } else if (type === "STOP") {
    await roomRef.update({ type: "STOP", stopped: true, updatedAt: Date.now() });
  }

  return NextResponse.json({ ok: true, ...(startTime ? { startTime } : {}) });
}
