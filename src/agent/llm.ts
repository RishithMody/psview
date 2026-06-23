import { GoogleGenerativeAI } from "@google/generative-ai";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

// Retry tuning for transient upstream failures (rate limits, 5xx, timeouts).
const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 600;

// Lazily instantiated so importing this module (e.g. during `next build`
// static analysis) never requires the API key to be present.
let _client: GoogleGenerativeAI | null = null;
function getClient(): GoogleGenerativeAI {
  if (!_client) {
    _client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
  }
  return _client;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// Marker for retryable conditions we detect ourselves (e.g. empty output).
class TransientError extends Error {}

/**
 * Decides whether a failed Gemini call is worth retrying. Transient classes:
 * rate limits (429), server errors (500/503), and timeouts/network resets.
 * Client errors (400/401/403 — bad key, bad request) are NOT retried.
 */
function isTransient(err: unknown): boolean {
  if (err instanceof TransientError) return true;
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes("429") ||
    msg.includes("rate") ||
    msg.includes("quota") ||
    msg.includes("500") ||
    msg.includes("503") ||
    msg.includes("internal") ||
    msg.includes("unavailable") ||
    msg.includes("overloaded") ||
    msg.includes("timeout") ||
    msg.includes("timed out") ||
    msg.includes("econnreset") ||
    msg.includes("network") ||
    msg.includes("fetch failed")
  );
}

/**
 * Runs a Gemini generation with retry + exponential backoff on transient
 * failures, and surfaces blocked/empty responses as clear errors.
 */
async function generate(
  system: string,
  user: string,
  temperature: number,
  json: boolean
): Promise<string> {
  const model = getClient().getGenerativeModel({
    model: MODEL,
    systemInstruction: system,
    generationConfig: json
      ? { temperature, responseMimeType: "application/json" }
      : { temperature },
  });

  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await model.generateContent(user);

      // Detect safety blocks / empty candidates, which would otherwise show up
      // as a confusing JSON parse error downstream.
      const blockReason = res.response.promptFeedback?.blockReason;
      if (blockReason) {
        throw new Error(`Gemini blocked the prompt: ${blockReason}`);
      }

      const text = res.response.text();
      if (!text || !text.trim()) {
        // Empty output is often transient (thinking truncation) — let it retry.
        throw new TransientError("Gemini returned an empty response");
      }
      return text;
    } catch (err) {
      lastErr = err;
      // A prompt block is deterministic; don't waste retries on it.
      const blocked = String(err).toLowerCase().includes("blocked the prompt");
      if (blocked || attempt === MAX_ATTEMPTS || !isTransient(err)) {
        break;
      }
      const delay = BASE_DELAY_MS * 2 ** (attempt - 1);
      await sleep(delay);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

/**
 * Calls the model and forces a JSON object response.
 * Centralises model choice + JSON parsing so every reasoning stage behaves
 * consistently. Throws on parse failure so callers can surface a clean error.
 */
export async function jsonCall<T>(
  system: string,
  user: string,
  temperature = 0.7
): Promise<T> {
  const raw = await generate(system, user, temperature, true);
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(`Model returned non-JSON output: ${raw.slice(0, 200)}`);
  }
}

/** Plain text completion — used by the self-critique revision pass. */
export async function textCall(
  system: string,
  user: string,
  temperature = 0.7
): Promise<string> {
  const raw = await generate(system, user, temperature, false);
  return raw.trim();
}
