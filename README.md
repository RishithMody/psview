# PSView — Autonomous Recruiting Agent

[![CI](https://github.com/RishithMody/psview/actions/workflows/ci.yml/badge.svg)](https://github.com/RishithMody/psview/actions/workflows/ci.yml)

**Live demo:** https://psview-production.up.railway.app
**Repo:** https://github.com/RishithMody/psview

An AI agent that configures itself from a company's context, gives itself a
personality, plans a candidate outreach sequence, and runs a live conversation —
all in a preview area where **nothing sends for real**. You simulate candidate
replies by hand and watch the agent reason and act.

> **What makes the agent intelligent and not just an LLM call:** it maintains an
> evolving structured model of the candidate, classifies the conversation state
> and decides *whether to act or speak* **before** generating any text, invokes
> tools on its own, and self-critiques each message against its own persona — the
> LLM *executes* its decisions, it doesn't make them.

---

## What I built

Two screens:

1. **Setup** (`/setup`) — a form for company name, what it does, culture, hiring
   profiles, and tone. Two presets are included (a playful seed startup and a
   formal enterprise) so you can see the personality change instantly.
2. **Preview** (`/preview`) — the agent's synthesized identity, its planned
   3-touch outreach sequence, and a live conversation simulator. As you reply,
   you see:
   - the agent's **reasoning trace** (state → action → why) for every turn
   - its **candidate model** (memory) updating in real time
   - any **autonomous actions** it chose to take (tool calls)

---

## How it works — the reasoning pipeline

The agent is a **three-stage pipeline**, and each stage produces a typed,
inspectable artifact. That visibility is the whole point.

```
COMPANY CONTEXT
      │
      ▼
STAGE 1 · SYNTHESIZE IDENTITY   →  AgentIdentity { persona, tone, strategy,
  derives the agent's OWN            prohibitedPhrases, redFlags }
  personality from context           (generated once; constrains everything)
      │
      ▼
STAGE 2 · PLAN SEQUENCE         →  OutreachSequence { 3 touches }
  derived FROM the identity,         (inherits the voice, not generic copy)
  not the raw context
      │
      ▼
STAGE 3 · CONVERSE (per reply)
  a. classify conversation state  (cold_open → engaged → objection →
                                   negotiating → disengaged)
  b. update the candidate model   (interests, objections, sentiment, facts)
  c. choose an action             (advance | handle | pivot | close | stop)
  d. decide whether to call a tool (autonomously)
  e. write the message            (executes the decision, in persona)
  f. self-critique the draft      (regenerate if it drifts from persona)
      │
      ▼
AgentTurn { state, action, reasoning, message, toolCalls, candidateModel }
```

### Where the intelligence lives

- **Decision before generation.** Stage 3 emits a structured decision
  (`state`, `action`, `reasoning`) *separately from and before* the message.
  The model writes text to fulfill a decision it already reasoned out.
- **Memory as a structured belief, not a transcript.** The agent maintains a
  `CandidateModel` (inferred interests, objections, sentiment, key facts,
  engagement level) and **updates it every turn**, then reasons from it next
  time. You watch its mental model evolve in the UI.
- **Autonomous tool use.** The agent decides on its own when to
  `scheduleFollowUp` (candidate went quiet) or `escalateToHuman` (comp
  negotiation, visa/legal, a complaint). Acting, not just talking.
- **Self-critique loop.** Before finalizing, a reviewer pass checks the draft
  against the agent's own `prohibitedPhrases` and tone, and regenerates if it
  drifted. This makes personality consistency a real mechanism, not a hope.
- **Personality is a constraint, not a prompt.** The identity is synthesized
  once and injected into every downstream call, so the same model behaves
  consistently across a conversation and **measurably differently** when
  reconfigured for another company.

---

## Architecture & choices

| Layer    | Choice                         | Why                                          |
|----------|--------------------------------|----------------------------------------------|
| Framework| Next.js 14 (App Router)        | API routes + React UI in one deployable repo |
| LLM      | Google `gemini-2.5-flash`      | Strong reasoning + native JSON output mode   |
| State    | In-memory session store        | No DB needed for a demo; behind a tiny interface so Redis is a one-file swap |
| Hosting  | Vercel                         | Live URL in minutes                          |

**Why no vector DB / RAG?** The company context is a few paragraphs that fit
comfortably in the prompt. A vector store over that would be theater. The
intelligence the brief asks for is in *reasoning and acting*, so the effort went
into the decision pipeline, structured memory, tools, and self-critique instead.

### Project structure

```
src/
├── agent/
│   ├── types.ts        # all shared types (identity, candidate model, tools, turn)
│   ├── llm.ts          # Gemini client (lazy) + JSON/text helpers
│   ├── prompts.ts      # all system prompts, in one auditable place
│   ├── configure.ts    # Stage 1 (identity) + Stage 2 (sequence)
│   ├── converse.ts     # Stage 3 (reason → act → self-critique)
│   └── tools.ts        # simulated scheduleFollowUp + escalateToHuman
├── store/
│   └── session.ts      # in-memory session store (cookie-keyed)
├── app/
│   ├── setup/page.tsx          # company context form + presets
│   ├── preview/page.tsx        # simulation playground
│   └── api/
│       ├── configure/route.ts  # context → identity + sequence
│       ├── message/route.ts    # candidate reply → AgentTurn
│       ├── reset/route.ts      # clear conversation, keep configured agent
│       └── session/route.ts    # load configured agent for preview
└── components/
    ├── ReasoningTrace.tsx       # state/action/why for each turn
    └── CandidateModelPanel.tsx  # the evolving memory, visualized
```

---

## Running locally

```bash
npm install
cp .env.example .env.local      # add your GEMINI_API_KEY
npm run dev                     # http://localhost:3000
```

`.env.local`:

```
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash  # optional override
```

---

## Testing & CI

The agent's reasoning is covered by unit + integration tests (Vitest). The LLM
layer is mocked, so tests assert the **orchestration logic** deterministically —
no API key or network needed.

```bash
npm test            # run all tests
npm run test:watch  # watch mode
npm run typecheck   # tsc --noEmit
npm run lint        # next lint
```

What's covered (31 tests):
- **`converse`** — the decision (`state`/`action`/`reasoning`) is produced
  before the message; prior candidate model is threaded in and the updated one
  returned; tools execute and attach results; the self-critique pass revises a
  drifting draft, leaves a clean one untouched, and falls back safely if it
  throws; the agent can `stop` on a red-flag reply.
- **`configure`** — identity synthesis injects real company specifics; the
  sequence plan derives **from the identity**, not the raw context.
- **`llm`** — transient failures (429/5xx/empty output) retry with backoff and
  recover; non-transient errors (bad key) and safety blocks fail fast; clear
  errors on unparseable JSON.
- **`tools`** — `scheduleFollowUp` / `escalateToHuman` execution + batching.
- **session store** — save/get, history ordering, model replacement, safe
  no-ops on unknown ids.

**CI** (`.github/workflows/ci.yml`) runs on every push/PR: lint → typecheck →
test → build across Node 20 and 22, plus a production `npm audit` that fails on
critical advisories. See [SECURITY.md](./SECURITY.md) for the dependency posture.

---

## Deploying (Railway)

This app holds session state in an in-memory store, so it must run as a **single
long-lived Node server** — not on a serverless/multi-instance platform where a
follow-up request could land on a different instance with an empty store.
Railway runs the app as one persistent, always-warm container, which also means
no cold starts.

1. Push this repo to GitHub.
2. In Railway, create a project from the repo.
3. Set the `GEMINI_API_KEY` environment variable (optionally `GEMINI_MODEL`).
4. Deploy. Build/start are defined in `railway.json` (`npm run build` →
   `npm run start`); the start script binds to Railway's `$PORT` automatically.

> **Why not Vercel here?** Vercel's serverless functions are stateless and
> scale to many instances, which breaks the process-local session `Map`. To run
> on Vercel you'd swap the store for Redis (e.g. Upstash) behind the existing
> `src/store/session.ts` interface — a one-file change — and then it would work
> on any platform. For a single-reviewer demo, a warm single instance on Railway
> is simpler and lower-latency.

---

## Try this (to see the intelligence)

1. Load the **playful startup** preset, build the agent, note its tone and name.
2. Go back, load the **enterprise** preset — the agent's personality, prohibited
   phrases, and sequence visibly shift.
3. In the simulator, send a **lukewarm/non-committal** reply → watch it classify
   `objection`/`negotiating` and possibly `scheduleFollowUp`.
4. Send something needing a human (e.g. *"What's the exact equity split and visa
   sponsorship?"*) → watch it `escalateToHuman` and hand off gracefully.
5. Send a reply matching a **red flag** → watch it choose `stop` and disengage
   politely. Throughout, the candidate model on the right keeps updating.

---

## Security & limitations

- All outreach is **simulated** — the app sends no email or LinkedIn messages.
- API routes validate input and return clean errors; the Gemini client is
  instantiated lazily so the key is only needed at request time.
- Dependency note: this uses the latest patched Next.js 14.2.x. A few low-impact
  advisories remain that are only fully resolved in Next.js 16 (a major breaking
  upgrade); they concern features this app doesn't use (image optimization,
  i18n middleware, CSP nonces).
```
