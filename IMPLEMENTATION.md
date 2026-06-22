# PSView Agent — Implementation Plan

> Refined build plan, file structure, and the core code blocks that prove the
> agent reasons instead of just generating text.

---

## Table of Contents

1. [The Approach (refined)](#1-the-approach-refined)
2. [Data Model](#2-data-model)
3. [File Structure](#3-file-structure)
4. [Core Code Blocks](#4-core-code-blocks)
   - [4.1 Types](#41-types)
   - [4.2 LLM client](#42-llm-client)
   - [4.3 Configure agent — identity synthesis](#43-configure-agent--identity-synthesis)
   - [4.4 Conversation agent — reason then respond](#44-conversation-agent--reason-then-respond)
   - [4.5 Session store](#45-session-store)
   - [4.6 API routes](#46-api-routes)
   - [4.7 UI: setup + preview](#47-ui-setup--preview)
5. [Build Order](#5-build-order)

---

## 1. The Approach (refined)

The agent is built as a **three-stage reasoning pipeline**. Each stage produces a
typed, inspectable artifact — that visibility is the whole point of the demo.

```
COMPANY CONTEXT
      │
      ▼
┌─────────────────────┐
│ STAGE 1: SYNTHESIZE │  → AgentIdentity (persona, tone, strategy, red_flags)
│ identity from        │     This is the "brain state". Generated once.
│ context              │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ STAGE 2: PLAN        │  → OutreachSequence (3 touches, each with intent + timing)
│ engagement sequence  │     Derived FROM identity, not from raw context.
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ STAGE 3: CONVERSE    │  Per candidate reply:
│ reason → act         │   a. classify state  (cold/engaged/objection/...)
│                      │   b. choose action   (advance/handle/pivot/close/stop)
│                      │   c. generate message within that decision
│                      │   → returns { reasoning, state, action, message }
└─────────────────────┘
```

**Why this is the best approach for the brief:**

| Brief requirement              | How the pipeline satisfies it                                   |
|--------------------------------|-----------------------------------------------------------------|
| Autonomous (no step driving)   | One intent in → full sequence + self-run replies out            |
| Consistent personality         | `AgentIdentity` is generated once and injected into every call  |
| Changes when reconfigured      | New context → new identity → measurably different behavior      |
| Knows the company              | Messages constrained by identity derived from real context      |
| **Reasons** (not just text)    | Stage 3 returns its `state` + `action` + `reasoning` to the UI  |
| Deployed + usable              | Stateless-friendly Next.js on Vercel                            |

**The single most important design decision:** the conversation agent emits a
**structured decision object** (`state`, `action`, `reasoning`) *alongside* the
message. The decision is made before — and separately from — the text. That
separation is the intelligence, and the UI renders it so reviewers can see it.

---

## 2. Data Model

```ts
// The form input
CompanyContext {
  name: string
  description: string      // who they are
  culture: string          // values, working style
  hiringProfiles: string   // roles + ideal candidates
  tone: string             // desired voice
}

// Stage 1 output — the agent's identity
AgentIdentity {
  persona: string               // 1-2 sentence self-description
  toneAdjectives: string[]      // e.g. ["warm", "direct", "nerdy"]
  prohibitedPhrases: string[]   // anti-generic guardrails
  engagementStrategy: string    // how it approaches candidates
  redFlags: string[]            // signals to disengage
}

// Stage 2 output
OutreachSequence {
  touches: { order: number; intent: string; channel: string; message: string }[]
}

// Stage 3 output per reply
AgentTurn {
  state: "cold_open" | "engaged" | "objection" | "negotiating" | "disengaged"
  action: "advance" | "handle" | "pivot" | "close" | "stop"
  reasoning: string             // shown in UI
  message: string
}
```

---

## 3. File Structure

```
psview/
├── .env.example
├── .env.local                  # OPENAI_API_KEY (gitignored)
├── next.config.js
├── package.json
├── tsconfig.json
├── README.md
│
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                    # redirect → /setup
│   │   ├── globals.css
│   │   │
│   │   ├── setup/
│   │   │   └── page.tsx                 # company context form
│   │   │
│   │   ├── preview/
│   │   │   └── page.tsx                 # simulation playground
│   │   │
│   │   └── api/
│   │       ├── configure/route.ts       # POST: context → identity + sequence
│   │       └── message/route.ts         # POST: candidate reply → AgentTurn
│   │
│   ├── agent/
│   │   ├── types.ts                     # all shared types
│   │   ├── llm.ts                       # OpenAI client + JSON helper
│   │   ├── configure.ts                 # Stage 1 + Stage 2
│   │   ├── converse.ts                  # Stage 3 (reason → act)
│   │   └── prompts.ts                   # system prompts, kept separate
│   │
│   ├── store/
│   │   └── session.ts                   # in-memory session map
│   │
│   └── components/
│       ├── SequenceCard.tsx             # renders a planned touch
│       ├── ChatBubble.tsx               # message bubble
│       └── ReasoningTrace.tsx           # shows state/action/reasoning
│
└── public/
```

---

## 4. Core Code Blocks

### 4.1 Types

```ts
// src/agent/types.ts
export interface CompanyContext {
  name: string;
  description: string;
  culture: string;
  hiringProfiles: string;
  tone: string;
}

export interface AgentIdentity {
  persona: string;
  toneAdjectives: string[];
  prohibitedPhrases: string[];
  engagementStrategy: string;
  redFlags: string[];
}

export interface Touch {
  order: number;
  intent: string;
  channel: string;
  message: string;
}

export interface OutreachSequence {
  touches: Touch[];
}

export type ConvState =
  | "cold_open"
  | "engaged"
  | "objection"
  | "negotiating"
  | "disengaged";

export type Action = "advance" | "handle" | "pivot" | "close" | "stop";

export interface AgentTurn {
  state: ConvState;
  action: Action;
  reasoning: string;
  message: string;
}

export interface ChatMessage {
  role: "agent" | "candidate";
  text: string;
}

export interface Session {
  context: CompanyContext;
  identity: AgentIdentity;
  sequence: OutreachSequence;
  history: ChatMessage[];
}
```

### 4.2 LLM client

```ts
// src/agent/llm.ts
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Calls the model and forces a JSON object response.
 * Centralises model choice + JSON parsing so every stage is consistent.
 */
export async function jsonCall<T>(
  system: string,
  user: string,
  temperature = 0.7
): Promise<T> {
  const res = await client.chat.completions.create({
    model: "gpt-4o",
    temperature,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  const raw = res.choices[0].message.content ?? "{}";
  return JSON.parse(raw) as T;
}
```

### 4.3 Configure agent — identity synthesis

```ts
// src/agent/configure.ts
import { jsonCall } from "./llm";
import { IDENTITY_PROMPT, SEQUENCE_PROMPT } from "./prompts";
import { AgentIdentity, CompanyContext, OutreachSequence } from "./types";

/** STAGE 1: derive the agent's personality from company context. */
export async function synthesizeIdentity(
  ctx: CompanyContext
): Promise<AgentIdentity> {
  const user = `Company context:
Name: ${ctx.name}
What they do: ${ctx.description}
Culture: ${ctx.culture}
Who they hire: ${ctx.hiringProfiles}
Desired tone: ${ctx.tone}

Synthesize a recruiting agent identity that authentically represents THIS
company. The identity must be specific enough that a generic message would
violate it.`;

  return jsonCall<AgentIdentity>(IDENTITY_PROMPT, user, 0.6);
}

/** STAGE 2: plan a 3-touch outreach sequence FROM the identity. */
export async function planSequence(
  ctx: CompanyContext,
  identity: AgentIdentity
): Promise<OutreachSequence> {
  const user = `You are this agent:
${JSON.stringify(identity, null, 2)}

Recruiting for: ${ctx.hiringProfiles} at ${ctx.name}.

Plan a 3-touch cold outreach sequence. Each touch needs a distinct INTENT
(e.g. hook, value, soft-close). Messages must reflect the identity's tone and
avoid every prohibited phrase.`;

  return jsonCall<OutreachSequence>(SEQUENCE_PROMPT, user, 0.7);
}
```

### 4.4 Conversation agent — reason then respond

```ts
// src/agent/converse.ts
import { jsonCall } from "./llm";
import { CONVERSE_PROMPT } from "./prompts";
import { AgentIdentity, AgentTurn, ChatMessage, CompanyContext } from "./types";

/**
 * STAGE 3: the core reasoning loop.
 * The model is instructed to FIRST classify state and choose an action,
 * THEN write the message consistent with that decision. All four fields
 * are returned so the UI can show the reasoning.
 */
export async function converse(
  ctx: CompanyContext,
  identity: AgentIdentity,
  history: ChatMessage[],
  candidateReply: string
): Promise<AgentTurn> {
  const transcript = history
    .map((m) => `${m.role.toUpperCase()}: ${m.text}`)
    .join("\n");

  const user = `Your identity:
${JSON.stringify(identity, null, 2)}

Company: ${ctx.name} — ${ctx.description}

Conversation so far:
${transcript || "(none yet)"}

New candidate reply:
"${candidateReply}"

Decide and respond. Return JSON with:
- "state": one of cold_open|engaged|objection|negotiating|disengaged
- "action": one of advance|handle|pivot|close|stop
- "reasoning": one sentence on WHY this state and action
- "message": the reply, in your persona. If action is "stop", be gracious.
Disengage (action "stop") if the candidate hits any of your red_flags.`;

  return jsonCall<AgentTurn>(CONVERSE_PROMPT, user, 0.7);
}
```

### Prompts (kept separate so behavior is auditable)

```ts
// src/agent/prompts.ts
export const IDENTITY_PROMPT = `You design the PERSONALITY of an autonomous
recruiting agent. You do not write outreach. You output a JSON identity:
{
  "persona": string,
  "toneAdjectives": string[],
  "prohibitedPhrases": string[],   // generic recruiter clichés to never use
  "engagementStrategy": string,
  "redFlags": string[]             // candidate signals that warrant disengaging
}
Make it unmistakably tied to the specific company. Avoid corporate filler.`;

export const SEQUENCE_PROMPT = `You are an autonomous recruiting agent with a
fixed identity. Output JSON: { "touches": [{ "order", "intent", "channel",
"message" }] }. Stay in character. Never use prohibited phrases.`;

export const CONVERSE_PROMPT = `You are an autonomous recruiting agent with a
fixed identity, running a live candidate conversation. You think before you
speak: first classify the conversation state, then choose an action, then write
a reply that executes that decision. Stay perfectly in character across every
turn. Output strict JSON: { "state", "action", "reasoning", "message" }.`;
```

### 4.5 Session store

```ts
// src/store/session.ts
import { Session } from "@/agent/types";

// Demo-grade in-memory store. One process on Vercel keeps this for the
// session lifetime — no DB required for the assessment.
const store = new Map<string, Session>();

export function saveSession(id: string, s: Session) {
  store.set(id, s);
}

export function getSession(id: string): Session | undefined {
  return store.get(id);
}

export function updateHistory(id: string, ...msgs: Session["history"]) {
  const s = store.get(id);
  if (s) s.history.push(...msgs);
}
```

### 4.6 API routes

```ts
// src/app/api/configure/route.ts
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { synthesizeIdentity, planSequence } from "@/agent/configure";
import { saveSession } from "@/store/session";
import { CompanyContext } from "@/agent/types";

export async function POST(req: NextRequest) {
  const ctx = (await req.json()) as CompanyContext;

  const identity = await synthesizeIdentity(ctx);
  const sequence = await planSequence(ctx, identity);

  const sessionId = randomUUID();
  saveSession(sessionId, { context: ctx, identity, sequence, history: [] });

  const res = NextResponse.json({ identity, sequence });
  res.cookies.set("psview_session", sessionId, { httpOnly: true, path: "/" });
  return res;
}
```

```ts
// src/app/api/message/route.ts
import { NextRequest, NextResponse } from "next/server";
import { converse } from "@/agent/converse";
import { getSession, updateHistory } from "@/store/session";

export async function POST(req: NextRequest) {
  const sessionId = req.cookies.get("psview_session")?.value;
  const session = sessionId ? getSession(sessionId) : undefined;
  if (!session) {
    return NextResponse.json({ error: "No active session" }, { status: 400 });
  }

  const { candidateReply } = await req.json();

  const turn = await converse(
    session.context,
    session.identity,
    session.history,
    candidateReply
  );

  updateHistory(
    sessionId!,
    { role: "candidate", text: candidateReply },
    { role: "agent", text: turn.message }
  );

  return NextResponse.json(turn); // { state, action, reasoning, message }
}
```

### 4.7 UI: setup + preview

```tsx
// src/app/setup/page.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const FIELDS = [
  ["name", "Company name"],
  ["description", "What does the company do?"],
  ["culture", "Culture & values"],
  ["hiringProfiles", "Roles & ideal candidates"],
  ["tone", "Desired tone of voice"],
] as const;

export default function Setup() {
  const router = useRouter();
  const [form, setForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    await fetch("/api/configure", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    router.push("/preview");
  }

  return (
    <main className="container">
      <h1>Configure your agent</h1>
      {FIELDS.map(([key, label]) => (
        <label key={key}>
          {label}
          <textarea onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
        </label>
      ))}
      <button onClick={submit} disabled={loading}>
        {loading ? "Configuring agent…" : "Build agent →"}
      </button>
    </main>
  );
}
```

```tsx
// src/app/preview/page.tsx  (core of the simulation playground)
"use client";
import { useEffect, useState } from "react";
import type { AgentTurn, OutreachSequence } from "@/agent/types";

export default function Preview() {
  const [sequence, setSequence] = useState<OutreachSequence | null>(null);
  const [identity, setIdentity] = useState<any>(null);
  const [chat, setChat] = useState<{ role: string; text: string }[]>([]);
  const [traces, setTraces] = useState<AgentTurn[]>([]);
  const [reply, setReply] = useState("");

  // The /api/configure response was cached client-side on submit; for brevity
  // assume it's fetched here or passed via a store. Render sequence + identity.

  async function send() {
    const candidate = reply;
    setChat((c) => [...c, { role: "candidate", text: candidate }]);
    setReply("");

    const turn: AgentTurn = await fetch("/api/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidateReply: candidate }),
    }).then((r) => r.json());

    setChat((c) => [...c, { role: "agent", text: turn.message }]);
    setTraces((t) => [...t, turn]);
  }

  return (
    <main className="grid">
      {/* LEFT: generated sequence + identity */}
      <section>
        <h2>Agent identity</h2>
        <pre>{JSON.stringify(identity, null, 2)}</pre>
        <h2>Planned sequence</h2>
        {sequence?.touches.map((t) => (
          <div key={t.order} className="card">
            <strong>#{t.order} · {t.intent}</strong>
            <p>{t.message}</p>
          </div>
        ))}
      </section>

      {/* RIGHT: live simulation with reasoning trace */}
      <section>
        <h2>Simulate a candidate</h2>
        <div className="chat">
          {chat.map((m, i) => (
            <div key={i} className={`bubble ${m.role}`}>{m.text}</div>
          ))}
        </div>

        {/* THE INTELLIGENCE, made visible */}
        {traces.length > 0 && (
          <div className="trace">
            <em>Last decision</em>
            <p>state: <b>{traces.at(-1)!.state}</b></p>
            <p>action: <b>{traces.at(-1)!.action}</b></p>
            <p>why: {traces.at(-1)!.reasoning}</p>
          </div>
        )}

        <input value={reply} onChange={(e) => setReply(e.target.value)}
               placeholder="Type a candidate reply…" />
        <button onClick={send}>Send reply</button>
      </section>
    </main>
  );
}
```

---

## 5. Build Order

| Step | Deliverable                                      | Verify                                    |
|------|--------------------------------------------------|-------------------------------------------|
| 1    | `npx create-next-app` + types + llm client       | `npm run dev` boots                       |
| 2    | `configure.ts` + `/api/configure`                | curl returns identity + sequence JSON     |
| 3    | `converse.ts` + `/api/message`                   | curl a reply → returns AgentTurn          |
| 4    | Setup form                                        | submit persists session                   |
| 5    | Preview playground + reasoning trace panel        | full loop works in browser                |
| 6    | Styling pass + README                             | looks clean, reads clearly                |
| 7    | Deploy to Vercel + set `OPENAI_API_KEY`           | live URL works end-to-end                 |

### Demo proof to capture for reviewers

1. Configure with **Company A** (e.g. a playful startup) → note tone.
2. Reconfigure with **Company B** (e.g. a formal enterprise) → tone visibly shifts.
3. In the simulator, send a **hostile / disinterested reply** → agent classifies
   `objection` or `disengaged` and either handles it or gracefully stops.
4. Point at the reasoning trace: *"the decision was made before the words."*
