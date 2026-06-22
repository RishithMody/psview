import { describe, it, expect } from "vitest";
import { executeTool, runToolCalls } from "./tools";

describe("executeTool", () => {
  it("scheduleFollowUp returns a result mentioning the delay and reason", () => {
    const out = executeTool("scheduleFollowUp", {
      delayDays: "5",
      reason: "candidate went quiet",
    });
    expect(out).toContain("5");
    expect(out).toContain("candidate went quiet");
  });

  it("scheduleFollowUp falls back to defaults when args are missing", () => {
    const out = executeTool("scheduleFollowUp", {});
    expect(out).toMatch(/\+3 day/);
  });

  it("escalateToHuman returns a hand-off result with the reason", () => {
    const out = executeTool("escalateToHuman", { reason: "visa question" });
    expect(out.toLowerCase()).toContain("human");
    expect(out).toContain("visa question");
  });

  it("handles an unknown tool gracefully", () => {
    // @ts-expect-error testing defensive branch
    const out = executeTool("noSuchTool", {});
    expect(out).toMatch(/unknown tool/i);
  });
});

describe("runToolCalls", () => {
  it("executes a batch and attaches results to each call", () => {
    const calls = runToolCalls([
      { tool: "scheduleFollowUp", args: { delayDays: "2", reason: "quiet" } },
      { tool: "escalateToHuman", args: { reason: "comp negotiation" } },
    ]);
    expect(calls).toHaveLength(2);
    expect(calls[0].tool).toBe("scheduleFollowUp");
    expect(calls[0].result).toContain("2");
    expect(calls[1].result).toContain("comp negotiation");
  });

  it("returns an empty array when given no calls", () => {
    expect(runToolCalls([])).toEqual([]);
    // @ts-expect-error testing nullish input
    expect(runToolCalls(undefined)).toEqual([]);
  });
});
