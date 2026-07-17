# Aegis — Current State (session handoff log)

> The **past** — an **append-only** record so a future session (human or AI) can
> reconstruct the full picture: what was built, when, and why.
>
> **Rules (binding for this file):**
> - **Append-only.** Newest entries at the bottom; never rewrite history.
> - **Every claim has a source** — a commit hash, a file path, or a measured result.
> - **Absolute ISO dates** (`YYYY-MM-DD`), never "recently" or "last week".
>
> Companions: `docs/PROJECT_STATUS.md` (snapshot) · `docs/ROADMAP.md` (future — tick
> its box in the same commit as the entry here) · `docs/STRATEGY-LEDGER.md`
> (decisions) · `docs/lessons_learned.md` (prevention).

## Changelog (append-only, newest at bottom)

### 2026-07-17 — Project scaffolded + concept locked

**Setup.** Doc system + anti-drift mechanisms laid down (vendored `starter-pack/`):
constitution (`CLAUDE.md`), placeholder `vision.md` (user approval pending — left
editable), this log, `docs/PRD.md`, `docs/ROADMAP.md`, `docs/architecture.md`,
`docs/STRATEGY-LEDGER.md` (+ SessionStart injection hook), `docs/lessons_learned.md`,
`logs/DECISIONS.jsonl` (seeded 0001–0005) + `logs/errors.jsonl` (empty), and the
enforcement layer (`scripts/bootstrap.sh`: chmod 444 + pre-commit on vision/CLAUDE/architecture).

**Concept decided.** After multi-round brainstorming and a deep-research pass (103 sub-agents,
verified against `zero.xyz/browse`, the `zero-plugins` repo, Metaview and Nexla docs), the
team converged on **Aegis** — an autonomous procurement agent whose stockout-rescue loop has
fraud defense built into every step. Full rationale and the rejected alternatives (Concepts
A/B/C and pure-software ideas) are in `docs/STRATEGY-LEDGER.md` decisions 2–5 and `docs/PRD.md`.

**Key research findings that shaped the design** (source: deep-research report, 2026-07-17):
- Zero.xyz does NOT broker credit-bureau / supplier-registry / fraud-score / freight data
  (kills the original Concepts A/B/C paid steps) → verify via enrichment + scrape + news +
  AI call instead (`STRATEGY-LEDGER` decision 3).
- Fillmore is recruiting-only → dropped; PO email via StableEmail (decision 4).
- Nexla FlexFlow (GA) is the trigger layer, not MCP Studio (Early Access) (decision 5).

**Not yet built.** No application code exists. Next session starts at `docs/ROADMAP.md`
Phase 0 → freeze the five interface signatures, then parallel build.

### 2026-07-17 — Infrastructure doc + judge-facing README

**Added.** `docs/infrastructure.md` — the end-to-end runtime infra: topology diagram, the
five deployable units + ports/trust-boundaries, the Pomerium-gated `POST /po` request path
step by step (how the `403` physically happens), the Zero.xyz x402 paid-call plumbing, the
Nexla trigger, secrets handling, and local-vs-Akash deployment (local-first; Akash is P2
coverage). Also added a public **`README.md`** (judge-facing): problem, the trust-loop, the
tool mapping, the embedded topology diagram (linking to the full infra doc), repo layout,
local quickstart, and the team split. `.gitignore` extended (user) to cover `data/`,
`coverage/`, `*.tsbuildinfo`. Key infra invariant documented: `services/procurement` is
reachable **only** through Pomerium — no route exists for the agent to bypass the gate.

### 2026-07-17 — Green vertical slice: monitor, signed attestations, pre-verification denial, infra

**Built (working tree integrated this session; tests 9/9, `tsc --noEmit` clean).**
The full local vertical slice now exists and runs: always-on inventory monitor
(`services/control-plane/src/monitor.ts`, 2s interval, threshold + idle + no-inbound guards);
agent loop that attempts the cheapest **unattested** PO first, observes the live 403, replans,
buys evidence, and orders with a signed capability (`services/agent/src/index.ts`);
HMAC-signed quote/payee/amount-bound `VendorAttestation` with nonce replay defense
(`packages/security`, `services/procurement`); deterministic vendor-risk policy v1.1
(`services/verification/src/policy.ts`); pluggable fixture/live_zero evidence collector
(`collector.ts`); Nexla webhook ingress (`POST /api/events/stockout`); ops dashboard with
decision trail. Infra: `Dockerfile`, `compose.yaml`, `deploy/akash/deploy.example.yaml`,
`infra/pomerium/vendor-policy.example.yaml`, `scripts/doctor.ts` readiness checker,
integration runbooks under `docs/integrations/` (ZERO, POMERIUM, NEXLA, AKASH), `docs/DEMO.md`
3-minute script, `CONTRIBUTING.md`. Decisions 0006–0010 recorded in `logs/DECISIONS.jsonl`.
Pending on-site: Zero service lock (`config/zero-services.json` empty), Pomerium route +
service accounts, StableEmail adapter, Nexla FlexFlow config, Akash deploy (P2).

