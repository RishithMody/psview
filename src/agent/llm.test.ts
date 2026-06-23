import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Gemini SDK so we can drive transient failures and responses.
const generateContent = vi.fn();
const getGenerativeModel = vi.fn(() => ({ generateContent }));

vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel = getGenerativeModel;
  },
}));

import { jsonCall, textCall } from "./llm";

function ok(text: string) {
  return {
    response: {
      text: () => text,
      promptFeedback: undefined,
    },
  };
}

beforeEach(() => {
  generateContent.mockReset();
  getGenerativeModel.mockClear();
});

describe("jsonCall retry behaviour", () => {
  it("returns parsed JSON on first success", async () => {
    generateContent.mockResolvedValueOnce(ok('{"a":1}'));
    const out = await jsonCall<{ a: number }>("sys", "user");
    expect(out.a).toBe(1);
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it("retries on a transient error then succeeds", async () => {
    generateContent
      .mockRejectedValueOnce(new Error("503 Service Unavailable"))
      .mockResolvedValueOnce(ok('{"ok":true}'));
    const out = await jsonCall<{ ok: boolean }>("sys", "user");
    expect(out.ok).toBe(true);
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it("retries on an empty response then succeeds", async () => {
    generateContent
      .mockResolvedValueOnce(ok("   "))
      .mockResolvedValueOnce(ok('{"v":2}'));
    const out = await jsonCall<{ v: number }>("sys", "user");
    expect(out.v).toBe(2);
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it("does NOT retry a non-transient error (e.g. bad key)", async () => {
    generateContent.mockRejectedValue(new Error("401 API key not valid"));
    await expect(jsonCall("sys", "user")).rejects.toThrow(/401/);
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it("gives up after max attempts on persistent transient errors", async () => {
    generateContent.mockRejectedValue(new Error("429 rate limit exceeded"));
    await expect(jsonCall("sys", "user")).rejects.toThrow(/429/);
    expect(generateContent).toHaveBeenCalledTimes(3);
  });

  it("does not retry a safety-blocked prompt", async () => {
    generateContent.mockResolvedValue({
      response: {
        text: () => "",
        promptFeedback: { blockReason: "SAFETY" },
      },
    });
    await expect(jsonCall("sys", "user")).rejects.toThrow(/blocked/i);
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it("throws a clear error on unparseable JSON", async () => {
    generateContent.mockResolvedValueOnce(ok("not json"));
    await expect(jsonCall("sys", "user")).rejects.toThrow(/non-JSON/);
  });
});

describe("textCall", () => {
  it("returns trimmed text", async () => {
    generateContent.mockResolvedValueOnce(ok("  hello  "));
    const out = await textCall("sys", "user");
    expect(out).toBe("hello");
  });
});
