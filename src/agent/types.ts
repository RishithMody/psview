// ---------------------------------------------------------------------------
// Company context — the form input
// ---------------------------------------------------------------------------
export interface CompanyContext {
  name: string;
  description: string; // who they are / what they do
  culture: string; // values, working style
  hiringProfiles: string; // roles + ideal candidates
  tone: string; // desired voice
}

// ---------------------------------------------------------------------------
// Stage 1 output — the agent's synthesized identity ("brain state")
// ---------------------------------------------------------------------------
export interface AgentIdentity {
  name: string; // the agent gives itself a name
  persona: string; // 1-2 sentence self-description
  toneAdjectives: string[]; // e.g. ["warm", "direct", "nerdy"]
  prohibitedPhrases: string[]; // generic recruiter clichés to never use
  engagementStrategy: string; // how it approaches candidates
  redFlags: string[]; // candidate signals that warrant disengaging
}

// ---------------------------------------------------------------------------
// Stage 2 output — the planned outreach sequence
// ---------------------------------------------------------------------------
export interface Touch {
  order: number;
  intent: string; // hook / value / soft-close
  channel: string; // email / linkedin
  message: string;
}

export interface OutreachSequence {
  touches: Touch[];
}

// ---------------------------------------------------------------------------
// Memory — an evolving structured model of the candidate
// ---------------------------------------------------------------------------
export interface CandidateModel {
  inferredInterests: string[]; // "mentioned remote work twice"
  objections: string[]; // "worried about comp"
  sentiment: "warm" | "neutral" | "cold";
  keyFacts: string[]; // "currently at a FAANG, 5 yrs exp"
  engagementLevel: number; // 0-100, how engaged the candidate seems
}

export function emptyCandidateModel(): CandidateModel {
  return {
    inferredInterests: [],
    objections: [],
    sentiment: "neutral",
    keyFacts: [],
    engagementLevel: 50,
  };
}

// ---------------------------------------------------------------------------
// Tools the agent can autonomously invoke
// ---------------------------------------------------------------------------
export type ToolName = "scheduleFollowUp" | "escalateToHuman";

export interface ToolCall {
  tool: ToolName;
  args: Record<string, string>;
  result: string; // what the (simulated) tool returned
}

// ---------------------------------------------------------------------------
// Conversation state machine
// ---------------------------------------------------------------------------
export type ConvState =
  | "cold_open"
  | "engaged"
  | "objection"
  | "negotiating"
  | "disengaged";

export type Action = "advance" | "handle" | "pivot" | "close" | "stop";

// ---------------------------------------------------------------------------
// Stage 3 output — one full agent turn
// ---------------------------------------------------------------------------
export interface AgentTurn {
  state: ConvState;
  action: Action;
  reasoning: string; // one sentence: WHY this state + action
  message: string; // the reply in persona
  toolCalls: ToolCall[]; // any autonomous actions taken
  candidateModel: CandidateModel; // the updated belief after this turn
  critique?: string; // self-critique note if the draft was revised
}

// ---------------------------------------------------------------------------
// Conversation transcript + session
// ---------------------------------------------------------------------------
export interface ChatMessage {
  role: "agent" | "candidate";
  text: string;
}

export interface Session {
  context: CompanyContext;
  identity: AgentIdentity;
  sequence: OutreachSequence;
  history: ChatMessage[];
  candidateModel: CandidateModel;
}