### 2026-07-17 — Integration: branches merged, hero/subset reframe, horizontal scenario engine

**Merged.** `origin/main` (fd7cbe6: BUSINESS, PRODUCT_SCOPE, CASE_STUDIES, client mockup)
into `dev`; cherry-picked `toolsused.md` and the user-authored `vision.md` from
`origin/ayush` (that branch shares no git history with dev — a full merge would have
deleted the codebase, so files were adopted instead).

**Reframed (decision 0013, `logs/DECISIONS.jsonl`).** The hero across all docs is the
autonomous emergency-procurement rescue loop; vendor-risk/fraud defense is its built-in
trust subset. Applied to README, PRD, PROJECT_STATUS, STRATEGY-LEDGER (entry 13),
BUSINESS, CASE_STUDIES, PRODUCT_SCOPE, mockup titles. Contradictions with settled
decisions corrected in place: PRODUCT_SCOPE mock-registry mitigation (0003), Fillmore
stretch (0004), toolsused.md LLM-as-decider and Resend-first (0008/0004 — reconciliation
notes added; see also `docs/blueprint-reconciliation.md`, decision 0014).

**Built.** Horizontal scenario-profile engine (`services/verification/src/scenarios.ts`):
`datacenter` (default, DDR5-ECC-64GB + existing vendor pair) and `apparel`
(NAVY-DYE-20L, vendor-pacificdye typosquat vs vendor-meridian) run the identical loop;
`POST /api/demo/scenario` + dashboard toggle (disabled mid-run); scenario block on
`DemoState` (SCHEMA_VERSION unchanged, additive). New `scenarios.test.ts`.

**Verified (this commit).** `npm test` 11/11 pass; `npm run typecheck` exit 0;
`npm run build` exit 0. DEMO.md gained the optional "same loop, any industry" closer;
ROADMAP scenario-engine box ticked.

### 2026-07-17 — Learning Layer, exhaustive docs, advisor audit fixes, single-branch consolidation

**Built.** Learning Layer landed per decision 0015: `incidents` SQLite ledger written on
`complete()`; `DemoState.learning` (count, last resolution, proven vendors); `history()`
drives the loop — later runs emit `recalled_history` instead of the unattested probe and
rank proven vendors first; soft reset preserves the ledger, `POST /api/demo/reset
{"hard":true}` clears it; dashboard learning strip + Proven chips. New tests:
`services/agent/src/learning.test.ts`, `services/control-plane/src/store.test.ts`.

**Documented.** `docs/PRD.md` rewritten as the exhaustive product document (1,194 lines,
19 sections incl. decision index + glossary); new `docs/SYSTEM.md` (1,106 lines) — the
complete technical reference read from the code.

**Advisor audit (docs↔docs + docs↔code lenses) findings fixed:** stale 11/11 test counts
→ 15/15 (PRD); demo-script pointer `PRD §9` → `§14` (CLAUDE.md, STRATEGY-LEDGER);
SYSTEM.md §12 updated from "landing" to "landed", §13 test inventory 7→9 files, reset
endpoint hard-flag documented; `SCENARIO=datacenter` added to `config/example.env`;
**docs/DEMO.md now requires a hard reset before recording** — the learning ledger
otherwise suppresses the prize-critical denial beat on repeat runs.

**Workflow.** Single long-lived branch: `main` only (CLAUDE.md §Branch model,
CONTRIBUTING.md updated); `dev` and `ayush` remote branches deleted after their content
was fully merged/absorbed.

**Verified (this commit).** `npm test` 15/15 pass; `npm run typecheck` clean;
`npm run build` (check + Next production build) green.

### 2026-07-17 — Lane C (Nexla/dashboard/demo): W1 items (C1–C4)

