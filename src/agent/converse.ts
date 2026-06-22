import { jsonCall } from "./llm";
import { CONVERSE_PROMPT, CRITIQUE_PROMPT } from "./prompts";
import { runToolCalls } from "./tools";
import {
  AgentIdentity,
  AgentTurn,
  CandidateModel,
  ChatMessage,
  CompanyContext,
  ToolName,
} from "./types";

// Shape the model returns before tools are actually executed.
interface RawTurn {
  state: AgentTurn["state"];
  action: AgentTurn["action"];
  reasoning: string;
  message: string;
  toolCalls?: { tool: ToolName; args: Record<string, string> }[];
  candidateModel: CandidateModel;
}

interface CritiqueResult {
  ok: boolean;
  issue: string;
  revised: string;
}

/**
 * STAGE 3 — the core reasoning loop.
 *
 * The model is instructed to FIRST classify state + update its candidate model
 * + choose an action, THEN write a message that executes that decision. The
 * decision is made separately from (and before) the text — that separation is
 * the intelligence.
 *
 * After the draft is produced we run a self-critique pass that enforces persona
 * consistency against the agent's own prohibited phrases, regenerating if it
 * drifted. This makes "the personality stays consistent" a real mechanism.
 */
export async function converse(
  ctx: CompanyContext,
  identity: AgentIdentity,
  history: ChatMessage[],
  priorModel: CandidateModel,
  candidateReply: string
): Promise<AgentTurn> {
  const transcript =
    history.map((m) => `${m.role.toUpperCase()}: ${m.text}`).join("\n") ||
    "(no prior messages — this is the first candidate reply)";

  const user = `Your identity:
${JSON.stringify(identity, null, 2)}

Company: ${ctx.name} — ${ctx.description}
Culture: ${ctx.culture}

Your CURRENT model of the candidate (update it):
${JSON.stringify(priorModel, null, 2)}

Conversation so far:
${transcript}

New candidate reply:
"${candidateReply}"

Reason, then respond.`;

  const raw = await jsonCall<RawTurn>(CONVERSE_PROMPT, user, 0.7);

  // --- Self-critique pass: enforce persona consistency on the draft ---
  let finalMessage = raw.message;
  let critique: string | undefined;

  try {
    const critiqueUser = `Agent identity:
${JSON.stringify(
  {
    persona: identity.persona,
    toneAdjectives: identity.toneAdjectives,
    prohibitedPhrases: identity.prohibitedPhrases,
  },
  null,
  2
)}

Draft message:
"${raw.message}"`;

    const review = await jsonCall<CritiqueResult>(
      CRITIQUE_PROMPT,
      critiqueUser,
      0.3
    );

    if (!review.ok && review.revised) {
      finalMessage = review.revised;
      critique = review.issue;
    }
  } catch {
    // If critique fails, fall back to the original draft rather than erroring.
  }

  // --- Execute any tools the agent chose to invoke ---
  const toolCalls = runToolCalls(raw.toolCalls || []);

  return {
    state: raw.state,
    action: raw.action,
    reasoning: raw.reasoning,
    message: finalMessage,
    toolCalls,
    candidateModel: raw.candidateModel,
    critique,
  };
}
