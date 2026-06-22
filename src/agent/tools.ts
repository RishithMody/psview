import { ToolCall, ToolName } from "./types";

/**
 * Simulated tool execution. In production these would hit a scheduler / CRM /
 * notification system. Here they return a deterministic, human-readable result
 * so the UI can show that the agent ACTED, not just spoke.
 *
 * The intelligence is in WHEN the agent decides to call these (decided by the
 * converse stage), not in the execution itself.
 */
export function executeTool(
  tool: ToolName,
  args: Record<string, string>
): string {
  switch (tool) {
    case "scheduleFollowUp": {
      const days = args.delayDays || "3";
      const reason = args.reason || "candidate went quiet";
      return `Follow-up queued for +${days} day(s). Reason: ${reason}`;
    }
    case "escalateToHuman": {
      const reason = args.reason || "needs human judgment";
      return `Escalated to a human recruiter. Reason: ${reason}`;
    }
    default:
      return `Unknown tool: ${tool}`;
  }
}

/** Run a batch of tool calls produced by the agent, attaching results. */
export function runToolCalls(
  calls: { tool: ToolName; args: Record<string, string> }[]
): ToolCall[] {
  return (calls || []).map((c) => ({
    tool: c.tool,
    args: c.args || {},
    result: executeTool(c.tool, c.args || {}),
  }));
}