**C1 — verified.** POSTed `config/nexla-stockout.example.json` to `/api/events/stockout`
on the isolated lane-C worktree stack (control `:4400`, procurement `:4401`,
`MONITOR_ENABLED=0`, `AUTH_MODE=development`, `VERIFICATION_MODE=fixture`). Measured result:
`202 {"accepted":true,"eventId":"nexla-event-001"}`; the run drained to `complete` with a
14-phase decision trail; **every decision event carried `correlationId: "nexla-event-001"`**
(= posted `eventId`, `services/agent/src/index.ts:67`); order `PO-45CA6A84`, 20 units
scheduled. Evidence recorded in `docs/integrations/NEXLA.md` (this commit). This is the
local ingress path only — **not** Nexla-integration proof; the live FlexFlow flow (ROADMAP
"prove the event ID end to end") is still open and key-gated.
### 2026-07-17 — A1: Zero evidence adapter service (lane A, `feat/zero-live`)

**Built.** New `services/zero-adapter` workspace (`@continuim/zero-adapter`) — the small
HTTP adapter `services/verification/src/collector.ts` already POSTs to in `live_zero` mode.
`src/transport.ts` defines the `ZeroTransport` seam and `createZeroTransport(env)`, which
returns `null` unless a real Zero session (`ZERO_API_KEY`) is present. `src/adapter.ts`
holds `buildEvidenceResponse` (flattens settled Zero calls into normalized
`EvidenceSignal[]`, reusing one `receiptId`/cost across every signal a paid call backs, and
rejecting a paid call with no receipt) and the pure `handleEvidenceRequest` (bearer check
on `ZERO_EVIDENCE_ADAPTER_TOKEN`, routing `POST /v1/evidence` + `GET /health`);
`src/server.ts` boots it on `ZERO_EVIDENCE_ADAPTER_PORT` (default 4100 — the canonical
`ZERO_EVIDENCE_ADAPTER_URL` already in `config/example.env`). With no Zero session a runtime
request returns **503 "Zero session not configured"** — it never fabricates fixture-shaped
`live_zero` data (STRATEGY-LEDGER decision 0010). The live catalog (exact service
IDs/prices/receipts) is settled later in item A4; `LiveZeroTransport.gather` refuses until
then rather than invent evidence.

**Verified (this commit).** `npm run check` green in worktree A — `tsc --noEmit` clean,
`npm test` 26/26 pass (15 pre-existing + 11 new in
`services/zero-adapter/src/adapter.test.ts`, all using a fake injected Zero transport).
Booted standalone on port 4110: `GET /health` → `{"ok":true,"sessionConfigured":false}`;
unkeyed `POST /v1/evidence` → HTTP 503 `{"error":"Zero session not configured"}` (no
`signals`). Root `package.json` `test` script appended with the new test file (end of list,
per lane-A contract).

