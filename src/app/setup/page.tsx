"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CompanyContext } from "@/agent/types";

const FIELDS: {
  key: keyof CompanyContext;
  label: string;
  hint: string;
  rows: number;
}[] = [
  {
    key: "name",
    label: "Company name",
    hint: "The company the agent represents",
    rows: 1,
  },
  {
    key: "description",
    label: "What does the company do?",
    hint: "Product, mission, stage",
    rows: 3,
  },
  {
    key: "culture",
    label: "Culture & values",
    hint: "How the team works and what it cares about",
    rows: 3,
  },
  {
    key: "hiringProfiles",
    label: "Roles & ideal candidates",
    hint: "Who you're hiring and what makes a great fit",
    rows: 3,
  },
  {
    key: "tone",
    label: "Desired tone of voice",
    hint: "How outreach should feel",
    rows: 2,
  },
];

const PRESETS: { label: string; data: CompanyContext }[] = [
  {
    label: "Playful seed startup",
    data: {
      name: "Frizzle",
      description:
        "A 12-person seed-stage startup building a collaborative whiteboard for engineering teams. Backed by top-tier VCs, shipping fast.",
      culture:
        "Irreverent, low-ego, ship-daily. We hate process theater. People bring strong opinions loosely held and a lot of humor.",
      hiringProfiles:
        "Senior full-stack engineers who've worked at small startups, love real-time systems, and want huge ownership. Generalists over specialists.",
      tone: "Casual, witty, peer-to-peer. Like a smart friend who happens to be hiring, not a recruiter.",
    },
  },
  {
    label: "Formal enterprise",
    data: {
      name: "Meridian Financial",
      description:
        "A 4,000-person financial services firm modernizing its core banking platform. Regulated, security-first, long-term oriented.",
      culture:
        "Rigorous, measured, deeply professional. We value precision, accountability, and institutional trust. Stability matters.",
      hiringProfiles:
        "Staff backend engineers with experience in regulated environments, distributed systems, and a track record of reliability at scale.",
      tone: "Polished, respectful, credible. Conveys gravitas and stability without being stiff.",
    },
  },
];

export default function Setup() {
  const router = useRouter();
  const [form, setForm] = useState<CompanyContext>({
    name: "",
    description: "",
    culture: "",
    hiringProfiles: "",
    tone: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(key: keyof CompanyContext, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit() {
    setError(null);
    if (!form.name.trim() || !form.description.trim()) {
      setError("Company name and description are required.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/configure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error || "Failed to configure agent.");
      }
      router.push("/preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setLoading(false);
    }
  }

  return (
    <>
      <div className="topbar">
        <div className="brand">
          <span className="dot" />
          PS<span>VIEW</span>
        </div>
        <div className="mono-label">AUTONOMOUS RECRUITING AGENT</div>
      </div>

      <main className="container">
        <div className="pipeline">
          <div className="stage active">
            <div className="stage-no">STAGE 1</div>
            <div className="stage-name">Context</div>
          </div>
          <div className="stage">
            <div className="stage-no">STAGE 2</div>
            <div className="stage-name">Synthesize identity</div>
          </div>
          <div className="stage">
            <div className="stage-no">STAGE 3</div>
            <div className="stage-name">Plan + converse</div>
          </div>
        </div>

        <h1>Configure your agent</h1>
        <p className="muted">
          Give the agent your company context. It will synthesize its own
          personality, plan an outreach sequence, and run a live conversation —
          all simulated, nothing sends.
        </p>

        <div className="preset-row">
          <span className="mono-label" style={{ alignSelf: "center" }}>
            QUICK START
          </span>
          {PRESETS.map((p) => (
            <button key={p.label} onClick={() => setForm(p.data)}>
              {p.label}
            </button>
          ))}
        </div>

        {FIELDS.map((f) => (
          <label key={f.key} className="field">
            <span className="field-label">
              <span className="fl-title">{f.label}</span>
              <span className="field-hint">{f.hint}</span>
            </span>
            {f.rows === 1 ? (
              <input
                value={form[f.key]}
                onChange={(e) => update(f.key, e.target.value)}
              />
            ) : (
              <textarea
                rows={f.rows}
                value={form[f.key]}
                onChange={(e) => update(f.key, e.target.value)}
              />
            )}
          </label>
        ))}

        {error && (
          <p style={{ color: "var(--red)" }} className="small">
            {error}
          </p>
        )}

        <button onClick={submit} disabled={loading}>
          {loading && <span className="spinner" />}
          {loading ? "Configuring agent…" : "Build agent"}
        </button>
      </main>
    </>
  );
}
