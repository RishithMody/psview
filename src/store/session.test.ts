import { describe, it, expect, beforeEach } from "vitest";
import {
  saveSession,
  getSession,
  appendHistory,
  setCandidateModel,
} from "./session";
import { emptyCandidateModel, Session } from "@/agent/types";

function makeSession(): Session {
  return {
    context: {
      name: "Acme",
      description: "Builds things",
      culture: "Fast",
      hiringProfiles: "Engineers",
      tone: "Casual",
    },
    identity: {
      name: "Riley",
      persona: "A friendly recruiter",
      toneAdjectives: ["warm"],
      prohibitedPhrases: ["rockstar"],
      engagementStrategy: "Be human",
      redFlags: ["abusive"],
    },
    sequence: { touches: [] },
    history: [],
    candidateModel: emptyCandidateModel(),
  };
}

describe("emptyCandidateModel", () => {
  it("returns a neutral, empty starting belief", () => {
    const m = emptyCandidateModel();
    expect(m.sentiment).toBe("neutral");
    expect(m.engagementLevel).toBe(50);
    expect(m.inferredInterests).toEqual([]);
    expect(m.objections).toEqual([]);
    expect(m.keyFacts).toEqual([]);
  });

  it("returns a fresh object each call (no shared references)", () => {
    const a = emptyCandidateModel();
    const b = emptyCandidateModel();
    a.inferredInterests.push("x");
    expect(b.inferredInterests).toEqual([]);
  });
});

describe("session store", () => {
  beforeEach(() => {
    // each test uses a unique id, so no explicit teardown needed
  });

  it("saves and retrieves a session by id", () => {
    saveSession("s1", makeSession());
    expect(getSession("s1")?.identity.name).toBe("Riley");
  });

  it("returns undefined for an unknown id", () => {
    expect(getSession("does-not-exist")).toBeUndefined();
  });

  it("appends messages to history in order", () => {
    saveSession("s2", makeSession());
    appendHistory(
      "s2",
      { role: "candidate", text: "hi" },
      { role: "agent", text: "hello" }
    );
    const h = getSession("s2")!.history;
    expect(h).toHaveLength(2);
    expect(h[0]).toEqual({ role: "candidate", text: "hi" });
    expect(h[1].role).toBe("agent");
  });

  it("replaces the candidate model", () => {
    saveSession("s3", makeSession());
    setCandidateModel("s3", {
      inferredInterests: ["remote"],
      objections: [],
      sentiment: "warm",
      keyFacts: ["5 yrs exp"],
      engagementLevel: 80,
    });
    const m = getSession("s3")!.candidateModel;
    expect(m.sentiment).toBe("warm");
    expect(m.engagementLevel).toBe(80);
    expect(m.inferredInterests).toContain("remote");
  });

  it("no-ops safely when updating an unknown session", () => {
    expect(() =>
      appendHistory("ghost", { role: "agent", text: "x" })
    ).not.toThrow();
    expect(() =>
      setCandidateModel("ghost", emptyCandidateModel())
    ).not.toThrow();
  });
});
