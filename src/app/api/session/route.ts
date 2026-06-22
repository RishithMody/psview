import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/store/session";

export const runtime = "nodejs";

/** Returns the configured agent + current state for the active session. */
export async function GET(req: NextRequest) {
  const sessionId = req.cookies.get("psview_session")?.value;
  const session = sessionId ? getSession(sessionId) : undefined;

  if (!session) {
    return NextResponse.json({ error: "No active session." }, { status: 404 });
  }

  return NextResponse.json({
    context: session.context,
    identity: session.identity,
    sequence: session.sequence,
    history: session.history,
    candidateModel: session.candidateModel,
  });
}
