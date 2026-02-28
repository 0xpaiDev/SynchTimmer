import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { type, roomId, ...rest } = body;

  if (!type || !roomId) {
    return NextResponse.json({ error: "Missing type or roomId" }, { status: 400 });
  }

  const db = getAdminDb();
  const roomRef = db.ref(`rooms/${roomId}`);

  let startTime: string | undefined;
  if (type === "START") {
    startTime = new Date(Date.now() + 3000).toISOString();
    await roomRef.set({
      type: "START",
      startTime,
      climbingSeconds: rest.climbingSeconds,
      preparationSeconds: rest.preparationSeconds,
      preparationEnabled: rest.preparationEnabled,
      stopped: false,
      updatedAt: Date.now(),
    });
  } else if (type === "RESET") {
    await roomRef.remove();
  } else if (type === "STOP") {
    await roomRef.update({ type: "STOP", stopped: true, updatedAt: Date.now() });
  }

  return NextResponse.json({ ok: true, ...(startTime ? { startTime } : {}) });
}
