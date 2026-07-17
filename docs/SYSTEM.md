# Continuim — SYSTEM.md (exhaustive technical companion)

> **What this is:** the complete, code-derived description of the system as built.
> Written 2026-07-17 from the working tree on branch `dev` (last commit `fc46f54`, plus
> uncommitted work in flight — see §12 "Landing now"). Where this document and the code
> disagree, the code wins; where behavior is described, it was read from the source files
> cited, not inferred. Companion docs: `docs/PRD.md` (the plan), `docs/architecture.md`
> (blueprint of record), `docs/STRATEGY-LEDGER.md` (settled decisions).

**One-paragraph summary.** Continuim is a policy-enforced autonomous procurement agent.
An always-on inventory monitor (or a Nexla webhook) detects a stockout risk on a critical
SKU and starts a deterministic procurement loop. The loop picks the cheapest vendor, is
*denied* (403) when it tries to buy without evidence, learns the constraint, buys
independent vendor evidence, runs a deterministic vendor-risk policy, blacklists the
planted lookalike vendor, and receives a signed, single-use, vendor-and-quote-bound
**attestation** for the eligible vendor. Only that capability lets the procurement origin
accept a purchase order. Every step is emitted as a `DecisionEvent` into SQLite and
rendered live on a Next.js operations dashboard.

---

## Table of contents

