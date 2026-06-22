import type { AgentTurn } from "@/agent/types";

/** Renders the agent's decision (state + action + reasoning) for a turn. */
export function ReasoningTrace({ turn }: { turn: AgentTurn }) {
  const actionClass =
    turn.action === "stop"
      ? "pill stop"
      : turn.action === "handle" || turn.action === "pivot"
      ? "pill warn"
      : "pill action";

  return (
    <div className="trace fade-in">
      <div className="mono-label" style={{ marginBottom: 8 }}>
        AGENT REASONING
      </div>
      <div className="trace-row">
        <span className="trace-key">state</span>
        <span className="pill state">{turn.state}</span>
      </div>
      <div className="trace-row">
        <span className="trace-key">action</span>
        <span className={actionClass}>{turn.action}</span>
      </div>
      <div className="trace-row">
        <span className="trace-key">why</span>
        <span>{turn.reasoning}</span>
      </div>
      {turn.critique && (
        <div className="trace-row">
          <span className="trace-key">revised</span>
          <span className="muted">self-corrected: {turn.critique}</span>
        </div>
      )}
    </div>
  );
}
