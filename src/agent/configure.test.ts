import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the LLM layer so we test orchestration, not Gemini.
const jsonCall = vi.fn();
vi.mock("./llm", () => ({
  jsonCall: (...args: unknown[]) => jsonCall(...args),
  textCall: vi.fn(),
}));

import { synthesizeIdentity, planSequence, configureAgent } from "./configure";
import { CompanyContext } from "./types";

const ctx: CompanyContext = {
  name: "Frizzle",
  description: "Real-time whiteboard for engineers",
  culture: "Irreverent, ship-daily",
  hiringProfiles: "Senior full-stack generalists",
  tone: "Casual, witty",
};

const fakeIdentity = {
  name: "Sam",
  persona: "A no-fluff engineer-recruiter",
  toneAdjectives: ["casual", "witty"],
  prohibitedPhrases: ["rockstar", "exciting opportunity"],
  engagementStrategy: "Talk shop, not HR-speak",
  redFlags: ["abusive", "asks to be removed"],
};

const fakeSequence = {
  touches: [
    { order: 1, intent: "hook", channel: "email", message: "Hey" },
    { order: 2, intent: "value", channel: "email", message: "More" },
    { order: 3, intent: "soft-close", channel: "linkedin", message: "Last ping" },
  ],
};

beforeEach(() => {
  jsonCall.mockReset();
});

describe("synthesizeIdentity", () => {
  it("passes company context into the prompt and returns the identity", async () => {
    jsonCall.mockResolvedValueOnce(fakeIdentity);
    const out = await synthesizeIdentity(ctx);
    expect(out.name).toBe("Sam");
    // the user prompt (2nd arg) must include real company specifics
    const userPrompt = jsonCall.mock.calls[0][1] as string;
    expect(userPrompt).toContain("Frizzle");
    expect(userPrompt).toContain("Senior full-stack generalists");
  });
});

describe("planSequence", () => {
  it("feeds the identity into the plan prompt (plan derives FROM identity)", async () => {
    jsonCall.mockResolvedValueOnce(fakeSequence);
    const out = await planSequence(ctx, fakeIdentity);
    expect(out.touches).toHaveLength(3);
    const userPrompt = jsonCall.mock.calls[0][1] as string;
    // identity is serialized into the prompt, not just raw context
    expect(userPrompt).toContain("Sam");
    expect(userPrompt).toContain("no-fluff");
  });
});

describe("configureAgent", () => {
  it("runs identity synthesis then sequence planning in order", async () => {
    jsonCall
      .mockResolvedValueOnce(fakeIdentity)
      .mockResolvedValueOnce(fakeSequence);
    const out = await configureAgent(ctx);
    expect(jsonCall).toHaveBeenCalledTimes(2);
    expect(out.identity.name).toBe("Sam");
    expect(out.sequence.touches).toHaveLength(3);
  });
});
