import { jsonCall } from "./llm";
import { IDENTITY_PROMPT, SEQUENCE_PROMPT } from "./prompts";
import { AgentIdentity, CompanyContext, OutreachSequence } from "./types";

/**
 * STAGE 1 — Identity synthesis.
 * The agent derives its OWN personality from company context. This identity is
 * generated once and then constrains every downstream message, which is what
 * keeps the personality consistent and makes it change when reconfigured.
 */
export async function synthesizeIdentity(
  ctx: CompanyContext
): Promise<AgentIdentity> {
  const user = `Company context:
Name: ${ctx.name}
What they do: ${ctx.description}
Culture: ${ctx.culture}
Who they hire: ${ctx.hiringProfiles}
Desired tone: ${ctx.tone}

Synthesize a recruiting agent identity that authentically represents THIS company. It must be specific enough that a generic message would violate it.`;

  return jsonCall<AgentIdentity>(IDENTITY_PROMPT, user, 0.6);
}

/**
 * STAGE 2 — Sequence planning.
 * Derived FROM the identity (not the raw context), so the plan inherits the
 * agent's voice and strategy rather than being generic copy.
 */
export async function planSequence(
  ctx: CompanyContext,
  identity: AgentIdentity
): Promise<OutreachSequence> {
  const user = `You are this agent:
${JSON.stringify(identity, null, 2)}

You are recruiting for: ${ctx.hiringProfiles}
At: ${ctx.name} — ${ctx.description}

Plan your 3-touch cold outreach sequence now.`;

  return jsonCall<OutreachSequence>(SEQUENCE_PROMPT, user, 0.7);
}

/** Convenience: run both configure stages together. */
export async function configureAgent(ctx: CompanyContext): Promise<{
  identity: AgentIdentity;
  sequence: OutreachSequence;
}> {
  const identity = await synthesizeIdentity(ctx);
  const sequence = await planSequence(ctx, identity);
  return { identity, sequence };
}
