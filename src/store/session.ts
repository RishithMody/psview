import { CandidateModel, ChatMessage, Session } from "@/agent/types";

/**
 * Demo-grade in-memory session store. A single server process keeps sessions
 * for their lifetime — no database needed for the assessment. Keyed by a
 * session id stored in an httpOnly cookie.
 *
 * NOTE: on a serverless platform this lives per-instance; fine for a single
 * reviewer walking through the demo. Swapping in Redis later is a one-file
 * change behind this interface.
 */

// Survive Next.js dev hot-reloads by stashing the map on globalThis.
const g = globalThis as unknown as { __psviewStore?: Map<string, Session> };
const store: Map<string, Session> = g.__psviewStore ?? new Map();
g.__psviewStore = store;

export function saveSession(id: string, s: Session): void {
  store.set(id, s);
}

export function getSession(id: string): Session | undefined {
  return store.get(id);
}

export function appendHistory(id: string, ...msgs: ChatMessage[]): void {
  const s = store.get(id);
  if (s) s.history.push(...msgs);
}

export function setCandidateModel(id: string, model: CandidateModel): void {
  const s = store.get(id);
  if (s) s.candidateModel = model;
}
