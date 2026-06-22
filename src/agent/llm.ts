import { GoogleGenerativeAI } from "@google/generative-ai";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

// Lazily instantiated so importing this module (e.g. during `next build`
// static analysis) never requires the API key to be present.
let _client: GoogleGenerativeAI | null = null;
function getClient(): GoogleGenerativeAI {
  if (!_client) {
    _client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
  }
  return _client;
}

/**
 * Calls the model and forces a JSON object response.
 * Centralises model choice + JSON parsing so every reasoning stage behaves
 * consistently. Throws on parse failure so callers can surface a clean error.
 *
 * Gemini takes the system prompt as a dedicated `systemInstruction` and emits
 * strict JSON via `responseMimeType`.
 */
export async function jsonCall<T>(
  system: string,
  user: string,
  temperature = 0.7
): Promise<T> {
  const model = getClient().getGenerativeModel({
    model: MODEL,
    systemInstruction: system,
    generationConfig: {
      temperature,
      responseMimeType: "application/json",
    },
  });

  const res = await model.generateContent(user);
  const raw = res.response.text() || "{}";
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
  const model = getClient().getGenerativeModel({
    model: MODEL,
    systemInstruction: system,
    generationConfig: { temperature },
  });

  const res = await model.generateContent(user);
  return res.response.text()?.trim() ?? "";
}
