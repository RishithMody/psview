import type { CandidateModel } from "@/agent/types";

/** Visualizes the agent's evolving structured belief about the candidate. */
export function CandidateModelPanel({ model }: { model: CandidateModel }) {
  const list = (items: string[], empty: string) =>
    items.length ? (
      <div>
        {items.map((x, i) => (
          <span key={i} className="list-chip">
            {x}
          </span>
        ))}
      </div>
    ) : (
      <span className="empty">{empty}</span>
    );

  return (
    <div className="model-grid">
      <div className="kv">
        <div className="kv-label">Sentiment</div>
        <span className={`sentiment ${model.sentiment}`}>
          {model.sentiment}
        </span>
      </div>

      <div className="kv">
        <div className="kv-label">Engagement</div>
        <div className="bar">
          <div
            style={{
              width: `${Math.max(0, Math.min(100, model.engagementLevel))}%`,
            }}
          />
        </div>
        <span className="empty" style={{ marginTop: 4, display: "inline-block" }}>
          {model.engagementLevel} / 100
        </span>
      </div>

      <div className="kv">
        <div className="kv-label">Inferred interests</div>
        {list(model.inferredInterests, "none yet")}
      </div>

      <div className="kv">
        <div className="kv-label">Objections</div>
        {list(model.objections, "none raised")}
      </div>

      <div className="kv">
        <div className="kv-label">Key facts</div>
        {list(model.keyFacts, "none gathered")}
      </div>
    </div>
  );
}
