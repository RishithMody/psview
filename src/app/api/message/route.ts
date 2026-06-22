import { NextRequest, NextResponse } from "next/server";
import { converse } from "@/agent/converse";
import {
  appendHistory,
  getSession,
  setCandidateModel,
} from "@/store/session";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const sessionId = req.cookies.get("psview_session")?.value;
  const session = sessionId ? getSession(sessionId) : undefined;

  if (!sessionId || !session) {
    return NextResponse.json(
      { error: "No active session. Configure an agent first." },
      { status: 400 }
    );
  }

  let candidateReply: string;
  try {
    ({ candidateReply } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!candidateReply || !candidateReply.trim()) {
    return NextResponse.json(
      { error: "candidateReply is required." },
      { status: 400 }
    );
  }

  try {
    const turn = await converse(
      session.context,
      session.identity,
      session.history,
      session.candidateModel,
      candidateReply
    );

    // Persist the exchange + the evolved candidate model.
    appendHistory(
      sessionId,
      { role: "candidate", text: candidateReply },
      { role: "agent", text: turn.message }
    );
    setCandidateModel(sessionId, turn.candidateModel);

    return NextResponse.json(turn);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Agent failed to respond: ${message}` },
      { status: 500 }
    );
  }
}
