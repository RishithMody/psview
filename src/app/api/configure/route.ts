import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { configureAgent } from "@/agent/configure";
import { saveSession } from "@/store/session";
import { CompanyContext, emptyCandidateModel } from "@/agent/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not set on the server." },
      { status: 500 }
    );
  }

  let ctx: CompanyContext;
  try {
    ctx = (await req.json()) as CompanyContext;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!ctx.name || !ctx.description) {
    return NextResponse.json(
      { error: "Company name and description are required." },
      { status: 400 }
    );
  }

  try {
    const { identity, sequence } = await configureAgent(ctx);

    const sessionId = randomUUID();
    saveSession(sessionId, {
      context: ctx,
      identity,
      sequence,
      history: [],
      candidateModel: emptyCandidateModel(),
    });

    const res = NextResponse.json({ identity, sequence });
    res.cookies.set("psview_session", sessionId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to configure agent: ${message}` },
      { status: 500 }
    );
  }
}