**Open.** ROADMAP "Zero evidence adapter with real receipt IDs" (line 19) stays unticked —
real receipts require A4 live settlement against a funded wallet; A1 delivers only the
contract + receipt-reuse plumbing, fake-transport verified. `config/example.env` needs a
`ZERO_API_KEY` line (the Zero session gate) — posted to the board for PM to land.
scheduled. Evidence recorded in `docs/integrations/NEXLA.md`. This is the local ingress path
only — **not** Nexla-integration proof; the live FlexFlow flow (ROADMAP "prove the event ID
end to end") is still open and key-gated.

**C3 — FlexFlow design.** Authored the Nexla FlexFlow design in `docs/integrations/NEXLA.md`:
webhook source → v1.1 attribute transform (with a field-mapping table bound to
`packages/contracts` `StockoutRiskEvent`) → `currentQty <= threshold` filter → authenticated
webhook destination `POST /api/events/stockout` carrying `X-StockShield-Webhook-Secret`.
Design of record only — not yet configured in Nexla (no keys).

### 2026-07-17 — A2 + A3: Zero candidate catalog + downtime citation research (lane A)

**A2 — Zero live catalog re-verified** at `zero.xyz/browse` on 2026-07-17 (CLAUDE.md decision
3). Concrete EvidenceKind → service mapping recorded in `docs/integrations/ZERO.md`
("Candidate Live Services") as **candidates, not verified**; `config/zero-services.json`
`verifiedAt` stays `null`. Key findings: `company_identity_match` → Wiza Company Enrichment
($0.02) or PDL Company Enrich ($0.10); `domain_age_days` → Domain Availability Checker (RDAP,
$0.001) — the required WHOIS/domain-age candidate, but A4 must confirm it returns the
registration date, not just availability; `web_presence` → Firecrawl Scrape ($0.0126);
`news_presence` → Serper Google News ($0.04); `contact_reachable` → StablePhone AI Call
($0.54, A8-gated). **No bank/payee-verification and no typosquat service exist in the
catalog** — `payee_identity_match` is derived from the company-enrichment call (shared
receipt) and `typosquat_detected` is computed locally. All five `REQUIRED_SIGNALS` are
reachable; estimated required-bundle spend ≈ $0.03–0.13/vendor.

**A3 — Downtime-rate citation** (posted to the board as a `note` for W3/A7). Operator-specific
figure: **Ponemon Institute, "2016 Cost of Data Center Outages" — average $8,851 per minute**
(≈885,100 cents/min; max ~$17,244/min), up from $7,908/min (2013) and $5,617/min (2010);
sponsored by Emerson Network Power/Vertiv. Corroboration: Uptime Institute (approaching
$9,000/min; 70% of outages >$100k, 25% >$1M) and ITIC (hourly cost >$300k for 88% of
enterprises, >$1M/hr for 40%). Current placeholder in `services/verification/src/scenarios.ts`
is `downtimeCostCentsPerMinute: 18_000` ($180/min, datacenter) — A7 replaces it with a cited,
honestly-scoped value (whole-facility Ponemon average vs a scoped single-stockout fraction is
a PM/A7 call). Primary source: https://www.ponemon.org/research/ponemon-library/security/2016-cost-of-data-center-outages.html
### 2026-07-17 — Lane B / B3: StableEmail PO-receipt module (EMAIL_MODE=off default)

**Built.** `services/procurement/src/email.ts` — an injectable email transport for
post-201 PO receipts with two disclosed paths selected by `EMAIL_MODE` (default
`off`): `stableemail` (Zero sponsor path; returns `messageId` + `zeroReceiptId`) and
`fallback` (a disclosed **non-Zero** path, `sponsor:"none"`, never claimed as a Zero
tool — decisions 0010/0014). Off-by-default returns a null transport; live modes fail
closed when their URL/recipient env is missing (no silent degrade). Post-201
fire-and-forget hook wired in `services/procurement/src/server.ts` after the response
is written; dedupes by PO id so an idempotent `201` replay does not re-send. No
`packages/contracts` change. New `email.test.ts` (off-default, fail-closed, disclosed
fallback label, exactly-once) appended to the root `test` script.

**Verified (this commit).** `npm run check` green in worktree `.claude/worktrees/B`:
`tsc --noEmit` clean; `node:test` **18/18** pass (15 preexisting unchanged + 3 new).
Live StableEmail send remains B7 (key-gated); this lands the module only.

**Requested (board → PM).** `config/example.env` EMAIL_* lines (PM-owned hotspot) and
a decision on where the StableEmail runbook lives (ZERO.md vs a new EMAIL.md).

### 2026-07-17 — Lane B / B1: final vendor PPL + exact Pomerium Zero runbook

**Documented.** `infra/pomerium/vendor-policy.example.yaml` finalized — corrected the
misleading "replace the user id" comment: the vendor service-account **User ID must be
set to exactly `vendor:vendor-northstar`** so it satisfies both the route policy
(`user.is`) and the origin check `sub == vendor:<vendorId>`
(`services/procurement/src/authorize.ts`). `docs/integrations/POMERIUM.md` expanded into
an exact click-path/CLI runbook: self-hosted data-plane topology (hosted control plane +
proxy in the compose/Akash network via `POMERIUM_ZERO_TOKEN`, reaching `procurement:4001`
directly — **no separate tunnel/connector needed**), service-account steps, route
creation (From/To + Pass Identity Headers / `pass_identity_headers: true`), policy paste,
and a `POMERIUM_*` env-derivation table. Facts verified against pomerium.com docs:
assertion header `X-Pomerium-Jwt-Assertion`, JWKS `/.well-known/pomerium/jwks.json`,
service-account User ID == policy `user.is`, client `Authorization: Bearer Pomerium-<token>`.

**Not yet live.** Cluster/route/service-account creation + PPL application + `403`/`201`
capture are B5/B6 (key-gated, token-serialized); confirm any renamed console labels then.
---

## 2026-07-17 — Rename to Continuim + kedar mockup merge (this commit)

**Decision 0016 (supersede).** The public product is renamed **StockShield → Continuim**
by explicit user direction. Global case-aware rename across 60 tracked files: all docs,
package scope `@stockshield/*` → `@continuim/*` (imports + lockfile + node_modules
symlinks reinstalled), dashboard UI strings, compose/deploy files, and the architecture
SVG. `logs/*.jsonl` history untouched (append-only); ledger entry 16 records the
supersede of the naming in 0006/0013.

**Branch merge.** `origin/kedar/docs-and-mockup` (one commit, mockup redesign) merged
into `main`; the redesign was built on the pre-rename mockup, so its reintroduced
"Vendor Fraud Interceptor" branding, `Fillmore` PO step (violates 0004), and
"Fraud score"/"Fraud blocked" labels (violate 0003/0008/0010) were surgically rebranded
inside kedar's structure: product name → Continuim, Fillmore → StableEmail, fraud
labels → risk/at-risk-spend labels. Kedar's remote branch deleted after merge
(single-branch workflow).

**Verified (this commit).** `npm test` 15/15 pass; `npm run typecheck` clean after
workspace reinstall.

---

## 2026-07-17 — Diagram upgrade + cohesion pass (this commit)

**Diagrams.** `docs/assets/architecture.svg` rebuilt as a three-layer diagram matching
decision 0015 — Hero Runway / Secondary Guardrail / Learning bands, numbered demo beats
(1 stockout → 2 unattested attempt → 3 403 replan → 4 paid evidence → 5–6 verdict +
capability → 7 201), learning feedback arrow labeled "gate still required", and the
scenario + sponsor footer. Render verified via Quick Look rasterization.
`docs/architecture.md` gains two GitHub-rendered mermaid diagrams (three-layer flowchart
+ runtime sequence) alongside the existing text flow.

**Cohesion.** Post-rename sweep: remaining StockShield/ProcureLoop mentions are only
historical records in the ledger, PRD decision log, and this file (intentional). PRD
naming citation corrected to DECISIONS 0016. Mockup title, dashboard metadata, and all
package scopes confirmed Continuim.

**Verified (this commit).** `npm test` 15/15 pass; `npm run typecheck` clean.

### 2026-07-17 — PM: reconciled origin/main (Continuim rename + Continuum frontend) into the wave

**Merged.** `origin/main` (`89d54bf`: decision 0016 rename StockShield→Continuim across
104 files; `Continuum/` Next.js frontend upload; kedar mockup redesign) merged into the
wave's `main` (was `1422abd`). One content conflict (`docs/integrations/NEXLA.md`) —
resolved by keeping the wave's richer C1/C3 content and applying the rename to it, incl.
the webhook header now being `X-Continuim-Webhook-Secret` (`services/control-plane/src/server.ts:100`).
Wave-new files swept `@stockshield` → `@continuim` (`services/zero-adapter/*`,
`services/procurement/src/email.*`). Verified: `npm install` relinked workspaces,
`npm run check` green 29/29 under the new scope. Lanes A–D continue on pre-rename
worktrees; the rename is absorbed at each lane's next merge (lazy rebase per the human's
call). `Continuum/` frontend role: under tab-E investigation before any dashboard decision.
### 2026-07-17 — Agent planner/explainer (D1–D3), on `feat/agent-explainer` (unmerged)

