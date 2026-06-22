import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { configureAgent } from "@/agent/configure";
import { saveSession } from "@/store/session";
import { CompanyContext, emptyCandidateModel } from "@/agent/types";

export const runtime = "nodejs";

// Per-field cap keeps prompt size, cost, and abuse surface bounded.
const MAX_FIELD_LEN = 4000;

/**
 * Validates and sanitizes untrusted request input into a CompanyContext.
 * Returns null if required fields are missing or any field is the wrong type.
 */
function parseCompanyContext(body: unknown): CompanyContext | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;

  const fields = [
    "name",
    "description",
    "culture",
    "hiringProfiles",
    "tone",
  ] as const;

  const out: Record<string, string> = {};
  for (const f of fields) {
    const v = b[f] ?? "";
    if (typeof v !== "string") return null;
    out[f] = v.trim().slice(0, MAX_FIELD_LEN);
  }

  if (!out.name || !out.description) return null;
  return out as unknown as CompanyContext;
}

export async function POST(req: NextRequest) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not set on the server." },
      { status: 500 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const ctx = parseCompanyContext(body);
  if (!ctx) {
    return NextResponse.json(
      {
        error:
          "Company name and description are required, and all fields must be strings.",
      },
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
