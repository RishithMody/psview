import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/store/session";
import { emptyCandidateModel } from "@/agent/types";

export const runtime = "nodejs";

/** Clears the conversation + candidate model but keeps the configured agent. */
export async function POST(req: NextRequest) {
  const sessionId = req.cookies.get("psview_session")?.value;
  const session = sessionId ? getSession(sessionId) : undefined;

  if (!session) {
    return NextResponse.json({ error: "No active session." }, { status: 400 });
  }

  session.history = [];
  session.candidateModel = emptyCandidateModel();

  return NextResponse.json({ ok: true });
}