**Built (multi-tab wave, lane D).** Optional LLM planner/explainer behind a port, off by
default, explainer-only per decisions 0008/0014:

- **D1** `services/agent/src/index.ts` — optional `planner?: PlannerPort` on `LoopPorts`
  (no-op when absent). May rank candidates and explain evidence, but the deterministic
  policy ranking is authoritative: control flow always uses the policy order; a
  disagreement is logged via a `planned` decision-event `metadata` (`policyOverride`,
  `plannerRationale`, `plannerPreferredVendorId`, `policySelectedVendorId`); a throwing
  planner degrades to no advice. Output never feeds verify/authorize inputs, never
  adjudicates, never mints capability.
- **D2** `services/control-plane/src/claude.ts` — injectable `ClaudeTransport` with a
  lazy-loaded AWS Bedrock Converse transport (cross-region inference profile
  `us.anthropic.claude-haiku-4-5-20251001-v1:0`; a bare id throws on-demand-throughput on
  Bedrock, decision 0014) and an `ANTHROPIC_API_KEY` fetch fallback. `PLANNER_MODE=off`
  default → no planner; an enabled-but-unconfigured mode fails closed (decision 0010). Adds
  the lane's sole permitted dependency `@aws-sdk/client-bedrock-runtime` (lockfile merges
  alone).
