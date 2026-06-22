"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  AgentIdentity,
  AgentTurn,
  CandidateModel,
  ChatMessage,
  CompanyContext,
  OutreachSequence,
  ToolCall,
} from "@/agent/types";
import { emptyCandidateModel } from "@/agent/types";
import { ReasoningTrace } from "@/components/ReasoningTrace";
import { CandidateModelPanel } from "@/components/CandidateModelPanel";

interface SessionData {
  context: CompanyContext;
  identity: AgentIdentity;
  sequence: OutreachSequence;
  history: ChatMessage[];
  candidateModel: CandidateModel;
}

// One-click candidate scenarios so reviewers can drive the agent effortlessly
// and exercise each branch of its reasoning.
const SUGGESTIONS: { label: string; text: string }[] = [
  {
    label: "Interested",
    text: "This actually sounds interesting — tell me more about the team and what I'd be working on.",
  },
  {
    label: "Lukewarm",
    text: "I'm pretty happy where I am right now, not really looking to move.",
  },
  {
    label: "Needs a human",
    text: "What's the exact equity split, base range, and do you sponsor visas?",
  },
  {
    label: "Hard no",
    text: "Not interested. Please remove me from your list and don't contact me again.",
  },
];

export default function Preview() {
  const router = useRouter();
  const [data, setData] = useState<SessionData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [model, setModel] = useState<CandidateModel>(emptyCandidateModel());
  const [lastTurn, setLastTurn] = useState<AgentTurn | null>(null);
  const [actions, setActions] = useState<ToolCall[]>([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/session")
      .then(async (res) => {
        if (!res.ok) throw new Error("No active session.");
        return res.json();
      })
      .then((d: SessionData) => {
        setData(d);
        setChat(d.history || []);
        setModel(d.candidateModel || emptyCandidateModel());
      })
      .catch(() => setLoadError("No configured agent found."));
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat, sending]);

  async function sendText(candidate: string) {
    if (!candidate.trim() || sending) return;
    setError(null);
    setReply("");
    setChat((c) => [...c, { role: "candidate", text: candidate }]);
    setSending(true);

    try {
      const res = await fetch("/api/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateReply: candidate }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error || "Agent failed to respond.");
      }
      const turn: AgentTurn = await res.json();
      setChat((c) => [...c, { role: "agent", text: turn.message }]);
      setModel(turn.candidateModel);
      setLastTurn(turn);
      if (turn.toolCalls?.length) {
        setActions((a) => [...a, ...turn.toolCalls]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSending(false);
    }
  }

  async function resetConversation() {
    await fetch("/api/reset", { method: "POST" });
    setChat([]);
    setModel(emptyCandidateModel());
    setLastTurn(null);
    setActions([]);
    setError(null);
  }

  function seedFromTouch(text: string) {
    if (chat.length === 0) setChat([{ role: "agent", text }]);
  }

  if (loadError) {
    return (
      <>
        <Topbar />
        <main className="container">
          <h1>No agent configured</h1>
          <p className="muted">{loadError}</p>
          <button onClick={() => router.push("/setup")}>Go to setup</button>
        </main>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <Topbar />
        <main className="container">
          <p className="empty">
            <span className="spinner light" /> Loading agent…
          </p>
        </main>
      </>
    );
  }

  const { identity, sequence, context } = data;

  return (
    <>
      <Topbar agentName={identity.name} company={context.name} />

      <div className="grid">
        {/* ---------------- LEFT: who the agent is + its plan ---------------- */}
        <div>
          <div className="panel">
            <div className="panel-head">
              <span className="idx">01</span>
              <h2>Agent identity</h2>
            </div>
            <p className="empty" style={{ marginTop: -4, marginBottom: 14 }}>
              Synthesized from your context — not hand-written.
            </p>
            <div className="kv">
              <div className="kv-label">Designation</div>
              <strong style={{ fontSize: 16 }}>{identity.name}</strong>
            </div>
            <div className="kv">
              <div className="kv-label">Persona</div>
              {identity.persona}
            </div>
            <div className="kv">
              <div className="kv-label">Tone vector</div>
              <div>
                {identity.toneAdjectives.map((t) => (
                  <span key={t} className="tag">
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <div className="kv">
              <div className="kv-label">Strategy</div>
              {identity.engagementStrategy}
            </div>
            <div className="kv">
              <div className="kv-label">Will never say</div>
              <div>
                {identity.prohibitedPhrases.map((p) => (
                  <span key={p} className="list-chip">
                    “{p}”
                  </span>
                ))}
              </div>
            </div>
            <div className="kv">
              <div className="kv-label">Disengages if</div>
              <div>
                {identity.redFlags.map((r) => (
                  <span key={r} className="list-chip">
                    {r}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <span className="idx">02</span>
              <h2>Planned outreach sequence</h2>
            </div>
            {sequence.touches
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((t) => (
                <div key={t.order} className="card">
                  <div className="card-head">
                    <span className="card-intent">
                      T{t.order} · {t.intent}
                    </span>
                    <span className="card-channel">{t.channel}</span>
                  </div>
                  <div style={{ whiteSpace: "pre-wrap" }}>{t.message}</div>
                  {chat.length === 0 && t.order === 1 && (
                    <button
                      className="ghost"
                      style={{ marginTop: 12, padding: "7px 13px" }}
                      onClick={() => seedFromTouch(t.message)}
                    >
                      Use as opening message
                    </button>
                  )}
                </div>
              ))}
          </div>
        </div>

        {/* ---------------- RIGHT: live simulation + reasoning ---------------- */}
        <div>
          <div className="panel">
            <div className="panel-head">
              <span className="idx">03</span>
              <h2>Simulate a candidate</h2>
              {chat.length > 0 && (
                <button
                  className="ghost"
                  style={{ marginLeft: "auto", padding: "5px 11px" }}
                  onClick={resetConversation}
                >
                  Reset
                </button>
              )}
            </div>

            <div className="chat">
              {chat.length === 0 && (
                <span className="empty">
                  Seed the conversation with the opening message, or pick a
                  scenario below.
                </span>
              )}
              {chat.map((m, i) => (
                <div key={i} className={`bubble ${m.role} fade-in`}>
                  <div className="bubble-role">
                    {m.role === "agent" ? identity.name : "Candidate"}
                  </div>
                  {m.text}
                </div>
              ))}
              {sending && (
                <div className="bubble agent">
                  <div className="bubble-role">{identity.name}</div>
                  <span className="spinner light" /> reasoning…
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {lastTurn && <ReasoningTrace turn={lastTurn} />}

            {error && (
              <p style={{ color: "var(--red)" }} className="small">
                {error}
              </p>
            )}

            <div className="suggestions">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.label}
                  className="chip"
                  disabled={sending}
                  onClick={() => sendText(s.text)}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div className="composer">
              <input
                value={reply}
                placeholder="Type a candidate reply…"
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendText(reply)}
              />
              <button onClick={() => sendText(reply)} disabled={sending}>
                Send
              </button>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <span className="idx">04</span>
              <h2>Candidate model · memory</h2>
            </div>
            <p className="empty" style={{ marginTop: -4, marginBottom: 14 }}>
              The agent&apos;s evolving belief. Updates every turn.
            </p>
            <CandidateModelPanel model={model} />
          </div>

          <div className="panel">
            <div className="panel-head">
              <span className="idx">05</span>
              <h2>Autonomous actions</h2>
            </div>
            <p className="empty" style={{ marginTop: -4, marginBottom: 14 }}>
              Tools the agent chose to invoke on its own.
            </p>
            {actions.length === 0 ? (
              <span className="empty">No actions taken yet.</span>
            ) : (
              actions.map((a, i) => (
                <div
                  key={i}
                  className={`action-item fade-in ${
                    a.tool === "escalateToHuman" ? "escalate" : ""
                  }`}
                >
                  <div>
                    <strong style={{ fontFamily: "var(--mono)", fontSize: 13 }}>
                      {a.tool}()
                    </strong>
                    <div className="empty" style={{ marginTop: 2 }}>
                      {a.result}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function Topbar({
  agentName,
  company,
}: {
  agentName?: string;
  company?: string;
}) {
  const router = useRouter();
  return (
    <div className="topbar">
      <div className="brand">
        <span className="dot" />
        PS<span>VIEW</span>
      </div>
      {agentName ? (
        <div className="mono-label">
          <span style={{ color: "var(--accent)" }}>{agentName}</span> ·{" "}
          {company} ·{" "}
          <a onClick={() => router.push("/setup")} style={{ cursor: "pointer" }}>
            Reconfigure
          </a>
        </div>
      ) : (
        <div className="mono-label">PREVIEW</div>
      )}
    </div>
  );
}
