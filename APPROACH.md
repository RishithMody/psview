# PSView — Founding Engineer Technical Test

> **Brief:** Build a mini web app where an autonomous AI agent configures itself
> from a company's context, gives itself a personality, generates a candidate
> engagement sequence, and runs a simulated conversation. Nothing sends for real.

---

## Table of Contents

1. [Strategy](#1-strategy)
2. [Architecture](#2-architecture)
3. [What Makes It Intelligent](#3-what-makes-it-intelligent)
4. [README (for the repo)](#4-readme-for-the-repo)
5. [Build Plan](#5-build-plan)

---

## 1. Strategy

The brief is testing one thing above all: **can you build an agent that reasons,
not just generates?**

- The simulation / preview area is the demo stage — that's where the intelligence
  is shown.
- Everything else (form, UI) is scaffolding.

**Key insight from the brief:** *"Show us where the intelligence is, not just text
generation."* This means you need **visible reasoning** — the agent should expose
*why* it made a decision, not just *what* it said.

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Next.js App                       │
│                                                      │
│  /setup    Company Context Form                      │
│  /preview  Agent Simulation Playground               │
└──────────┬──────────────────────────────────────────┘
           │
    ┌──────▼──────────────────────────┐
    │         API Routes              │
    │  POST /api/configure  → builds  │
    │         agent identity          │
    │  POST /api/message    → agent   │
    │         reasons + responds      │
    └──────┬──────────────────────────┘
           │
    ┌──────▼──────────────────────────────────────────┐
    │              Agent Core (the smart part)         │
    │                                                  │
    │  1. ConfigureAgent(companyContext)               │
    │     → derives personality traits                 │
    │     → generates opening sequence (3 touches)     │
    │     → stores reasoning trace                     │
    │                                                  │
    │  2. ConversationAgent(message, history, context) │
    │     → reads conversation state                   │
    │     → decides: advance / handle objection /      │
    │                pivot / disengage                 │
    │     → responds in configured personality         │
    │     → exposes decision trace to UI               │
    └──────────────────────────────────────────────────┘
```

### Stack

| Layer      | Choice                | Why                                          |
|------------|-----------------------|----------------------------------------------|
| Framework  | **Next.js 14** (App Router) | Full-stack, single repo, easy deploy   |
| Hosting    | **Vercel**            | Live URL in ~2 minutes                       |
| LLM        | **OpenAI gpt-4o**     | Strong reasoning + structured output         |
| State      | **No database**       | Context in a short-lived server-side store (Map + sessionId cookie). Simple, stateful for the demo session. |

---

## 3. What Makes It Intelligent

The agent runs a **two-layer reasoning loop**:

### Layer 1 — Configuration

When given company context, it **does not** generate messages directly. It first
derives a structured identity:

```json
{
  "persona": "...",
  "tone_adjectives": ["...", "..."],
  "prohibited_phrases": ["...", "..."],
  "engagement_strategy": "...",
  "red_flags": ["...", "..."]
}
```

This identity is the agent's "brain state" and **gates everything downstream**.

### Layer 2 — Conversation State Machine

Before each reply, the agent classifies the conversation state and picks an action:

```
cold_open → engaged → objection → negotiating → disengaged

action ∈ { advance | handle | pivot | close | stop }
```

The LLM is called **within** that decision frame, not asked to figure out the
frame itself. The reasoning trace is shown in the UI.

> **Result:** the same LLM produces dramatically different behavior depending on
> company context, because the *framing* changes — not just the prompt text.

---

## 4. README (for the repo)

```markdown
# PSView Agent — Technical Assessment

## What I Built

A mini web app where you configure an AI recruiting agent with a company's
context, and it autonomously generates a candidate engagement sequence and
handles replies — all simulated (nothing sends).

Two screens:
1. **Setup** — form for company name, culture, role profiles, and tone
2. **Preview** — the agent's generated message sequence + a live conversation
   simulator where you type candidate replies and watch it reason + respond

## Architecture

- **Next.js 14** (App Router) — API routes + React UI in one repo
- **OpenAI gpt-4o** via streaming
- **Stateful session** — agent context stored server-side per session (no DB
  needed for a demo)
- **Deployed on Vercel**

## Key Choices

**No database.** Session state lives in a server-side Map keyed by a cookie.
Keeps the demo fast and self-contained without ops overhead.

**Structured intermediate reasoning, not prompt chaining.** The agent first
produces a structured identity object from company context (persona, tone,
strategy, red flags), then uses that as a typed constraint for every subsequent
message. The UI shows this reasoning trace so you can see it working.

**State machine over free conversation.** The agent classifies each reply into a
conversation state (cold → engaged → objection → negotiating → disengaged) and
selects an action before generating text. This is what gives it consistent
behavior across wildly different inputs.

## What Makes the Agent Intelligent

It separates *decision-making* from *text generation* — the agent classifies
conversation state and selects an action before the LLM writes a word, so the
LLM executes a reasoned decision rather than making one.

## Running Locally

\`\`\`bash
npm install
cp .env.example .env.local  # add OPENAI_API_KEY
npm run dev
\`\`\`

## Deployed

[live-url-here]
```

---

## 5. Build Plan

> Fits comfortably in the 24-hour window.

| Time   | Task                                                                    |
|--------|-------------------------------------------------------------------------|
| 0–2h   | Scaffold Next.js, build the agent core (configure + conversation logic) |
| 2–4h   | API routes: `/api/configure`, `/api/message`                            |
| 4–6h   | Setup form UI                                                           |
| 6–9h   | Preview/simulation UI — message sequence + chat + reasoning trace panel |
| 9–10h  | Deploy to Vercel, write README                                          |

---

## Deliverables Checklist

- [ ] Deployed URL
- [ ] GitHub repo
- [ ] Short README (what you built, choices, one-line intelligence statement)
