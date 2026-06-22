# Security

## Posture

- **No real outreach.** The app sends no email or LinkedIn messages. The
  `scheduleFollowUp` and `escalateToHuman` tools are simulated and return
  deterministic strings — there is no external delivery integration.
- **Lazy secret access.** The Gemini client is instantiated on first request,
  not at module load, so the API key is never required at build time and is
  read only from the server environment (`GEMINI_API_KEY`).
- **Server-only key.** The key is never exposed to the client; all model calls
  happen in `nodejs` runtime API routes.
- **httpOnly session cookie.** The session id is stored in an `httpOnly`,
  `sameSite=lax` cookie; session state itself lives server-side.

## Input validation

All untrusted request input is validated and bounded before use:

- `POST /api/configure` — `parseCompanyContext()` enforces that every field is a
  string, requires `name` + `description`, trims, and caps each field at
  4000 chars.
- `POST /api/message` — `candidateReply` must be a non-empty string and is
  capped at 4000 chars (HTTP 413 otherwise).

These caps bound prompt size, model cost, and abuse surface.

## Dependency advisories

CI runs `npm audit` on every push/PR. The gate **fails on CRITICAL** production
advisories; HIGH/moderate are surfaced informationally.

### Resolved
- **CVE-2025-55184**, **CVE-2025-67779** (Next.js, HIGH) — fixed by upgrading to
  `next@14.2.35`.

### Residual (accepted, tracked)
A few advisories on `next` / `postcss` are only fully resolved by upgrading to
**Next.js 16**, a major breaking change (also requires React 19). They concern
features this app does **not** use:

- Image Optimization API / `next/image` cache — not used (no images).
- React Server Components streaming DoS — app uses client components + simple
  route handlers.
- Middleware / Proxy / i18n rewrites — no middleware or i18n.
- CSP nonce XSS — no CSP nonce usage.

Because the deployed surface does not exercise any of these code paths, the
residual risk is low. A Next.js 16 upgrade is tracked as future work and was
deliberately not bundled into this change to avoid destabilizing a working
deployment.

## Reporting

This is a take-home demo. For a production deployment, the in-memory session
store would be swapped for Redis (see `src/store/session.ts`), and rate limiting
plus a CSP would be added at the edge.