1. [Repository map](#1-repository-map)
2. [Monorepo mechanics](#2-monorepo-mechanics)
3. [Shared contracts (`@continuim/contracts`)](#3-shared-contracts)
4. [The security package (`@continuim/security`)](#4-the-security-package)
5. [Services in depth](#5-services-in-depth)
6. [End-to-end runtime walkthrough](#6-end-to-end-runtime-walkthrough)
7. [Security mechanics](#7-security-mechanics)
8. [SQLite schema and state lifecycle](#8-sqlite-schema-and-state-lifecycle)
9. [Scenario-profile engine](#9-scenario-profile-engine)
10. [Evidence system](#10-evidence-system)
11. [Environment variables (complete reference)](#11-environment-variables-complete-reference)
12. [Learning Layer — landing now](#12-learning-layer--landing-now)
13. [Test inventory](#13-test-inventory)
14. [Ops: running, shipping, checking, enforcing](#14-ops-running-shipping-checking-enforcing)
15. [Known gaps and pending integrations](#15-known-gaps-and-pending-integrations)

---

## 1. Repository map

Every top-level directory, what lives there, and why it exists.

| Path | What lives there | Why |
|---|---|---|
| `packages/contracts/` | `@continuim/contracts` — the single shared TypeScript type vocabulary (schema v1.1). No runtime logic beyond two constants. | Every service and the dashboard import the same frozen shapes, so wire formats cannot drift between owners. |
| `packages/security/` | `@continuim/security` — attestation signing/verification, encoding, and purchase-binding checks, plus its test. | The capability mechanics are one small, heavily-tested module shared by both the issuer (verification) and the enforcer (procurement). |
| `services/verification/` | Evidence fixtures, the scenario profiles, the deterministic vendor-risk policy, and the evidence-collector seam (fixture vs live Zero adapter). | The "buy evidence, decide eligibility, mint capability" half of the trust loop. |
| `services/agent/` | `runProcurementLoop` — the deterministic agent loop, written against four injected ports, plus its test. | The agent's behavior (deny → learn → verify → buy) is pure logic with no I/O, so it is unit-testable end to end. |
| `services/control-plane/` | The orchestrator HTTP server (port 4000), the SQLite `DemoStore`, the inventory monitor, and the runtime that wires the agent loop's ports to real services. | The single writable source of demo state; everything the dashboard shows comes from here. |
| `services/procurement/` | The protected purchase-order origin (port 4001): authorization (dev-guard or Pomerium assertion + attestation), PO creation, idempotency, nonce replay defense. | The thing being protected. It trusts nothing from the caller except cryptographic proof. |
| `apps/dashboard/` | Next.js 15 / React 19 operations dashboard (port 3000) with a single catch-all API proxy route to the control plane. | The judge-facing UI: inventory, decision trace, vendor evidence status, metrics. |
| `scripts/` | `demo.ts` (scripted node-failure driver), `doctor.ts` (readiness checks, local + prize), `bootstrap.sh` (setup), `githooks/pre-commit`. | Operational entry points and enforcement. |
| `config/` | `example.env` (the canonical env template), `zero-services.json` (live Zero service lock — currently unverified), `nexla-stockout.example.json` (canonical Nexla payload). | Configuration is versioned, secrets are not (`.env` is git-ignored and hook-blocked). |
| `infra/pomerium/` | `vendor-policy.example.yaml` — the route policy body for the Pomerium Zero editor. | The vendor-scoped allow policy is code-reviewable even before the live route exists. |
| `deploy/akash/` | `deploy.example.yaml` — Akash SDL v2.0 template for the three services. | Coverage-only hosting path (STRATEGY-LEDGER decision 5). |
| `docs/` | The governed doc system (see `CLAUDE.md` table): PRD, architecture, ledger, status, current-state, roadmap, lessons, integration runbooks (`docs/integrations/*.md`), business/demo/scope docs, and this file. | Docs are split by what drifts; append-only vs replace-in-place rules per file. |
| `logs/` | `DECISIONS.jsonl` (append-only decision records) and `errors.jsonl` (append-only incident evidence); schemas in `logs/README.md`. | The why-trail the strategy ledger cites. |
| `data/` | `continuim.db` (+ WAL/SHM) — the runtime SQLite database. Git-ignored, Docker-ignored. | Runtime state, not source. |
| `mockups/` | `client-integration.html` — a static mockup. | Design reference only; not served by anything. |
| `starter-pack/` | The `/starter-pack` skill and templates that scaffolded the doc system. | Provenance of the governance layer; not part of the product. |
| `.claude/` | `settings.json`: git read-only Bash permissions + a SessionStart hook that injects `docs/STRATEGY-LEDGER.md` into every Claude session. | Instructions request; the environment enforces. |
| Root files | `package.json` (workspace root + all scripts), `tsconfig.json` (single strict config), `Dockerfile`, `compose.yaml`, `.node-version` (`22.22.0`), `.dockerignore`, `CLAUDE.md`, `vision.md`, `START-HERE.md`, `README.md`, `CONTRIBUTING.md`, `toolsused.md`. | One image, one type-check, one law file. |

---

## 2. Monorepo mechanics

### 2.1 Workspaces

Root `package.json` declares npm workspaces `apps/*`, `packages/*`, `services/*`.
All packages are `"private": true`, `"type": "module"`, version `0.1.0`, and export raw
TypeScript directly (`"exports": "./src/index.ts"`) — there is **no build step for the
libraries**; everything is executed through `tsx` (services/scripts) or transpiled by
Next.js (`transpilePackages: ["@continuim/contracts"]` in
`apps/dashboard/next.config.mjs`). Node `>=22.10` is required (engines field +
`scripts/bootstrap.sh` check); `.node-version` pins `22.22.0`. Node 22 also supplies
`node:sqlite` (used natively — no better-sqlite3 dependency).

### 2.2 Dependency graph

```
@continuim/contracts        (no deps — the vocabulary)
   ▲          ▲         ▲            ▲            ▲          ▲
   │          │         │            │            │          │
@continuim/security   @continuim/agent        │   @continuim/dashboard
   ▲          ▲                      ▲            │   (next, react, react-dom,
   │          │                      │            │    lucide-react)
@continuim/verification            │            │
   ▲   (contracts + security)        │            │
   │                                 │            │
@continuim/control-plane ──────────┴────────────┘
   (agent + contracts + security + verification)

@continuim/procurement  →  contracts + security + jose (JWT/JWKS)
```

Only two external runtime dependencies exist outside the dashboard: `jose` (procurement,
for Pomerium JWT verification) and the Next/React/lucide set (dashboard). Root
devDependencies: `typescript`, `tsx`, `concurrently`, `postcss`, `@types/*`.

### 2.3 Every npm script (root `package.json`)

| Script | What it runs |
|---|---|
| `setup` / `bootstrap` | `sh scripts/bootstrap.sh && npm install` — Node version gate, copy `config/example.env → .env` (kept if present), `mkdir -p data`, `git config core.hooksPath scripts/githooks`. |
| `dev` | `concurrently` runs `dev:control`, `dev:procurement`, `dev:web` (labels control/procurement/web, colors cyan/yellow/green). |
| `dev:control` | `node --env-file-if-exists=.env --watch --import tsx services/control-plane/src/server.ts` |
| `dev:procurement` | Same pattern for `services/procurement/src/server.ts`. |
| `dev:web` | `next dev apps/dashboard --hostname 127.0.0.1 --port 3000` (invoked via `node node_modules/next/dist/bin/next` so `--env-file-if-exists` applies). |
| `dev:evidence` | Watch-mode start for `services/zero-adapter/src/server.ts` on `ZERO_EVIDENCE_ADAPTER_PORT` (default 4100). |
| `test` | `node --import tsx --test` with an **explicit file list** (currently 12 files — see §13). New test files must be added to this list to run in CI/pre-commit. |
| `typecheck` | `tsc --noEmit` over the whole repo (single root `tsconfig.json`: ES2022, NodeNext, `strict`, `allowImportingTsExtensions`, `noEmit`). |
| `check` | `npm run typecheck && npm test` — also what the pre-commit hook runs. |
| `build:web` | `next build apps/dashboard`. |
| `build` | `npm run check && npm run build:web` (also the Docker image build step). |
| `start:control` / `start:procurement` / `start:evidence` | Non-watch tsx starts of the runtime services (Docker/compose/Akash commands). |
| `start:web` | `next start apps/dashboard --hostname 0.0.0.0 --port 3000`. |
| `demo` | `tsx scripts/demo.ts` — scripted three-node-failure demo driver (§14.1). |
| `doctor` | `tsx scripts/doctor.ts` — local readiness checks. |
| `doctor:prize` | Same with `CONTINUIM_REQUIRE_PRIZE=1` — fails closed unless live-sponsor config exists (§14.4). |

All dev/start/demo/doctor scripts use `--env-file-if-exists=.env`, so `.env`
is the single local configuration surface.

---

## 3. Shared contracts

File: `packages/contracts/src/index.ts`. Two exported constants and the full type
vocabulary. **Producers/consumers** listed per type.

### 3.1 Constants

- `SCHEMA_VERSION = "1.1"` — stamped on `StockoutRiskEvent` and `DecisionEvent`; the
  control plane rejects Nexla events with any other value; the dashboard footer displays it.
- `VERIFICATION_POLICY_VERSION = "vendor-risk-v1"` — stamped on every verdict and
  attestation so an attestation is traceable to the policy that issued it.

### 3.2 Vendor and quote types

**`VendorQuote`** — a priced offer, embedded in a candidate.
| Field | Meaning |
|---|---|
| `id` | Quote identifier; the attestation binds to it (`quoteId`), so a capability cannot be reused for a different offer. |
| `sku` | The SKU quoted. The loop filters candidates on `quote.sku === stockout.sku`. |
| `payeeName` | The legal entity to be paid. Mismatch vs the vendor's identity is a **hard policy failure** (the planted fraud tell). |
| `payeeAccountRef` | Opaque payment-account reference; bound into the attestation and checked at the origin (payment-redirection defense). |
| `unitPriceCents` | Integer cents (`Currency` is the literal `"USD"`). |
| `availableQty` | Units the vendor can supply; becomes the attestation's `maxQuantity`. |
| `leadTimeDays` | Display-only in the dashboard vendor list. |

**`VendorCandidate`** — a sourcing candidate: `id`, `legalName`, `tradingName`, `domain`,
optional `phone`, `synthetic: boolean` (all demo vendors are `true` — disclosed synthetic,
asserted by a test), and the embedded `quote`.
*Produced by:* scenario profiles (`services/verification/src/scenarios.ts` /
`fixtures.ts`). *Consumed by:* agent loop (ranking/filtering), evidence collector, policy,
store (part of `DemoState`), dashboard.

### 3.3 `StockoutRiskEvent` — the frozen trigger contract

| Field | Meaning |
|---|---|
| `schemaVersion` | Must be `"1.1"` (validated at the webhook). |
| `type` | Literal `"stockout_risk"`. |
| `eventId` | Unique ID; becomes the `correlationId` of every decision event in the run, and half of every idempotency key. For Nexla proof, the flow's event ID should appear here. |
| `sku` | The at-risk SKU; must map to a scenario profile. |
| `currentQty` / `threshold` | Webhook validation requires safe integers, `currentQty <= threshold`. |
| `requestedQty` | Units to procure (monitor default 20). |
| `occurredAt` | ISO timestamp (parse-validated). |
| `source` | `"nexla" \| "local" \| "monitor"` — honesty label. The webhook accepts **only** `"nexla"`; the monitor emits `"monitor"`; `POST /api/demo/run` emits `"local"`. This is decision 0011: local sources are never presented as Nexla proof. |

*Produced by:* `services/control-plane/src/monitor.ts`, `runtime.ts` (`runDemo`), Nexla
webhook. *Consumed by:* `runStockout`, the agent loop.

### 3.4 Evidence types

**`EvidenceKind`** — the seven evidence classes:
`company_identity_match`, `domain_age_days`, `web_presence`, `news_presence`,
`contact_reachable`, `payee_identity_match`, `typosquat_detected`.

**`EvidenceSource`** — provenance of one signal: `provider` (e.g. `"Continuim fixture"`
or a real Zero provider), `serviceId`, `mode` (`"fixture" | "live_zero"`), `costCents`,
`observedAt`, optional `receiptId` (mandatory for paid live signals — enforced by the
collector, §10.3).

**`EvidenceSignal`** — `{ kind, value: boolean|number|string, outcome:
"pass"|"warn"|"fail", detail, source }`. The policy reads `value` (typed accessors);
`outcome`/`detail` are display/explanation.
*Produced by:* fixtures or the live Zero adapter. *Consumed by:* policy, verdict
(embedded), dashboard (indirectly through reasons).

### 3.5 `VerificationVerdict`

The policy's full decision record: `id` (UUID), `vendorId`, `status`
(`"eligible" | "ineligible" | "insufficient_evidence"` — the three deterministic outcomes
of decision 0008), `riskScore` (0–100, capped), `reasons` (human-readable list),
`signals` (the full evidence), `evidenceMode` (`"fixture"` if *any* signal was fixture,
else `"live_zero"`), `evidenceHash` (SHA-256 binding, §7.1), `totalCostCents`
(receipt-deduplicated paid spend, §10.4), `policyVersion`, `evaluatedAt`, `expiresAt`
(evaluatedAt + 15 minutes).
*Produced by:* `evaluateEvidence`. *Consumed by:* agent loop (status branch, spend
accumulation, mode reporting).

### 3.6 `VendorAttestation` — the capability

The signed, expiring, single-use authorization object. Every field is part of the
canonical signed payload (§7.1):

| Field | Meaning |
|---|---|
| `id` | Attestation ID; the PO request must echo it (`attestationId`). |
| `vendorId`, `vendorDomain` | Which vendor this capability is scoped to. |
| `verified: true` | Literal `true` — an attestation for an unverified vendor cannot exist by construction; also re-checked at verification time. |
| `quoteId`, `sku` | The exact offer authorized. |
| `payeeName`, `payeeAccountRef` | The exact payee authorized — payment cannot be redirected under a valid capability. |
| `evidenceHash` | Hash of the exact evidence that justified issuance. |
| `policyVersion` | `"vendor-risk-v1"`. |
| `unitPriceCents` | Exact authorized unit price (no price drift). |
| `maxQuantity`, `maxAmountCents` | Ceilings: `availableQty` and `unitPrice × availableQty`. |
| `currency` | `"USD"`. |
| `nonce` | Single-use authorization nonce (UUID) — consumed at the origin (§7.3). |
| `issuedAt`, `expiresAt` | Validity window (15 minutes; 30 s future-skew tolerance). |
| `signature` | base64url HMAC-SHA256 over the canonical JSON of everything above. |

*Produced by:* `evaluateEvidence` → `signVendorAttestation` (only on `eligible`).
*Consumed by:* control-plane runtime (credential + header), procurement `authorizePurchase`.

### 3.7 `PurchaseOrderRequest` / `PurchaseOrder`

**`PurchaseOrderRequest`** — the PO body the agent submits: `vendorId`, `vendorDomain`,
`sku`, `quantity`, `quoteId`, `payeeName`, `payeeAccountRef`, `unitPriceCents`,
`currency`, `attestationId`, `evidenceHash`, `authorizationNonce`, `idempotencyKey`
(= `"<stockoutEventId>:<vendorId>"`). On the unattested probe, the three
attestation-derived fields are the literal string `"unattested"`
(`services/agent/src/index.ts`, `makePurchaseRequest`).
*Produced by:* agent loop. *Consumed by:* procurement (shape-validated by
`isPurchaseOrderRequest`, bound by `assertPurchaseBinding`).

**`PurchaseOrder`** — the accepted result: `id` (`PO-XXXXXXXX`), `vendorId`, `sku`,
`quantity`, `totalAmountCents`, `currency`, `status: "accepted"`,
`inboundStatus: "scheduled"` (deliberate honesty: a PO schedules inbound supply, it does
not claim stock arrived), `createdAt`.
*Produced by:* procurement. *Consumed by:* control-plane (`complete`), store, dashboard.

### 3.8 `DecisionPhase` — the state machine, in emission order

```
observed                 stockout event received
planned                  strategy stated (cheapest candidate, adapt autonomously)
recalled_history         (Learning Layer, §12) — ledger recall; probe will be skipped
sourced                  candidate selected/quoted           ┐ per-vendor
authorization_attempted  unattested submit (first vendor only)│
authorization_denied     the live 403 (requestId + enforcement point recorded)
replanned                constraint learned; evidence acquisition begins
verifying                evidence collection started          │
ineligible               policy rejected the candidate        │ (fail branch)
blacklisted              candidate removed from this run      ┘
attested                 capability issued (expiry + evidence-hash prefix in metadata)
ordered                  PO accepted (201) through the stated enforcement point
inbound_scheduled        terminal success — units scheduled inbound
failed                   terminal failure (no eligible vendor / PO error / run crash)
```

The deny path (`authorization_attempted → authorization_denied → replanned`) happens
exactly once per run, on the first candidate, and **before** verification (decision 0009).
Vendors after the first skip straight from `sourced` to `verifying`.

### 3.9 `DecisionEvent`

`{ schemaVersion, id (UUID), correlationId (stockout eventId), phase, vendorId?,
vendorName?, detail, occurredAt, metadata? }` where `metadata` is a flat
`Record<string, string|number|boolean|null>` (e.g. `requestId`, `preventedValueCents`,
`enforcementPoint`, `riskScore`, `evidenceHash` prefix, `totalAmountCents`).
*Produced by:* agent loop via the `DecisionSink` port. *Consumed by:* `DemoStore`
(persisted to `decision_events` and appended to `DemoState.events`), dashboard timeline,
`scripts/demo.ts` console stream.

### 3.10 Authorization/result types

**`ProcurementCredential`** — discriminated union:
`{ kind: "development", attestation }` or
`{ kind: "pomerium", serviceAccountToken, attestation }`. Produced by the control-plane
`resolveCredential`; consumed by `submitPurchaseOrder` (header construction).

**`ProcurementResult`** — `{ status, order?, reason?, enforcementPoint:
"development"|"pomerium"|"origin", requestId }`. `enforcementPoint` semantics: on a 403
it names the authorization mode that denied; on 409s (idempotency-conflict /
nonce-replay) it is `"origin"`; in pomerium mode the control plane reports
`"pomerium"` for the network path. `requestId` on the denial is the auditable pairing key
with Pomerium's authorize log.

### 3.11 State/metrics types

**`IncidentRecord`** (Learning Layer, §12) — one resolved run: `id`, `scenarioId`, `sku`,
`startedAt`, `resolvedAt`, `resolutionMs`, `orderedVendorId | null`,
`blacklistedVendorIds`, `verificationSpendCents`, `poValueCents`,
`atRiskPoValuePreventedCents`, `evidenceMode`.

**`DemoMetrics`** — `atRiskPoValuePreventedCents` (value of the denied unattested PO —
the honest wording locked in decision 0014), `verificationSpendCents`, `inboundQuantity`,
`verificationMode`, `authorizationMode`, `deniedRequestId?`, `deniedEnforcementPoint?`.

**`DemoState`** — the single dashboard-facing aggregate:
`runStatus` (`idle | running | complete | failed`), `scenario` (`id`, `label`,
`industry`, `trigger`), `inventory` (`sku`, `name`, `currentQty`, `threshold`,
`inboundQty`, `critical`, `downtimeCostCentsPerMinute`), `monitor` (`active`,
`watchedSkus`, `lastCheckAt`), `events: DecisionEvent[]`, `vendors`,
`blacklistedVendorIds`, `order?`, `metrics`, `learning` (`incidentCount`,
`lastResolutionMs`, `provenVendorIds` — Learning Layer, §12), `updatedAt`.
*Produced by:* `DemoStore`. *Consumed by:* control-plane endpoints, monitor, dashboard.

---

## 4. The security package

File: `packages/security/src/index.ts` (113 lines, stable). Exports:

- **`UnsignedVendorAttestation`** = `Omit<VendorAttestation, "signature">`.
- **`signVendorAttestation(unsigned, secret)`** — throws on empty secret; returns the
  attestation with `signature = base64url(HMAC-SHA256(secret, canonicalJSON))`.
- **`verifyVendorAttestation(attestation, secret, now?)`** — recomputes the HMAC over the
  canonical form, compares with a length check + `crypto.timingSafeEqual`, then checks
  `verified === true`, `expiresAt > now`, and `issuedAt <= now + 30s` (future-issue
  guard). Throws typed-message errors on any failure.
- **`encodeVendorAttestation` / `decodeVendorAttestation`** — base64url(JSON) transport
  codec for the `x-continuim-vendor-attestation` header; decode failures throw
  `"Malformed vendor attestation"`.
- **`assertPurchaseBinding(attestation, request)`** — the object-capability check; every
  binding it enforces is listed in §7.2.

Canonicalization (`canonicalAttestation`, lines 9–29) serializes the 17 non-signature
fields in a **fixed literal key order**, so signer and verifier always hash identical
bytes — no dependence on object key insertion order anywhere upstream.

---

## 5. Services in depth

### 5.1 `services/verification` — evidence, policy, scenarios

**Purpose:** turn a `VendorCandidate` into evidence, a deterministic verdict, and (only
when eligible) a signed capability. No HTTP server of its own — it is a library the
control plane composes.

Files and exports (barrel: `src/index.ts` re-exports everything below):

- **`src/fixtures.ts`** — `DEMO_VENDORS` (the two datacenter vendors, §9) and
  `fixtureEvidence(vendor)`: returns all seven signal kinds with `mode: "fixture"`,
  `costCents: 0`. For the planted bad vendors (`vendor-lookalike`, `vendor-pacificdye`)
  every identity signal fails: no company match, 14-day-old domain, no web footprint, no
  news (warn), unreachable phone, **payee mismatch**, **typosquat detected**. For good
  vendors everything passes (domain age 2200 days for `vendor-meridian`, 1840 otherwise).
- **`src/scenarios.ts`** — `ScenarioProfile` interface and the `SCENARIOS` record (§9).
- **`src/policy.ts`** — `evaluateEvidence(vendor, signals, signingSecret, now?)` →
  `VerificationResult { verdict, attestation? }`. Scoring (all deterministic):
  - Required classes (`REQUIRED_SIGNALS`): `company_identity_match`, `domain_age_days`,
    `web_presence`, `payee_identity_match`, `typosquat_detected`. Any missing →
    `insufficient_evidence` (never `eligible` by omission).
  - Risk weights: company mismatch +35; domain < 30 days +30 (30–89 days +15); no web
    presence +20; contact unreachable +20; **payee mismatch +100 (hard failure)**;
    **typosquat +100 (hard failure)**; score capped at 100.
  - `ineligible` if: hard failure, OR compound failure (domain < 30 days AND no web
    presence), OR `riskScore >= 60`. Otherwise `eligible`.
  - Builds `evidenceHash` (§7.1), sets verdict/attestation expiry to now + 15 minutes,
    computes receipt-deduplicated `totalCostCents` (§10.4), and on `eligible` mints and
    signs the attestation (nonce = fresh UUID, ceilings from the quote).
- **`src/collector.ts`** — the fixture/live seam (§10.2–10.3): `EvidenceCollector`
  interface, `createEvidenceCollector(env?)`, and the private
  `HttpZeroEvidenceCollector`.

**Trust boundary:** holds the attestation **signing** secret path (the secret itself is
passed in by the control plane). The evidence adapter (live mode) is semi-trusted: its
responses are shape-validated, vendor-matched, mode-checked, and receipt-enforced.

### 5.2 `services/agent` — the deterministic procurement loop

**Purpose:** the agent's decision logic, pure and I/O-free. One file, `src/index.ts`.

Exports:

- Port interfaces — `VerificationPort` (`verify(vendor)` → verdict + optional
  attestation), `ProcurementPort` (`submit(request, credential?)` → `ProcurementResult`),
  `CredentialPort` (`forAttestation(attestation)` → `ProcurementCredential`),
  `DecisionSink` (`emit(event)`), bundled as `LoopPorts`.
- **`LoopHistory`** — `{ provenVendorIds, knowsAuthorizationRequired }` (Learning Layer
  input, §12).
- **`LoopResult`** — `{ orderedVendorId?, blacklistedVendorIds,
  atRiskPoValuePreventedCents, verificationSpendCents, verificationMode,
  deniedRequestId?, deniedEnforcementPoint? }`.
- **`runProcurementLoop(stockout, candidates, ports, stepDelayMs = 0, history?)`** — the
  algorithm, exactly:
  1. Emit `observed`, then `planned`. If `history.knowsAuthorizationRequired`, emit
     `recalled_history` and skip the probe for the whole run.
  2. Filter candidates to `quote.sku === stockout.sku && availableQty >= requestedQty`;
     sort ascending by unit price; then stably move vendors in
     `history.provenVendorIds` to the front (proven-vendor preference, §12).
  3. For each vendor: emit `sourced` (noting a proven-vendor prioritization when it
     applies). If authorization is not yet learned: emit `authorization_attempted`,
     submit **without a credential**, and **require** a 403 — any other status throws
     (`"Unattested purchase must be denied"`), failing the run rather than faking a
     denial. Record `deniedRequestId`/`deniedEnforcementPoint`, add
     `unitPrice × requestedQty` to `atRiskPoValuePreventedCents`, emit
     `authorization_denied` (metadata: enforcementPoint, preventedValueCents, requestId)
     and `replanned`.
  4. Emit `verifying`; call the verification port; add `verdict.totalCostCents` to spend;
     if any verdict is `live_zero` the reported mode upgrades to `live_zero`.
  5. Not eligible (or no attestation): emit `ineligible` (reasons joined; metadata
     riskScore + evidenceMode) and `blacklisted`; continue to the next vendor.
  6. Eligible: emit `attested`, obtain a credential, build the bound request, submit.
     Non-201: emit `failed` for this vendor, continue. 201: emit `ordered` and
     `inbound_scheduled`, return the `LoopResult`.
  7. Loop exhausted: emit terminal `failed` ("No eligible vendor…").

  `stepDelayMs` sleeps after each emit (demo pacing; control plane passes
  `DEMO_STEP_DELAY_MS`, default 350 ms).
- `makePurchaseRequest` (private): builds the `PurchaseOrderRequest`; unattested probes
  carry `"unattested"` sentinels; `idempotencyKey = "<eventId>:<vendorId>"`.

**Note:** despite the project stack listing the Claude Agent SDK, this loop is currently
fully deterministic — no LLM call exists anywhere in the repo. The LLM
(Bedrock-backed planner/explainer per decision 0014) is a pending port, and per decision
0008 it may explain but never adjudicate.

### 5.3 `services/control-plane` — orchestrator, state, monitor (port 4000)

**Purpose:** owns SQLite state, runs the monitor, wires the agent loop's ports to the
real verification library and the real procurement HTTP API, and serves the dashboard's
API.

**`src/server.ts`** — plain `node:http` server. Boot: `CONTROL_PLANE_HOST`
(default `127.0.0.1`) / `CONTROL_PLANE_PORT` (default `4000`); constructs the singleton
`DemoStore`; unless `MONITOR_ENABLED=0`, starts the inventory monitor
(`MONITOR_INTERVAL_MS` default 2000, `MONITOR_REQUESTED_QTY` default 20). CORS is wide
open (`access-control-allow-origin: *`; allowed headers include
`x-continuim-webhook-secret`). All request bodies are capped at 64 KiB. Endpoints:

| Method & path | Request | Responses |
|---|---|---|
| `OPTIONS *` | — | 204 (CORS preflight). |
| `GET /health` | — | 200 `{ ok, verificationMode, authorizationMode, monitorEnabled }`. |
| `GET /api/state` | — | 200 — the full `DemoState` JSON. |
| `POST /api/demo/reset` | optional JSON `{ "hard": true }` | 200 — fresh idle `DemoState` (same scenario kept; decision events wiped). Soft (default) **preserves** the incident ledger/learning; `hard: true` clears it too. |
| `POST /api/demo/scenario` | `{ "id": "datacenter" \| "apparel" }` | 200 new state; 400 unknown id / bad JSON; 409 if a run is active. |
| `POST /api/demo/run` | — | 202 `{ accepted: true }` (run fires async, `source: "local"`); 409 if already running. |
| `POST /api/demo/consume` | — | 200 state with one unit consumed; 409 if running or `currentQty <= 0`. |
| `POST /api/events/stockout` | `StockoutRiskEvent` JSON; header `x-continuim-webhook-secret` when `NEXLA_WEBHOOK_SECRET` is set | 202 `{ accepted, eventId }`; 401 bad secret; 400 invalid event / non-`nexla` source / unknown SKU; 409 run active. Auto-switches scenario when the SKU maps to the other profile. |
| anything else | — | 404 `{ error: "Not found" }`. |

`isStockoutRiskEvent` (server.ts) validates schema version, type, non-empty ids/skus,
safe-integer quantities, `currentQty <= threshold`, `requestedQty > 0`, parseable
timestamp, and source membership.

**`src/store.ts`** — `DemoStore` (SQLite; full schema and lifecycle in §8).

**`src/monitor.ts`** — exports `InventoryMonitorStore` (the minimal store view),
`InventoryMonitorOptions`, `StockoutRunner`, and:
- `checkInventoryOnce(store, runStockout, requestedQty = 20)` — marks
  `monitor.lastCheckAt`, then triggers iff **all** hold: monitor active, item critical,
  `currentQty <= threshold`, `inboundQty === 0`, `runStatus === "idle"`. On trigger it
  builds a Nexla-shape-identical `StockoutRiskEvent` with `source: "monitor"` and awaits
  the runner. Returns whether it fired.
- `startInventoryMonitor(store, runStockout, options)` — marks the monitor active, runs a
  guarded `setInterval` (a `tickRunning` flag prevents overlapping ticks; the timer is
  `unref()`ed so it never holds the process open) and returns a stop function that clears
  the timer and marks the monitor inactive.

**`src/runtime.ts`** — the wiring:
- `runDemo(store)` — synthesizes a `source: "local"` stockout (`currentQty: 0`,
  `requestedQty: 20`) for the current scenario SKU and delegates to `runStockout`.
- `runStockout(store, stockout)` — `store.start(...)` (marks running; re-syncs scenario by
  SKU), builds the evidence collector once, then calls `runProcurementLoop` with real
  ports: verification = collector + `evaluateEvidence` with
  `ATTESTATION_SIGNING_SECRET` (default `local-attestation-only-change-me`); credentials =
  `resolveCredential`; procurement = `submitPurchaseOrder` (capturing the accepted
  order); decisions = `store.appendEvent`. On success `store.complete({...result,
  order})`; on throw `store.fail()` and rethrow.
- `resolveCredential(attestation)` — dev mode: `{ kind: "development", attestation }`.
  Pomerium mode (`AUTH_MODE=pomerium`): looks up
  `POMERIUM_VENDOR_TOKEN_<VENDOR_ID_UPPER_SNAKE>` (e.g.
  `POMERIUM_VENDOR_TOKEN_VENDOR_NORTHSTAR`) and throws if missing — vendor-scoped
  machine identity per decision 0007.
- `submitPurchaseOrder(request, credential?)` — base URL: `POMERIUM_ROUTE_URL` in
  pomerium mode, else `PROCUREMENT_URL` (default `http://127.0.0.1:4001`). Headers:
  attestation always rides in `x-continuim-vendor-attestation` (base64url) when a
  credential exists; pomerium credentials add
  `authorization: Bearer Pomerium-<vendorToken>`; the **credential-less denial probe in
  pomerium mode** authenticates as the general agent via `POMERIUM_AGENT_TOKEN` (so the
  403 is a *policy* denial of an authenticated identity, not a missing-auth artifact).
  POSTs to `<base>/po/<vendorId>`; result's `enforcementPoint` is forced to
  `"pomerium"` in pomerium mode (the network path is the enforcer); `requestId` comes
  from `x-request-id` / `x-continuim-request-id` / body / fresh UUID, in that order.

**Trust boundary:** the control plane is the trusted orchestrator — it holds the signing
secret and the vendor tokens. Its HTTP surface is demo-control only (no auth besides the
optional Nexla webhook secret); in deployment it is expected to sit behind the dashboard
proxy / private network (compose exposes it on 4000; Akash template keeps it non-global).

### 5.4 `services/procurement` — the protected origin (port 4001)

**Purpose:** the resource being protected. Accepts a PO **only** with a valid, bound,
unexpired, unconsumed capability — and in pomerium mode, only behind a verified Pomerium
identity assertion.

**`src/server.ts`** — `node:http`; `PROCUREMENT_HOST` (default `127.0.0.1`) /
`PROCUREMENT_PORT` (default `4001`); builds one `AuthorizationConfig` at boot from
`AUTH_MODE`, `ATTESTATION_SIGNING_SECRET`, and the `POMERIUM_*` variables. Endpoints:

| Method & path | Behavior |
|---|---|
| `GET /health` | 200 `{ ok: true, authMode }`. |
| `POST /po/:vendorId` | Parse (≤ 64 KiB) → `isPurchaseOrderRequest` shape check **and** `body.vendorId === decodeURIComponent(:vendorId)` (path/body agreement — the path is what a Pomerium policy scopes on) else 400 → `createPurchaseOrder` → respond with its status and JSON body; `x-continuim-request-id` response header always set. Body-level errors → 400. |
| anything else | 404. |

**`src/authorize.ts`** — exports `AuthMode`, `AuthorizationConfig`,
`AuthorizationResult`, `authorizePurchase(headers, request, config)`:
1. Requires `attestationSecret`.
2. In pomerium mode, first verifies the **network identity**: `verifyPomeriumIdentity`
   reads `x-pomerium-jwt-assertion`, requires complete config
   (`pomeriumJwksUrl`/`Issuer`/`Audience`), verifies the JWT via `jose`'s
   `createRemoteJWKSet` + `jwtVerify` (signature, issuer, audience, expiry), requires a
   subject, and requires `sub === "<subjectPrefix><vendorId>"` (prefix default
   `"vendor:"`) — the proxy-authenticated identity must match the vendor path being
   bought from.
3. In both modes, verifies the **object capability**: decode the
   `x-continuim-vendor-attestation` header, `verifyVendorAttestation` (HMAC +
   temporal), `assertPurchaseBinding` (all 13 bindings, §7.2).
4. Returns `{ subject, enforcementPoint: mode, attestationId, nonce }`.

**`src/index.ts`** — exports `createPurchaseOrder`, `isPurchaseOrderRequest`,
`resetProcurementStateForTests`. `createPurchaseOrder` order of operations (the order is
load-bearing and test-asserted):
1. **Authorize first** — any failure returns 403 with the error message as `reason` and
   `enforcementPoint = config.mode`. (An unauthorized replay of a previously-successful
   idempotency key is therefore 403, not a leaked 201.)
2. Idempotency: `requestHash = sha256(JSON.stringify(request))`; if the
   `idempotencyKey` is known — same hash → replay the stored order as 201; different
   hash → 409 `"Idempotency key was already used for a different request"`
   (`enforcementPoint: "origin"`).
3. Nonce replay: if the attestation nonce was consumed by a *different* idempotency key →
   409 `"Authorization nonce has already been consumed"` — one attestation authorizes at
   most one distinct order.
4. Create the `PurchaseOrder`, store it under the idempotency key, record the nonce, and
   return 201.

State (`orders`, `consumedNonces`) is **in-memory** (module-level `Map`s) — it resets on
process restart; SQLite replay protection at the origin is not implemented (the SQLite
decision trail lives in the control plane).

**Trust boundary:** the origin trusts only (a) the shared HMAC secret and (b) the
Pomerium JWKS. It never trusts `vendorId` from the body alone, never trusts an unsigned
header, and never skips binding checks in either mode. In prize mode, port 4001 must not
be published — Pomerium must be the only route (see `docs/integrations/POMERIUM.md`).

### 5.5 `apps/dashboard` — operations UI (port 3000)

Files: `app/layout.tsx` (metadata + global `styles.css`), `app/page.tsx` (renders the
single component), `app/styles.css`, `components/operations-dashboard.tsx`,
`app/api/control/[...path]/route.ts`, `next.config.mjs`, `public/product.png`.

**`app/api/control/[...path]/route.ts`** — the only server-side code: a catch-all proxy
exporting `GET` and `POST`. It forwards `/api/control/*` to
`CONTROL_PLANE_INTERNAL_URL` (default `http://127.0.0.1:4000`), preserving the query
string, forwarding the body for non-GET/HEAD, forcing `cache: "no-store"`, and passing
through status + content-type. The browser therefore never needs direct network reach to
the control plane (this is what makes the compose/Akash topologies work).

**`components/operations-dashboard.tsx`** — a client component that polls
`GET /api/control/api/state` every **400 ms** and renders:
- Top bar: scenario `<select>` (POST `/api/demo/scenario`, disabled while running), an
  evidence-mode badge ("Fixture evidence" vs "Live Zero"), reset button
  (POST `/api/demo/reset`), and the incident button (POST `/api/demo/consume`) labeled
  "Simulate node failure" / "Consume dye stock" per scenario. **There is no "run"
  button** — the monitor starts the loop autonomously (decision 0011).
- Monitor strip: active state, watched SKU count, seconds since last check, scenario
  trigger text.
- Metric band: outage exposure (illustrative `$ /min` when at risk) / recovery state,
  **at-risk PO value prevented**, verification spend (with "No live charge in dev" vs
  "Settled through Zero"), and authorization state ("Pomerium denied" / "Local guard
  denied" / "Awaiting attempt" + denied request-ID prefix).
- Inventory panel (on hand / reorder point / inbound + an honesty note that a PO
  schedules supply, it does not claim arrival), the reverse-chronological decision-trace
  timeline (phase icons for the six visually-distinct phases), and the vendor panel
  (quotes, lead times, Ineligible/PO-accepted/Pending status, and a "control proof" note
  that explicitly states the local guard is **not** evidence of a live Pomerium denial).
- Footer: schema version, "SQLite decision trail", last update time.

Connection failures show a retry banner; the poll keeps running.

---

## 6. End-to-end runtime walkthrough

The default local path (fixture evidence, development guard, datacenter scenario),
exactly as the code executes it:

1. **Boot.** `npm run dev` starts the three processes. The control plane opens/creates
   `data/continuim.db`, seeds an idle `DemoState` for the `datacenter` profile
   (5 spares on hand, threshold 2), and starts the 2-second monitor.
2. **Failure injection.** The operator (or `npm run demo`) POSTs `/api/demo/consume`
   three times: 5 → 4 → 3 → 2 on-hand. (Alternatively, Nexla POSTs the frozen v1.1 event
   to `/api/events/stockout`, or `/api/demo/run` fires a `local` event directly.)
3. **Monitor tick.** Within ≤ 2 s, `checkInventoryOnce` observes
   `currentQty (2) <= threshold (2)`, `inboundQty 0`, `runStatus idle`, monitor active,
   item critical → emits a `StockoutRiskEvent` (`source: "monitor"`, `requestedQty: 20`,
   fresh `eventId`) and awaits `runStockout`.
4. **Run start.** `store.start(2, "DDR5-ECC-64GB")` sets `runStatus: "running"`. The
   loop begins; every emitted event is persisted to `decision_events` + `DemoState.events`
   and appears on the dashboard within one 400 ms poll. With `DEMO_STEP_DELAY_MS=350`
   each phase is visibly paced.
5. **Events 1–2:** `observed` ("Stockout risk received for DDR5-ECC-64GB", metadata
   source/requestedQty) and `planned` (strategy statement).
6. **Ranking.** Both vendors quote the SKU with `availableQty 20 >= 20`. Price sort puts
   the planted lookalike first ($120.00 < $127.50).
7. **Event 3:** `sourced` — "Candidate quoted 120.00 USD per unit" (Northstar
   Distribution, the lookalike).
8. **Events 4–6 — the live denial.** `authorization_attempted` → the loop submits the PO
   **without any credential**: no attestation header reaches
   `POST /po/vendor-lookalike`; `authorizePurchase` throws "Missing signed vendor
   attestation"; the origin returns **403** with a request ID. The loop asserts the 403
   (any other status crashes the run — the denial is never faked), records
   `deniedRequestId`, adds 20 × $120.00 = **$2,400.00** to
   `atRiskPoValuePreventedCents`, and emits `authorization_denied` (metadata:
   `enforcementPoint`, `preventedValueCents: 240000`, `requestId`) then `replanned`.
9. **Events 7–9 — evidence kills the lookalike.** `verifying` → fixture evidence returns
   all-failing signals → policy: payee mismatch (+100, hard) and typosquat (+100, hard),
   riskScore capped at 100 → `ineligible` (reasons joined into the detail; metadata
   riskScore 100, evidenceMode fixture) → `blacklisted`.
10. **Event 10:** `sourced` for Northstar Supply ($127.50). The probe is skipped —
    the constraint is already learned this run.
11. **Events 11–12:** `verifying` → all-passing fixture evidence → `eligible`, riskScore
    0 → a signed attestation is minted (nonce, 15-minute expiry, ceilings 20 units /
    $2,550.00) → `attested` (metadata: 12-char evidence-hash prefix).
12. **The authorized PO.** Dev credential wraps the attestation; the request rides with
    the base64url attestation header to `POST /po/vendor-northstar`. The origin verifies
    the HMAC signature (timing-safe), temporal validity, and all 13 bindings; checks
    idempotency (`"<eventId>:vendor-northstar"` is new) and the nonce (unconsumed);
    creates `PO-XXXXXXXX` for 20 × $127.50 = $2,550.00, `status: "accepted"`,
    `inboundStatus: "scheduled"`; returns **201**.
13. **Events 13–14:** `ordered` ("PO PO-… accepted through development", metadata
    totalAmountCents 255000) and `inbound_scheduled` ("20 units scheduled inbound;
    on-hand inventory is unchanged").
14. **Completion.** `store.complete(...)` sets `runStatus: "complete"`,
    `inventory.inboundQty: 20`, blacklist `["vendor-lookalike"]`, the order, and metrics
    (prevented $2,400.00; verification spend $0.00 in fixture mode; denial request ID
    and enforcement point). The dashboard flips the lookalike to "Ineligible", Northstar
    to "PO accepted", and inbound to 20. Because `inboundQty > 0`, the monitor will not
    re-fire.

**Failure paths:** if no vendor survives, the terminal event is `failed` and
`store.complete` (no order) sets `runStatus: "failed"`. If the loop throws (e.g. the
unattested probe was *not* denied, or the live adapter errored), `store.fail()` marks the
run failed and the error is logged by the server's `.catch`.

**Pomerium-mode differences (config-gated, not yet live-proven):** the denial probe is an
*authenticated* general-agent request (`POMERIUM_AGENT_TOKEN`) through
`POMERIUM_ROUTE_URL` that the route policy denies (403 from the proxy, origin never
reached); the allow path uses the vendor-scoped service-account token; the origin
additionally verifies the `x-pomerium-jwt-assertion` JWT and its
`sub == vendor:<vendorId>` before any attestation logic; reported
`enforcementPoint: "pomerium"`.

---

## 7. Security mechanics

### 7.1 Canonical-JSON HMAC signing, and the evidence hash

- **Attestation signature** = base64url(HMAC-SHA256(secret, canonical JSON)) where the
  canonical form lists all 17 payload fields in fixed key order
  (`packages/security/src/index.ts`). Both issuer (verification policy) and enforcer
  (procurement origin) must be configured with the same `ATTESTATION_SIGNING_SECRET`.
  Signing with an empty secret throws.
- **Evidence hash** = hex SHA-256 of
  `JSON.stringify({ vendorId, vendorDomain, quoteId, signals })`
  (`services/verification/src/policy.ts`). It appears in the verdict, is embedded in the
  signed attestation, must be echoed in the PO request, and its 12-char prefix is shown
  in the `attested` event — a tamper-evident link from "the evidence we bought" to "the
  purchase we authorized".

### 7.2 Every binding checked before a PO is accepted

`verifyVendorAttestation` (temporal + integrity): valid HMAC (length check +
`timingSafeEqual`), `verified === true`, not expired, not issued more than 30 s in the
future.

`assertPurchaseBinding` (attestation ↔ request), in order: total amount is a safe
integer; `vendorId`; `vendorDomain`; `attestation.id === request.attestationId`;
`quoteId`; `sku`; `payeeName`; `payeeAccountRef`; `evidenceHash`;
`nonce === authorizationNonce`; `currency`; exact `unitPriceCents`;
`quantity <= maxQuantity`; `unitPrice × quantity <= maxAmountCents`.

Plus, at the server edge: request-shape validation and `body.vendorId ===` the `/po/:vendorId`
path segment.

Consequence: a stolen valid attestation cannot change the payee, the account, the price,
the quote, the SKU, the vendor, or the amount — and can be spent at most once.

### 7.3 Nonce, idempotency, and replay defense (origin)

Three distinct mechanisms in `services/procurement/src/index.ts`:
1. **Authorization precedes everything** — replaying a known idempotency key without a
   valid attestation yields 403, never a replayed 201.
2. **Idempotency** — same key + byte-identical request (SHA-256 of the JSON) → the same
   201/order (safe network retry); same key + different request → 409.
3. **Nonce consumption** — the attestation's nonce maps to the idempotency key that
   consumed it; any *different* order attempting to reuse the nonce → 409. Since the
   verifier mints a fresh nonce per attestation and each attestation binds one quote,
   one capability ⇒ at most one distinct purchase.

Caveat (known gap): both maps are in-process memory — an origin restart forgets consumed
nonces. Attestation expiry (15 min) bounds the window.

### 7.4 Pomerium JWT assertion verification

`verifyPomeriumIdentity` (`services/procurement/src/authorize.ts`): requires the
`x-pomerium-jwt-assertion` header (set by Pomerium's "Pass Identity Headers"), fetches
keys from `POMERIUM_JWKS_URL` via `jose.createRemoteJWKSet`, and `jwtVerify`s with
pinned `issuer` and `audience`. It then requires `payload.sub` and
`sub === POMERIUM_SUBJECT_PREFIX + request.vendorId`. Missing config in pomerium mode is
a hard error ("Incomplete Pomerium verification configuration") — no silent fallback to
dev behavior (decision 0010).

### 7.5 What dev mode proves vs what only Pomerium proves

- **Development guard proves:** object-capability correctness — signed attestation
  required, full binding, expiry, single-use nonce, idempotency. The dashboard says so
  explicitly: *"This mode proves object binding locally, but it is not evidence of a
  live Pomerium denial."*
- **Only live Pomerium proves:** a *network-boundary* denial by an identity-aware proxy —
  an authenticated-but-unauthorized machine identity stopped **before the origin**, with
  an `allow:false` authorize-log entry pairable to the request ID, and vendor-scoped
  service accounts that can only reach their own `/po/<vendorId>` path
  (`infra/pomerium/vendor-policy.example.yaml` pins user, POST, and exact path).
  Decision 0007: an application 403 is never presented as proxy proof.

### 7.6 Other defensive details

- 64 KiB body caps on both HTTP services; JSON parse failures → 400.
- Nexla webhook: optional shared secret header, source must be `"nexla"`, schema v1.1
  enforced, concurrent-run 409.
- Monitor safety: single-flight ticks, `unref()`ed timer, and the four-condition trigger
  gate prevent re-entry and re-fire after an order is inbound.
- Pre-commit hook blocks staged `.env*` files and credential-looking diffs (§14.5).

---

## 8. SQLite schema and state lifecycle

`services/control-plane/src/store.ts`; database path `SQLITE_PATH` (default
`data/continuim.db`, `:memory:` supported); `PRAGMA journal_mode = WAL`. The control
plane is the only writer. Three tables:

| Table | Columns | Purpose |
|---|---|---|
| `demo_state` | `id INTEGER PRIMARY KEY CHECK (id = 1)`, `payload TEXT NOT NULL` | Exactly one row: the whole `DemoState` as JSON, upserted on every mutation. |
| `decision_events` | `id TEXT PRIMARY KEY`, `correlation_id TEXT NOT NULL`, `phase TEXT NOT NULL`, `payload TEXT NOT NULL` (full event JSON), `occurred_at TEXT NOT NULL` | Append-only within a run; queryable audit trail keyed by the stockout event ID. |
| `incidents` | `id TEXT PRIMARY KEY`, `scenario_id TEXT NOT NULL`, `sku TEXT NOT NULL`, `resolution_ms INTEGER NOT NULL`, `ordered_vendor_id TEXT` (nullable), `payload TEXT NOT NULL` (full `IncidentRecord` JSON), `resolved_at TEXT NOT NULL` | The Learning Layer's append-only incident ledger (§12). **Not** deleted by `reset()` — learning survives demo resets. |

Lifecycle methods:

- **Constructor** — opens/creates the DB, creates tables, and self-heals: if the stored
  state is missing or predates the current shape (no `monitor`/`scenario`), it resets.
- **`reset(scenarioId?)`** — wipes `decision_events`, then writes a fresh idle state for
  the requested scenario (falling back to the currently-stored scenario, then to the
  `SCENARIO` env default, then `datacenter`): seed inventory from the profile, empty
  events/blacklist, zeroed metrics, `authorizationMode` from `AUTH_MODE`, monitor active
  unless `MONITOR_ENABLED=0`.
- **`start(currentQty, sku?)`** — if the SKU belongs to a different scenario, resets into
  that scenario first (throws for an unknown SKU); sets `runStatus: "running"` and the
  event's `currentQty`.
- **`consumeUnit()`** — decrements on-hand (floor 0).
- **`setMonitorActive(bool)` / `markMonitorCheck(at?)`** — monitor bookkeeping.
- **`appendEvent(event)`** — inserts the `decision_events` row and appends to
  `DemoState.events` in the same call.
- **`complete(input)`** — `runStatus` becomes `"complete"` if an order exists else
  `"failed"`; sets blacklist, order, `inventory.inboundQty`, and all metrics
  (prevented value, spend, mode, inbound quantity, denial id/point).
- **`fail()`** — `runStatus: "failed"` (crash path).
- Private `update`/`write` — read-modify-write of the single JSON row with a fresh
  `updatedAt`.

**What persists where:** demo state and the decision trail persist across process
restarts (SQLite); decision events are cleared on `reset`; the incident ledger persists
across both; procurement's orders/nonces do **not** persist (in-memory, §5.4). In Docker
compose, the `continuim-data` volume is mounted only on the control-plane service —
the procurement container's `SQLITE_PATH` env is inert since procurement never opens
SQLite.

---

## 9. Scenario-profile engine

Decision 0013: the loop is horizontal; two locked profiles run through the identical
engine behind one dashboard toggle. `services/verification/src/scenarios.ts` defines
`ScenarioProfile` (`id`, `label`, `industry`, `trigger`, `item {sku, displayName,
currentQty, threshold, critical: true, downtimeCostCentsPerMinute}`, `vendors`) and the
`SCENARIOS` record:

**`datacenter` — "On-prem compute spares" (Regulated datacenter; "Node failure drains
the critical spares pool").** Item `DDR5-ECC-64GB`, "64 GB DDR5 ECC Memory Module",
qty 5 / threshold 2, downtime $180.00/min (illustrative). Vendors (= `DEMO_VENDORS` from
`fixtures.ts`):
- `vendor-lookalike` — legal "Northstar Distributi0n LLC" (zero-for-o), trading
  "Northstar Distribution", `northstar-distribution.example`; quote `quote-lookalike-1`
  at **$120.00** × 20 available, 1-day lead, payee **"Northstar Holdings
  International"** (≠ legal entity), account `demo-payee-lookalike`. The planted trap:
  cheapest price, payee mismatch + typosquat + 14-day domain + no footprint.
- `vendor-northstar` — "Northstar Supply Cooperative" / `northstar-supply.example`;
  quote `quote-northstar-1` at **$127.50** × 20, 2-day lead, payee matches the legal
  entity, account `demo-payee-northstar`. Fixture domain age 1840 days.

**`apparel` — "Sock line dye supply" (Apparel manufacturing; "Supplier shipment delay
drains the navy dye reserve").** Item `NAVY-DYE-20L`, "Navy textile dye (20L drum)",
qty 5 / threshold 2, downtime $50.00/min. Vendors:
- `vendor-pacificdye` — "Pacific Dye C0. Inc" (zero-for-o), `pacificdye-co.example`;
  `quote-pacificdye-1` at **$900.00** × 20, 1-day lead, payee **"Cascadia Trade Holdings
  Ltd"** (mismatch), account `demo-payee-pacificdye`. Fails the same all-signal fixture
  branch as the lookalike.
- `vendor-meridian` — "Meridian Colorants Ltd", `meridian-colorants.example`;
  `quote-meridian-1` at **$965.00** × 20, 2-day lead, matching payee, account
  `demo-payee-meridian`. Fixture domain age 2200 days.

All vendors are `synthetic: true` (disclosed; test-asserted). Both profiles share the
same shape: bad vendor cheapest, good vendor slightly dearer — so "cheapest first" always
walks into the trap and the policy always saves it.

**How switching works:** three triggers, all funneling through `DemoStore.reset(id)`:
(1) the dashboard `<select>` → `POST /api/demo/scenario` (409 while running); (2) a Nexla
event whose SKU maps to the other profile (the webhook handler resets before running);
(3) `store.start(qty, sku)` re-syncs by SKU as a safety net. The `SCENARIO` env var sets
the cold-start default (`datacenter` otherwise). Scenario id → SKU is 1:1 (test-asserted
uniqueness), which is what makes SKU-based routing sound.

---

## 10. Evidence system

### 10.1 The `EvidenceSignal` shape

See §3.4. One signal = one evidence class observation with provenance (`EvidenceSource`)
including mode, cost, and (for paid live calls) a settlement `receiptId`.

### 10.2 Fixture vs `live_zero` modes and the collector seam

`createEvidenceCollector(env)` (`services/verification/src/collector.ts`) is the single
switch, keyed on `VERIFICATION_MODE`:
- Anything except `"live_zero"` → the **fixture collector**: `mode: "fixture"`, resolves
  `fixtureEvidence(vendor)` locally, zero cost, fully deterministic.
- `"live_zero"` → `HttpZeroEvidenceCollector`, which **requires**
  `ZERO_EVIDENCE_ADAPTER_URL` (throws at construction otherwise — no silent fixture
  fallback, decision 0010). It POSTs `{ vendor }` to the adapter (optional
  `Bearer ZERO_EVIDENCE_ADAPTER_TOKEN`, timeout `ZERO_EVIDENCE_TIMEOUT_MS` default
  45 000 ms). The adapter (owner-supplied, external to this repo) normalizes real paid
  Zero.xyz calls (enrichment, domain-age scrape, adverse media, phone — decision 0003)
  into the `EvidenceSignal[]` contract documented in `docs/integrations/ZERO.md`.

The control plane builds the collector once per run (`runtime.ts`) and feeds its signals
into `evaluateEvidence` — the policy itself is mode-agnostic.

### 10.3 Receipt enforcement (live mode)

The collector rejects, with hard errors: non-OK adapter status; malformed responses
(structural validation of every signal, `isEvidenceResponse`); a `vendorId` mismatch
between request and response; any signal whose `source.mode !== "live_zero"`; and **any
signal with `costCents > 0 and no `receiptId`** — paid evidence without a settlement
receipt is treated as no evidence. The verdict's `evidenceMode` also downgrades to
`"fixture"` if even one signal is fixture-mode, so a mixed batch can never masquerade as
fully live.

### 10.4 Cost dedup

`paidCallCost` (`policy.ts`): signals are grouped by call identity —
`receiptId` if present, else `provider:serviceId:observedAt` — taking the **max**
`costCents` per call and summing groups. One paid Zero call that yields several signals
(e.g. one enrichment response feeding `company_identity_match` and `web_presence`,
sharing a `receiptId`) is charged once in `totalCostCents` / the dashboard's
"Verification spend".

### 10.5 The service lock

`config/zero-services.json` is the fail-closed record of *proven* live services:
`verifiedAt` (currently `null`), `walletNetwork`, `services[]`. `doctor:prize` requires
`verifiedAt` set and ≥ 3 services recorded from actually-settled calls before any live
claim (decision 0010; process in `docs/integrations/ZERO.md`).

---

## 11. Environment variables (complete reference)

Canonical template: `config/example.env` (copied to `.env` by bootstrap; loaded by
every npm script via `--env-file-if-exists`).

| Variable | Default (in code) | Read by | Meaning |
|---|---|---|---|
| `CONTROL_PLANE_HOST` / `CONTROL_PLANE_PORT` | `127.0.0.1` / `4000` | control-plane server | Bind address. |
| `PROCUREMENT_HOST` / `PROCUREMENT_PORT` | `127.0.0.1` / `4001` | procurement server | Bind address. |
| `CONTROL_PLANE_INTERNAL_URL` | `http://127.0.0.1:4000` | dashboard proxy route | Where `/api/control/*` forwards. |
| `PROCUREMENT_URL` | `http://127.0.0.1:4001` | control-plane runtime | PO submission base URL in development mode. |
| `CONTROL_PLANE_URL` | `http://127.0.0.1:4000` | `scripts/demo.ts` | Demo driver target. |
| `AUTH_MODE` | `development` | procurement, control-plane runtime + store, doctor | `pomerium` switches credential resolution, routing, and origin verification. |
| `VERIFICATION_MODE` | `fixture` | collector, control-plane `/health`, doctor | `live_zero` activates the adapter path. |
| `ATTESTATION_SIGNING_SECRET` | `local-attestation-only-change-me` | verification (sign), procurement (verify) | Shared HMAC secret; must match across services. |
| `DEMO_STEP_DELAY_MS` | `350` | control-plane runtime | Pause after each decision event (demo pacing). |
| `SQLITE_PATH` | `data/continuim.db` | `DemoStore` | State DB path (`:memory:` allowed). |
| `SCENARIO` | `datacenter` | `DemoStore` | Cold-start scenario id. |
| `MONITOR_ENABLED` | enabled (`"0"` disables) | control-plane server + store, doctor | Autonomous monitor gate. |
| `MONITOR_INTERVAL_MS` | `2000` | control-plane server | Tick interval. |
| `MONITOR_REQUESTED_QTY` | `20` | control-plane server | Units requested on trigger. |
| `NEXLA_WEBHOOK_SECRET` | unset (open) | webhook endpoint | When set, `x-continuim-webhook-secret` must match. |
| `ZERO_EVIDENCE_ADAPTER_URL` | — (required in live mode) | collector | Owner-supplied evidence adapter. |
| `ZERO_EVIDENCE_ADAPTER_TOKEN` | unset | collector | Optional bearer token for the adapter. |
| `ZERO_EVIDENCE_TIMEOUT_MS` | `45000` | collector | Adapter fetch timeout. |
| `POMERIUM_ROUTE_URL` | — | control-plane runtime | The only PO path in prize mode. |
| `POMERIUM_JWKS_URL` / `POMERIUM_ISSUER` / `POMERIUM_AUDIENCE` | — (all required in pomerium mode) | procurement | Assertion verification pins. |
| `POMERIUM_SUBJECT_PREFIX` | `vendor:` | procurement, authorize | Expected subject prefix. |
| `POMERIUM_AGENT_TOKEN` | — | control-plane runtime | General-agent identity for the authenticated-but-denied probe. |
| `POMERIUM_VENDOR_TOKEN_<VENDOR_ID>` (e.g. `..._VENDOR_NORTHSTAR`) | — | control-plane runtime | Vendor-scoped service-account token, released only per-attestation. |
| `CONTINUIM_REQUIRE_PRIZE` | unset | doctor | `1` = prize checks become required. |

---

## 12. Learning Layer — landed

> **Status marker:** this layer is **fully landed and tested** (15/15 suite green,
> 2026-07-17). It is specified by `logs/DECISIONS.jsonl` record **0015** and
> STRATEGY-LEDGER entry 15. Deliberately no line numbers here.

**The decision (0015):** ProcureLoop's three-layer definition is absorbed into
Continuim — Hero Runway (autonomous monitoring + procurement loop, implemented),
Secondary Guardrail (vendor-risk verification implemented; demand-audit/purge deferred
per 0012), and a new **Learning Layer**: an append-only **incident ledger**. Every
resolved run logs its anomaly profile, vendor, spend, and resolution speed; subsequent
runs (a) **skip the already-learned unattested probe**, emitting the `recalled_history`
phase instead of a second theatrical 403, and (b) **prefer proven-fulfillment vendors**
in ranking. **Hard invariant:** learning may skip the probe and re-rank candidates, but
it never bypasses the evidence gate or the signed capability.

**Implemented:**
- Contracts: the `recalled_history` phase in `DecisionPhase`, the `IncidentRecord` type,
  and `DemoState.learning` (`incidentCount`, `lastResolutionMs`, `provenVendorIds`)
  (`packages/contracts/src/index.ts`).
- Agent loop: the `LoopHistory` parameter (`provenVendorIds`,
  `knowsAuthorizationRequired`); when `knowsAuthorizationRequired` is true the loop
  emits `recalled_history` ("Recalled from the incident ledger…") and never attempts the
  unattested probe; proven vendors are stably promoted ahead of the pure price sort and
  their `sourced` detail notes the prioritization (`services/agent/src/index.ts`).
- Store: the `incidents` SQLite table (schema in §8) that survives `reset()`, and a
  `runStartedAt` field for resolution timing (`services/control-plane/src/store.ts`).

- Store wiring: `start()` stamps `runStartedAt`; `complete()` appends an
  `IncidentRecord` (resolution time, ordered/blacklisted vendors, spend, PO value,
  evidence mode); `learningSummary()` populates `DemoState.learning` on every
  `reset()`/`read()`; `history()` returns `{ provenVendorIds, knowsAuthorizationRequired
  }` for the active scenario; the runtime passes `store.history()` into
  `runProcurementLoop`.
- Reset semantics: `POST /api/demo/reset` (soft, default) **keeps** the incident ledger;
  body `{ "hard": true }` clears it.
- Dashboard: "Learning: N incidents resolved · last in X.Xs" in the monitor strip, a
  "Proven" chip on vendors in `provenVendorIds`, and a `recalled_history` phase icon.

**Demo consequence (important):** after any completed run, the next run for the same
scenario emits `recalled_history` and **skips the unattested-denial beat**. To stage the
denial (the prize-critical 403 moment), hard-reset first — see `docs/DEMO.md` Before
Recording.

---

## 13. Test inventory

Runner: `node --import tsx --test` with the explicit list in the root `test` script.
Run all: `npm test`. Run one: `node --import tsx --test <file>`. Type-check + tests:
`npm run check` (also enforced by the pre-commit hook). Nine files:

| File | Cases and what each proves |
|---|---|
| `packages/security/src/capability.test.ts` | (1) *Signed attestation round-trips and authorizes only its bound purchase* — encode→decode→verify passes; binding rejects a different vendorId, a quantity above `maxQuantity`, and a swapped `payeeAccountRef`. (2) *Tampered and expired attestations are rejected* — mutating `unitPriceCents` invalidates the HMAC; an expired attestation fails verification. |
| `services/verification/src/policy.test.ts` | (1) The lookalike vendor is `ineligible` at riskScore 100 with **no attestation minted**. (2) The consistent vendor is `eligible` and its attestation is bound to the vendor id, quote id, and payee account ref. |
| `services/verification/src/scenarios.test.ts` | (1) Structural invariants across all profiles: unique SKU per scenario, ≥ 2 vendors, all vendors `synthetic`, every quote bound to the scenario SKU. (2) Apparel typosquat vendor is `ineligible` (score 100, no attestation). (3) Apparel consistent vendor gets a properly bound attestation — the policy generalizes across profiles. |
| `services/agent/src/loop.test.ts` | The full loop against stub ports: blacklists exactly `["vendor-lookalike"]`, orders from `vendor-northstar`, accumulates `atRiskPoValuePreventedCents === 240_000`, and emits the `authorization_denied`, `replanned`, and `inbound_scheduled` phases — deny-then-verify-then-buy in one assertion set. |
| `services/procurement/src/authorize.test.ts` | Development authorization requires a valid request-bound attestation: missing header → "Missing signed vendor attestation"; vendorId mismatch → "Vendor binding mismatch"; price drift → "Unit price binding mismatch"; the exact bound request authorizes. |
| `services/procurement/src/index.test.ts` | The origin's ordering and replay defenses in one sequence: unauthenticated request → 403; valid → 201; **unauthorized replay of the same key → 403** (authorization precedes idempotency); identical authorized replay → 201 with the *same* order id; same key + changed quantity → 409 "different request"; same nonce + new idempotency key → 409 "nonce". |
| `services/control-plane/src/monitor.test.ts` | (1) The monitor fires a Nexla-shape event (`source: "monitor"`, correct SKU) exactly at the threshold. (2) It does **not** fire while a run is active or when inbound stock is already scheduled. |
| `services/agent/src/learning.test.ts` | (1) With `knowsAuthorizationRequired: true` the loop emits `recalled_history`, never attempts the unattested probe (no `authorization_attempted`/`authorization_denied`), leaves the denied fields unset, and still orders from the eligible vendor. (2) A proven vendor at $130 is sourced and ordered ahead of a cheaper unproven $100 candidate, with the "prioritized: proven fulfillment" rationale in the `sourced` detail. |
| `services/control-plane/src/store.test.ts` | The incident ledger end-to-end against in-memory SQLite: an incident is recorded on `complete()` with vendor/spend/resolution data; `learning` summary and `history()` are correct; the ledger **survives a soft reset** and is **cleared by a hard reset**. |

No tests currently cover: the HTTP servers end-to-end, the dashboard, or the live-mode
collector (HTTP branch).

---

## 14. Ops: running, shipping, checking, enforcing

### 14.1 Local development

```bash
npm run setup      # bootstrap.sh (env, data dir, hooks) + npm install
npm run doctor     # readiness
npm run dev        # control-plane :4000, procurement :4001, dashboard :3000
npm run demo       # scripted driver (below) — or click the dashboard
```

`scripts/demo.ts`: resets the demo, POSTs `/api/demo/consume` three times (150 ms apart;
5 → 2 hits the threshold), then polls `/api/state` every 250 ms, streaming each new
decision event to the console, until `runStatus` is `complete` (success) or `failed`
(exit code 1), with a 30-second timeout ("confirm MONITOR_ENABLED=1"). It never calls
`/api/demo/run` — the monitor's autonomy *is* the demo.

### 14.2 Docker and compose topology

One image (`Dockerfile`): `node:22.22.0-bookworm-slim`, per-workspace `package.json`
copies + `npm ci` (layer-cache-friendly), full source copy, `npm run build` (typecheck +
tests + Next build — **the image cannot build if checks fail**), default CMD
`start:control`. `.dockerignore` excludes `.git`, `.next`, `node_modules`, `data`,
`.env*`.

`compose.yaml` (project `continuim`) runs the same image three times:
- `procurement` — `start:procurement`, `expose 4001` (internal only, **not** published),
  health-checked via `fetch /health`.
- `control-plane` — `start:control`, published `4000:4000`,
  `PROCUREMENT_URL=http://procurement:4001`, volume `continuim-data:/app/data` (the
  only persistent volume), depends on procurement healthy.
- `dashboard` — `start:web`, published `3000:3000`,
  `CONTROL_PLANE_INTERNAL_URL=http://control-plane:4000`, depends on control-plane
  healthy.
All read `.env` via `env_file` with `AUTH_MODE=development` pinned.

### 14.3 Akash template

`deploy/akash/deploy.example.yaml` (SDL v2.0): the same three services from an immutable
`ghcr.io/REPLACE_OWNER/continuim:REPLACE_SHA` image. Only the dashboard is global
(port 3000 as 80); `control` is exposed only to `dashboard`; `procurement` only to
`control`. Compute: 0.5 CPU/512 Mi (dashboard), 0.25/256 Mi (control, procurement);
pricing in `uact`. Coverage-only per decision 5; cut-line and runbook in
`docs/integrations/AKASH.md` (doctor:prize + build + compose green first). No persistent
storage is declared — state resets with the lease.

### 14.4 Doctor checks

`scripts/doctor.ts` prints PASS/FAIL/INFO per check and exits 1 if any *required* check
fails. **Local mode (`npm run doctor`)** requires: Node ≥ 22, `node_modules`,
`.env`, `package-lock.json`, monitor enabled; the mode checks are informational.
**Prize mode (`npm run doctor:prize`, i.e. `CONTINUIM_REQUIRE_PRIZE=1`)** additionally
requires: `VERIFICATION_MODE=live_zero`; `AUTH_MODE=pomerium`; the Zero service lock
live-verified (`config/zero-services.json` `verifiedAt` set and ≥ 3 services); and all
seven prize variables set: `ZERO_EVIDENCE_ADAPTER_URL`, `POMERIUM_ROUTE_URL`,
`POMERIUM_JWKS_URL`, `POMERIUM_ISSUER`, `POMERIUM_AUDIENCE`, `POMERIUM_AGENT_TOKEN`,
`POMERIUM_VENDOR_TOKEN_VENDOR_NORTHSTAR`. This is decision 0010's fail-closed gate: no
recording until prize doctor is green.

### 14.5 Git hooks and enforcement

`scripts/bootstrap.sh` sets `core.hooksPath = scripts/githooks`.
`scripts/githooks/pre-commit`: (1) refuses any staged `.env` /
`.env.{local,development,production,test}` file; (2) greps the staged diff for
credential patterns (`BEGIN … PRIVATE KEY`, `POMERIUM_VENDOR_TOKEN_*=` with ≥ 12 chars,
`ANTHROPIC_API_KEY=sk-`) and refuses on match; (3) runs `npm run check` (typecheck + all
tests) and refuses to commit if `node_modules` is missing. Separately, `vision.md`,
`CLAUDE.md`, and `docs/architecture.md` are chmod 444 per the CLAUDE.md protocol (note:
the current hook script does not itself reject edits to those three files — the
read-only bit is the active enforcement; override procedure is documented in
`CLAUDE.md`). `.claude/settings.json` allowlists read-only git commands and injects
`docs/STRATEGY-LEDGER.md` at every session start.

### 14.6 Config files recap

`config/example.env` (§11), `config/zero-services.json` (§10.5),
`config/nexla-stockout.example.json` (the canonical webhook payload; used by the curl
check in `docs/integrations/NEXLA.md`), `infra/pomerium/vendor-policy.example.yaml`
(allow iff user is `vendor:vendor-northstar` AND method POST AND path
`/po/vendor-northstar`), `.env` (git-ignored, hook-blocked, bootstrap-created).

---

## 15. Known gaps and pending integrations

The honest envelope (source: STRATEGY-LEDGER "Standing directives & envelope",
`docs/integrations/*.md` status lines, and the code itself):

1. **Live Zero evidence** — the adapter *contract* and collector seam are implemented
   and enforced (receipts, mode labels, vendor match), but no adapter exists in this
   repo, no paid call has settled, and `config/zero-services.json` is unverified
   (`verifiedAt: null`). `doctor:prize` fails until this is real.
2. **Pomerium route and service accounts** — origin-side assertion verification and the
   vendor-scoped credential plumbing are implemented; the live Pomerium Zero cluster,
   route, "Pass Identity Headers", the two service accounts (`procurement-agent`,
   `vendor:vendor-northstar`), and the applied policy are not yet configured. Until
   then, every denial is the local guard and is labeled as such on the dashboard.
3. **StableEmail** — the PO email channel (decisions 0004/0014) has **no code in the
   repo yet**; nothing sends email.
4. **Nexla FlexFlow** — the authenticated webhook ingress is implemented and validated,
   but the FlexFlow itself (source → transform → filter → destination) must be built in
   Nexla; local `source: "monitor"` events are deliberately not Nexla proof.
5. **LLM planner/explainer (Bedrock adapter)** — decision 0014 adopts an AWS Bedrock
   Converse-backed explainer behind the existing ports (explain-only per 0008); no LLM
   code exists yet — the agent loop is entirely deterministic today.
6. **Akash deployment** — template only; no image published, no lease, no recorded
   provider/URL.
7. **Learning Layer** — mid-landing (§12); until wired through, runs do not consult or
   write incident history.
8. **Origin persistence** — procurement's idempotency and nonce-consumption state is
   in-memory; a restart forgets consumed nonces (bounded by 15-minute attestation
   expiry). Accepted for the hackathon envelope.
9. **Deferred by decision 0012** — the demand-audit / protected-purge branch (design in
   `docs/superpowers/specs/2026-07-17-two-branch-governance-design.md`) is approved but
   not part of the demo-stable baseline.

None of items 1–6 may be claimed in the demo until their runbook carries external proof
(receipts, authorize logs, event IDs, message IDs, lease URLs) — decision 0010.

---

*End of SYSTEM.md.*