- **D3** `services/control-plane/src/runtime.ts` — wires `createPlannerFromEnv()` into the
  loop ports; inert (undefined) unless `PLANNER_MODE` is set, so the demo path is
  byte-identical to the no-planner run.

**Verified.** `npm run check` green — 22 tests pass (15 pre-existing + 3 planner-port + 4
adapter); typecheck clean. New tests: `services/agent/src/planner.test.ts` (policy-wins-
on-disagreement, disagreement-logged, failure-isolation);
`services/control-plane/src/claude.test.ts` (JSON parse, prose tolerance, off-by-default,
fail-closed).

**Envelope / not done.** Unmerged — D merges nothing until PM declares core proof green
(decision 0012). No live model call yet (D4, keys-gated: needs AWS Bedrock creds or
`ANTHROPIC_API_KEY`). `config/example.env` needs the new keys added by the PM (posted to
the board). The ROADMAP "Add … planner/explainer" box stays open until this branch merges.

### 2026-07-17 — Lane D reconciled onto Continuim + D4 live-call attempt

**Reconciled (0016 rename).** Rebased D1–D3 onto the renamed `@continuim` main and swept my
new files (`planner.test.ts`, `claude.ts` incl. the planner prompt's product name,
`claude.test.ts`) `@stockshield`→`@continuim`. `npm install` clean, `npm run check` green =
**36 tests** (my 22 + A/B tests now consistent under the merged scope), typecheck clean.
Sweep commit `79df383`. Merge still HOLDS until core proof green (0012).

**D4 live-call attempt (PM-authorized, worktree-local, canonical untouched).** Ran ONE live
call through `services/control-plane/src/claude.ts` with `PLANNER_MODE=bedrock` and
`AWS_BEARER_TOKEN_BEDROCK` copied read-only from the main checkout's `.env.local` into the
worktree's gitignored `.env.local` (region `us-east-1` default; inference profile
`us.anthropic.claude-haiku-4-5-20251001-v1:0`).

- **Result: the Bedrock Converse path is wired correctly, but the delivered credential is
  invalid.** The call reached AWS Bedrock (~321 ms) and returned
  `AccessDeniedException: "Missing required parameters in the API Key"` (HTTP 403). The SAME
  403 reproduced via a raw REST call that bypasses the SDK entirely — isolating the failure to
  the credential, not the integration. The token loads as 2039 chars starting with `bedrock-`,
  which is not AWS's `ABSK…` Bedrock API-key format. **Needs a valid AWS Bedrock API key (or
  SigV4 access-key/secret) to complete the live trace.** No fabricated success (0010).
- **`PLANNER_MODE=off` byte-identical confirmed.** `createPlannerFromEnv()` returns `undefined`
  when off, so the loop skips the advisory block entirely — zero extra decision events, same
  stream as the no-planner run; proven by the planner-absent loop/learning tests plus the
  off-by-default and failure-isolation tests (all green).

**Cleanup.** Temp runner deleted; worktree `.env.local` reverted to baseline; the main
checkout's `.env.local` was never modified (read-only copy of the token line only). Canonical
stays `PLANNER_MODE=off`; the explainer goes live on `main` only at the W3 D-merge.

**D4 retry update (2026-07-17, PM-authorized re-run).** A new token was delivered (2184 chars,
still `bedrock-` prefix — so that prefix **is** a valid Bedrock key format; the first token was
simply a bad value) and it now **authenticates**: the earlier 403 "Missing required parameters
in the API Key" is gone. Re-ran through `claude.ts` against
`global.anthropic.claude-sonnet-4-5-20250929-v1:0` in `ap-south-1`; the call reached Bedrock
(~1618 ms) and returned `ResourceNotFoundException: "Model use case details have not been
submitted for this account…"`. **Net: `claude.ts` is proven correct through auth → request →
model-access; the only remaining blocker is AWS-account model-access provisioning (submit the
Anthropic use-case form in the Bedrock console) — a human step, not code.** Flagged for W3:
`claude.ts` reads `AWS_REGION` while the canonical `.env` uses `BEDROCK_REGION` (their
`bedrock.ts` var) — env-name convergence needed at reconcile.
