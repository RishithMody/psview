import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the LLM layer. converse() calls jsonCall twice: once for the turn,
// once for the self-critique pass.
const jsonCall = vi.fn();
vi.mock("./llm", () => ({
  jsonCall: (...args: unknown[]) => jsonCall(...args),
  textCall: vi.fn(),
}));

import { converse } from "./converse";
import { AgentIdentity, CandidateModel, CompanyContext } from "./types";

const ctx: CompanyContext = {
  name: "Frizzle",
  description: "Real-time whiteboard",
  culture: "Ship-daily",
  hiringProfiles: "Generalists",
  tone: "Casual",
};

const identity: AgentIdentity = {
  name: "Sam",
  persona: "No-fluff engineer-recruiter",
  toneAdjectives: ["casual"],
  prohibitedPhrases: ["rockstar"],
  engagementStrategy: "Talk shop",
  redFlags: ["asks to be removed"],
};

const priorModel: CandidateModel = {
  inferredInterests: [],
  objections: [],
  sentiment: "neutral",
  keyFacts: [],
  engagementLevel: 50,
};

function turn(overrides: Record<string, unknown> = {}) {
  return {
    state: "engaged",
    action: "advance",
    reasoning: "candidate showed interest",
    message: "Great, here's what the team is building.",
    toolCalls: [],
    candidateModel: {
      inferredInterests: ["the product"],
      objections: [],
      sentiment: "warm",
      keyFacts: ["replied positively"],
      engagementLevel: 70,
    },
    ...overrides,
  };
}

const critiqueOk = { ok: true, issue: "", revised: "" };

beforeEach(() => {
  jsonCall.mockReset();
});

describe("converse — core reasoning loop", () => {
  it("returns a structured decision (state/action/reasoning) alongside the message", async () => {
    jsonCall.mockResolvedValueOnce(turn()).mockResolvedValueOnce(critiqueOk);
    const out = await converse(ctx, identity, [], priorModel, "Tell me more");
    expect(out.state).toBe("engaged");
    expect(out.action).toBe("advance");
    expect(out.reasoning).toBeTruthy();
    expect(out.message).toContain("team");
  });

  it("threads the prior candidate model into the prompt and returns the updated one", async () => {
    jsonCall.mockResolvedValueOnce(turn()).mockResolvedValueOnce(critiqueOk);
    const out = await converse(
      ctx,
      identity,
      [],
      { ...priorModel, keyFacts: ["FAANG, 5 yrs"] },
      "I'm at a big company"
    );
    const userPrompt = jsonCall.mock.calls[0][1] as string;
    expect(userPrompt).toContain("FAANG, 5 yrs"); // prior memory fed in
    expect(out.candidateModel.sentiment).toBe("warm"); // updated belief out
    expect(out.candidateModel.engagementLevel).toBe(70);
  });

  it("executes tools the agent chose, attaching results", async () => {
    jsonCall
      .mockResolvedValueOnce(
        turn({
          action: "handle",
          toolCalls: [
            { tool: "escalateToHuman", args: { reason: "comp negotiation" } },
          ],
        })
      )
      .mockResolvedValueOnce(critiqueOk);
    const out = await converse(ctx, identity, [], priorModel, "What's the comp?");
    expect(out.toolCalls).toHaveLength(1);
    expect(out.toolCalls[0].tool).toBe("escalateToHuman");
    expect(out.toolCalls[0].result).toContain("comp negotiation");
  });

  it("applies the self-critique revision when the draft drifts", async () => {
    jsonCall
      .mockResolvedValueOnce(turn({ message: "Hey rockstar, exciting opp!" }))
      .mockResolvedValueOnce({
        ok: false,
        issue: "used prohibited phrase 'rockstar'",
        revised: "Hey — quick note about the team.",
      });
    const out = await converse(ctx, identity, [], priorModel, "hi");
    expect(out.message).toBe("Hey — quick note about the team.");
    expect(out.critique).toContain("rockstar");
  });

  it("keeps the original draft when self-critique passes", async () => {
    jsonCall.mockResolvedValueOnce(turn()).mockResolvedValueOnce(critiqueOk);
    const out = await converse(ctx, identity, [], priorModel, "hi");
    expect(out.message).toContain("team");
    expect(out.critique).toBeUndefined();
  });

  it("falls back to the draft if the critique pass throws", async () => {
    jsonCall
      .mockResolvedValueOnce(turn({ message: "Original draft." }))
      .mockRejectedValueOnce(new Error("model error"));
    const out = await converse(ctx, identity, [], priorModel, "hi");
    expect(out.message).toBe("Original draft.");
    expect(out.critique).toBeUndefined();
  });

  it("can choose to stop on a red-flag reply", async () => {
    jsonCall
      .mockResolvedValueOnce(
        turn({
          state: "disengaged",
          action: "stop",
          reasoning: "candidate asked to be removed (red flag)",
          candidateModel: { ...turn().candidateModel, sentiment: "cold" },
        })
      )
      .mockResolvedValueOnce(critiqueOk);
    const out = await converse(
      ctx,
      identity,
      [],
      priorModel,
      "Remove me from your list."
    );
    expect(out.action).toBe("stop");
    expect(out.candidateModel.sentiment).toBe("cold");
  });
});
