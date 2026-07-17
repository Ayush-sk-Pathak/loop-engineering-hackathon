# Continuim — Product Requirements Document

> **The definitive product document.** Everything we have and everything we need, in one
> place. Sources: `vision.md` (intent), `docs/architecture.md` (blueprint of record),
> `docs/STRATEGY-LEDGER.md` + `logs/DECISIONS.jsonl` (settled decisions 0001–0015),
> `docs/PRODUCT_SCOPE.md`, `docs/BUSINESS.md`, `docs/CASE_STUDIES.md`, `docs/DEMO.md`,
> `docs/infrastructure.md`, `docs/blueprint-reconciliation.md`, `toolsused.md`, the
> integration runbooks under `docs/integrations/`, and the code itself
> (`packages/contracts/src/index.ts`, `services/verification/src/scenarios.ts`,
> `services/verification/src/policy.ts`, `services/verification/src/fixtures.ts`).
>
> Where this document and the code disagree, the code and the frozen contracts win;
> file an update here in the same commit that changes them. Absolute ISO dates only.

**Event:** Loop Engineering Hackathon, 2026-07-17. **Submission:** 16:30
America/Los_Angeles. **Primary prize targets:** Best Use of Zero.xyz; Most Innovative
Use of Pomerium.

---

## 1. Executive Summary

Continuim is an **autonomous emergency-procurement loop for critical-supply stockouts
in any industry**. The hero story is the rescue: a shortage that threatens operations is
detected by an always-on monitor and resolved — sourced, verified, ordered — at machine
speed with no human in the trigger path. The vendor-risk / fraud-defense layer is the
built-in trust subset that makes that autonomy safe to deploy; it is never the headline
product (DECISIONS `0013`).

> An agent may be wrong, but it cannot be unauthorized.

The mechanics in one paragraph: an always-on monitor watches a critical-supply pool and
wakes the agent when the pool crosses its threshold — no run button. The agent ranks two
disclosed synthetic vendor candidates and attempts its cheapest plan; the attempt is
denied at the authorization boundary because the agent holds no vendor-scoped capability.
The agent observes the live `403`, replans, and buys current independent evidence through
Zero.xyz. A deterministic policy (`vendor-risk-v1`) returns `eligible`, `ineligible`, or
`insufficient_evidence`; only an eligible vendor receives a signed, quote-scoped,
payee-bound, amount-limited, expiring, one-time-nonce capability. Pomerium enforces the
vendor-scoped machine identity at the network boundary; the private procurement origin
independently verifies Pomerium's signed assertion **and** Continuim's signed
attestation with complete PO object binding. The accepted PO schedules inbound stock — it
does not pay a supplier or claim physical refill. An append-only incident ledger (the
Learning Layer) records every resolved run so later runs get faster without ever
loosening the gate.

The engine is **horizontal**: an inventory item plus a disclosed vendor pair is seed
data, not code. Two locked scenario profiles — **datacenter** (64 GB ECC memory spares,
the default demo) and **apparel** (navy dye for a halted sock line) — run through the
identical loop behind one dashboard toggle (`POST /api/demo/scenario`).

The stage metric is **at-risk PO value prevented** ($2,400 in the datacenter scenario:
20 units × the lookalike's $120.00 quote), never "fraud dollars blocked." The LLM plans
and explains; it never adjudicates eligibility and never holds spending authority.

**Status at 2026-07-17:** the full local vertical slice is implemented and green
(15/15 tests, typecheck and production build clean — `docs/CURRENT_STATE.md`,
commit `a1d85c3`). The active front is the live Zero evidence adapter plus the Pomerium
deny/allow path. The Learning Layer contracts have landed
(`IncidentRecord`, `DemoState.learning`, the `recalled_history` phase in
`packages/contracts/src/index.ts`); its runtime is being implemented concurrently. Live
sponsor claims remain pending until each runbook holds external proof (DECISIONS `0010`).

---

## 2. Hackathon Context

### 2.1 Event and deadline

- **Event:** Loop Engineering Hackathon, 2026-07-17 — a ~5.5-hour build sprint.
- **Submission deadline:** 2026-07-17 **16:30** America/Los_Angeles (Devpost + repo).
- **Tiebreaker under the clock (CLAUDE.md standing protocol):** a smaller thing that
  runs and demos beats a bigger thing that doesn't. If a feature is not reachable from
  the 3-minute demo script (§14), it is not in scope today.

### 2.2 Judging criteria — five criteria at 20% each

| Criterion (20% each) | What must be visible on stage |
|---|---|
| **Idea** | Fast critical-supply recovery without making emergency purchasing ungoverned |
| **Technical implementation** | Identity and signed object-capability checks outside the LLM; payee/amount binding; replay defense |
| **Tool use** (≥3 sponsor tools) | Real Zero receipts and real Pomerium authorize logs — not sponsor logos; Nexla event ID as coverage |
| **Presentation** | One continuous failure → autonomous wake-up → denial → evidence → replan → accepted-PO story |
| **Autonomy** | The monitor detects the threshold and starts the loop; no separate run action after the threshold crossing |

The differentiated angle is a **self-starting recovery loop with policy-enforced agentic
spending**. The monitor makes the autonomy visible; the independent authorization
boundary makes it safe to delegate.

### 2.3 Prize strategy

- **Zero.xyz — primary prize target.** The economic story: the agent pays cents for
  fresh, independent vendor evidence before dollars move. Proof = pinned service IDs,
  exact prices, wallet delta, receipt IDs (§12.1).
- **Pomerium — primary prize target.** The security story: an authorization boundary
  *outside* the agent, with vendor-scoped machine identities. Proof = a `403` request ID
  with a matching `allow:false` authorize log and no origin request, then a `201` on the
  same route with the vendor identity (§12.2).
- **Nexla — meaningful coverage.** FlexFlow (GA) transforms a real inventory record into
  the frozen schema v1.1 `stockout_risk` contract delivered to the implemented webhook.
- **Akash — coverage only.** Host the existing container after the core proof is green;
  never on the critical demo path.
- **Anthropic / Claude Agent SDK — P2.** Planner/explainer behind the existing loop
  ports; model output never carries authorization authority (DECISIONS `0008`).
- **Dropped:** Fillmore (recruiting-only; domain mismatch — DECISIONS `0004`). AWS
  Bedrock is an approved P2 *adapter* for the planner/explainer port (DECISIONS `0014`),
  not a demo-stable dependency.

**Cut order when the clock collides with scope:** dynamic sourcing → demand audit →
StablePhone → StableEmail → UI extras → Akash → Nexla. **Never cut** the real Zero
receipt or the real Pomerium denial: they are the prize thesis.

---

## 3. The Business Problem

### 3.1 The tension (from `vision.md`, the user's own words)

Every minute a critical item sits at zero stock is an outage that bleeds revenue and
hands customers to a competitor — so the fix has to be fast, and it has to be
autonomous, because a human in the loop is exactly the delay you can't afford. But speed
is dangerous: the rushed reorder is precisely how a buyer wires $40k to a fake supplier
(illustrative figure from `vision.md`, not a measured loss). Continuim resolves that
tension: recovery at machine speed, with spending authority physically gated outside the
agent's judgment.

### 3.2 Downtime economics — both verticals (illustrative scenario inputs)

Both figures below are **scenario seed data** (`services/verification/src/scenarios.ts`,
`downtimeCostCentsPerMinute`), disclosed as illustrative until replaced by a cited
operator-specific input (ROADMAP item; DECISIONS `0011` non-claim):

- **Datacenter (default demo):** a regulated on-prem datacenter loses a node and consumes
  its last safe 64 GB DDR5 ECC spare. Illustrative outage exposure: **$180/minute**
  (18,000 cents/min). Human procurement — noticing the failure, hunting supplier lists,
  chasing quotes, verifying payees — is hours of exactly the latency the incident cannot
  afford.
- **Apparel (second profile):** a sock production line's navy-dye reserve is drained by a
  supplier shipment delay. Illustrative line-stoppage exposure: **$50/minute**
  (5,000 cents/min). Same loop, different industry.

### 3.3 The fraud half of the problem — flagged pending citation

Emergency purchasing is the moment vendor impersonation, payee substitution, and
business-email-compromise (BEC) style payment redirection are hardest to investigate:
urgency suppresses the checks. Industry reporting (e.g., FBI IC3 aggregate BEC loss
figures and procurement-fraud surveys) is widely cited to be in the billions of dollars
annually — **[UNVERIFIED — pending citation. Do not state any specific BEC or
procurement-fraud dollar figure or percentage on stage or in submission copy until a
primary source is cited here.]** The demo therefore quantifies only what it can prove
in-system: the **at-risk PO value prevented** — the dollar value of the PO the ineligible
lookalike vendor would have received ($2,400 datacenter; $18,000 apparel = 20 × $900.00).

### 3.4 The phantom-stockout economics (deferred extension context)

The approved two-branch design (`docs/superpowers/specs/2026-07-17-two-branch-governance-design.md`,
DECISIONS `0012`) names the dual loss on the demand side: bot-driven order bursts create
*phantom stockouts* that drive away real customers **and** trick the buyer into
procuring inventory for demand that isn't real. That demand-audit/purge branch is an
approved extension, deliberately deferred until the core sponsor proof is green (§15.1).
It is not part of the demo-stable baseline and its buyer evidence must never be implied
to be paid Zero evidence while it is fixture-only.

### 3.5 Why delegation creates an authorization problem (from `docs/BUSINESS.md`)

Delegating the workflow to an agent solves the speed problem but creates an
authorization problem: **untrusted vendor data and model reasoning must not become final
spending authority.** The same model that reads a vendor's (attacker-controllable) quote
must not be the last word on whether company spend is committed. Continuim's answer is
structural separation: the agent may research, rank, and replan freely; committing a PO
requires a capability the agent cannot mint, carried over a route the agent cannot
bypass.

---

## 4. Product Definition

### 4.1 One-liner and tagline

**One-liner (from `docs/BUSINESS.md`):** Autonomous recovery for critical supplies, with
procurement authority enforced outside the agent.

**Tagline:** *The rescue is the hero. The trust layer is the tool that makes it safe.
An agent may be wrong, but it cannot be unauthorized.*

The public product name is **Continuim** (DECISIONS `0016`, renaming StockShield from
`0006`; the ProcureLoop rename stays rejected per `0013`/`0015`). The security thesis is **policy-enforced agentic
procurement**: the agent may research and replan but cannot commit a PO without
constrained authority.

### 4.2 The three-layer architecture (DECISIONS `0015`)

Continuim is defined by three layers. The first is the product; the second is what
makes it deployable; the third is what makes it compound.

**Layer 1 — Hero Runway (autonomous monitoring + procurement loop). IMPLEMENTED.**
The always-on inventory monitor (`services/control-plane/src/monitor.ts`, default 2 s
interval) watches critical SKUs and emits the schema v1.1 `stockout_risk` event when a
pool crosses its threshold — provided no run is in flight and no inbound order exists.
The bounded agent loop (`services/agent/src/index.ts`) plans, attempts, observes the
live authorization denial, replans, acquires evidence, and orders — with no operator
action after the threshold crossing. This runway *is* the product story: the shortage is
noticed and fixed at machine speed.

**Layer 2 — Secondary Guardrail (trust subset). Vendor-verification half IMPLEMENTED;
demand-audit half DEFERRED (DECISIONS `0012`).**
The guardrail is why the runway can be trusted with a wallet:
paid independent evidence (Zero.xyz), a deterministic vendor-risk policy
(`services/verification/src/policy.ts`), a signed object capability
(`packages/security`), a vendor-scoped machine identity (Pomerium), and an
independently-verifying private origin (`services/procurement`). The demand-audit /
protected-purge half of the guardrail is an approved extension, not baseline (§15.1).
The guardrail is a **subset** of the rescue loop — it never leads the pitch
(DECISIONS `0013`).

**Layer 3 — Learning Layer (append-only incident ledger). CONTRACTS LANDED; runtime
being implemented concurrently (2026-07-17).**
Every resolved run appends an `IncidentRecord` (scenario, SKU, timing, resolution
speed, ordered vendor, blacklisted vendors, verification spend, PO value, at-risk value
prevented, evidence mode — `packages/contracts/src/index.ts`). Later runs consult the
ledger: instead of re-probing an authorization requirement the system has already
learned, the loop emits a `recalled_history` decision phase and proceeds directly to
evidence; among eligible candidates it prefers vendors with proven fulfillment history
(`DemoState.learning.provenVendorIds`). **Invariant: learning never bypasses the
evidence gate or the signed capability** — it may skip the probe and re-rank, but every
PO still requires fresh eligible evidence and a valid signed attestation (§10).

### 4.3 What Continuim is NOT

- **Not a general fraud detector.** Vendor-risk control and authorization are the trust
  subset inside the procurement loop, not a standalone screening product (DECISIONS
  `0006`, `0013`).
- **Not a criminal-fraud adjudicator.** The system labels vendors `eligible` /
  `ineligible` / `insufficient_evidence`; it never proclaims legal fraud (DECISIONS `0008`).
- **Not a payment system.** The demo issues a PO and schedules inbound stock; it does
  not transfer supplier funds and a PO does not physically refill inventory.
- **Not a customer-checkout screen.** Merging chargeback/checkout screening into this
  workflow was rejected (DECISIONS `0002`, `0006`); the demand-audit branch exists only
  as the deferred extension.
- **Not a dynamic sourcing engine (today).** Vendor candidates are disclosed synthetic
  inputs; dynamic discovery is out of scope for the hackathon build.
- **Not an LLM-authorized wallet.** The LLM plans and explains; a deterministic policy
  decides, and cryptographic verification at an independent origin enforces.

---

## 5. Users & Case Studies

### 5.1 Buyers and value (from `docs/BUSINESS.md`)

- **Infrastructure / operations teams** managing expensive, scarce, or regulated spares —
  value: recovery time at machine speed.
- **Procurement + security teams** that need machine-actionable policy plus an audit
  trail — value: governed PO value, evidence cost per decision, prevented unauthorized
  PO exposure, and a replayable decision record.

**Wedge:** start as a control plane in front of an existing procurement API. Inventory
and sourcing systems remain replaceable adapters; the defensible part is the
evidence-to-capability chain, the protected route, and the decision record.

**Commercial direction (directional hypotheses, not validated pricing):** usage fee per
governed procurement attempt or evidence bundle; platform tier for policies, audit
retention, integrations, multi-team controls.

### 5.2 Implemented case: datacenter memory spares (`docs/CASE_STUDIES.md`)

A node failure consumes one 64 GB ECC memory spare. At the critical threshold the
monitor emits `stockout_risk`. The agent evaluates two disclosed synthetic distributors.
The cheaper lookalike lacks a capability and is denied, then fails the deterministic
evidence policy on identity, young domain, missing footprint, unreachable contact, payee
mismatch, and typosquatting. The second candidate receives a quote-bound capability and
an accepted PO. **Proves:** autonomous wake-up, denial-driven replanning, evidence
policy, object-bound authorization, replay protection, inbound scheduling.
**Does not prove:** counterfeit detection, supplier payment, physical recovery, or a
specific downtime saving.

### 5.3 Implemented case: apparel dye (horizontal proof)

The apparel profile shows navy dye flowing through the same event, evidence, capability,
and PO contracts. Its evidence remains the same generic synthetic vendor-risk fixture;
it does **not** prove chemical certification or lot suitability.

### 5.4 Future cases (expansion hypotheses, each needing its own evidence-adequacy review)

- **Regulated hardware procurement** (DIMMs, storage, PSUs, network gear): would need
  authorized-channel provenance, part certification, sanctions/compliance evidence — not
  inferable from domain age or generic web search.
- **Manufacturing inputs** (chemicals, packaging, automotive): would need certification,
  lot traceability, material-safety, legal-entity providers.
- **Demand audit and protected purge:** the approved two-branch design (§15.1); buyer
  evidence stays fixture-labeled until live sources are verified.

**Reuse boundary:** the reusable engine is not "fraud detection for every industry." It
is (1) a versioned trigger, (2) normalized evidence with provenance, (3) a deterministic
policy, (4) a signed object capability, (5) an independently protected mutation, and
(6) an audit trail.

---

## 6. Horizontal Scenarios

The scenario-profile engine (DECISIONS `0013`; implemented in
`services/verification/src/scenarios.ts`, tested in `scenarios.test.ts`) makes the loop
scenario-agnostic: an inventory item plus a disclosed vendor pair is **seed data, not
code**. Selection is via `POST /api/demo/scenario` and a dashboard toggle (disabled
mid-run). The demo default is **datacenter**; the apparel toggle is only the optional
"same loop, any industry" closer (§14.2) and must never displace the live vertical slice.

### 6.1 Profile: `datacenter` (default)

| Field | Value (exact, from `scenarios.ts`) |
|---|---|
| Label / industry | "On-prem compute spares" / Regulated datacenter |
| Trigger | Node failure drains the critical spares pool |
| SKU | `DDR5-ECC-64GB` — 64 GB DDR5 ECC Memory Module |
| Seed inventory | `currentQty: 5`, `threshold: 2`, `critical: true` |
| Illustrative downtime | 18,000 cents/min ($180/min) |
| Requested quantity | 20 (`MONITOR_REQUESTED_QTY=20`) |

**Vendor pair (both `synthetic: true`, from `services/verification/src/fixtures.ts`):**

| | `vendor-lookalike` (planted ineligible) | `vendor-northstar` (consistent) |
|---|---|---|
| Legal name | Northstar Distributi0n LLC (zero-for-o) | Northstar Supply Cooperative |
| Domain | `northstar-distribution.example` | `northstar-supply.example` |
| Phone | +1-555-010-0999 | +1-555-010-0140 |
| Quote | `quote-lookalike-1` | `quote-northstar-1` |
| Payee | **Northstar Holdings International** (mismatch) | Northstar Supply Cooperative (match) |
| Payee account ref | `demo-payee-lookalike` | `demo-payee-northstar` |
| Unit price | $120.00 (12,000 c) — cheaper, tempts the first plan | $127.50 (12,750 c) |
| Available qty / lead | 20 / 1 day | 20 / 2 days |

**Headline numbers:** at-risk PO value prevented = 20 × $120.00 = **$2,400**. Accepted
PO value = 20 × $127.50 = **$2,550**, inbound scheduled quantity 20.

### 6.2 Profile: `apparel`

| Field | Value (exact, from `scenarios.ts`) |
|---|---|
| Label / industry | "Sock line dye supply" / Apparel manufacturing |
| Trigger | Supplier shipment delay drains the navy dye reserve |
| SKU | `NAVY-DYE-20L` — Navy textile dye (20 L drum) |
| Seed inventory | `currentQty: 5`, `threshold: 2`, `critical: true` |
| Illustrative downtime | 5,000 cents/min ($50/min) |

**Vendor pair (both `synthetic: true`):**

| | `vendor-pacificdye` (planted ineligible) | `vendor-meridian` (consistent) |
|---|---|---|
| Legal name | Pacific Dye C0. Inc (zero-for-o) | Meridian Colorants Ltd |
| Domain | `pacificdye-co.example` | `meridian-colorants.example` |
| Phone | +1-555-010-0877 | +1-555-010-0362 |
| Quote | `quote-pacificdye-1` | `quote-meridian-1` |
| Payee | **Cascadia Trade Holdings Ltd** (mismatch) | Meridian Colorants Ltd (match) |
| Payee account ref | `demo-payee-pacificdye` | `demo-payee-meridian` |
| Unit price | $900.00 (90,000 c) | $965.00 (96,500 c) |
| Available qty / lead | 20 / 1 day | 20 / 2 days |

**Headline numbers:** at-risk PO value prevented = 20 × $900.00 = **$18,000**; accepted
PO value = 20 × $965.00 = **$19,300**.

### 6.3 Fixture evidence per profile (from `fixtures.ts`)

Planted vendors (`vendor-lookalike`, `vendor-pacificdye`) receive the failing signal set:
`company_identity_match=false` (fail), `domain_age_days=14` (fail), `web_presence=false`
(fail), `news_presence=false` (warn), `contact_reachable=false` (fail),
`payee_identity_match=false` (fail), `typosquat_detected=true` (fail). Consistent
vendors receive the passing set with `domain_age_days` 1,840 (`vendor-northstar`) or
2,200 (`vendor-meridian`). All fixture sources carry `mode: "fixture"`, `costCents: 0`,
provider "Continuim fixture" — visibly labeled, never representable as live Zero.

Adding a third industry is a new `ScenarioProfile` entry plus fixtures — no engine
changes. Every new scenario needs its own evidence-adequacy review before it inherits
the same claims (§5.4).

---

## 7. System Architecture

Blueprint of record: `docs/architecture.md` (protected file). Runtime topology:
`docs/infrastructure.md`. Contracts: `packages/contracts/src/index.ts` (authoritative).

### 7.1 Components, ports, exposure

| Component | Path | Local port | Prize exposure |
|---|---|---:|---|
| Ops dashboard (Next.js) | `apps/dashboard/` | 3000 | public |
| Control plane (monitor, orchestration, Nexla ingress, SQLite) | `services/control-plane/` | 4000 | public webhook/API or private behind dashboard |
| Procurement origin (PO API, replay controls) | `services/procurement/` | 4001 (`127.0.0.1` local) | **private; Pomerium only** |
| Zero evidence adapter (Owner 2) | owner-supplied HTTP service | owner-defined, example 4100 | private |
| Agent loop | `services/agent/` | in-process library | — |
| Shared contracts / security | `packages/contracts/`, `packages/security/` | — | — |

The dashboard uses a same-origin Next.js proxy plus `CONTROL_PLANE_INTERNAL_URL`, so one
build works locally, in Docker (`compose.yaml`), and on Akash. `npm run dev` runs the
three processes; `docker compose up --build` runs the same topology with procurement
exposed only to the container network. State: SQLite at `SQLITE_PATH=data/continuim.db`.

### 7.2 The five frozen seams (schema v1.1)

The TypeScript definitions in `packages/contracts/src/index.ts` are authoritative
(`SCHEMA_VERSION = "1.1"`). Contract changes require all four owners to acknowledge
(CONTRIBUTING.md).

1. **`StockoutRiskEvent`** — schemaVersion, `type: "stockout_risk"`, eventId, sku,
   currentQty, threshold, requestedQty, occurredAt, `source: "nexla" | "local" | "monitor"`.
2. **`VerificationVerdict`** — `eligible | ineligible | insufficient_evidence`,
   riskScore, reasons, `EvidenceSignal[]`, evidenceMode, evidenceHash, totalCostCents,
   `policyVersion: "vendor-risk-v1"`, evaluatedAt, expiresAt.
3. **`VendorAttestation`** — vendorId/vendorDomain, quoteId, sku, payeeName,
   payeeAccountRef, evidenceHash, policyVersion, unitPriceCents, maxQuantity,
   maxAmountCents, currency, nonce, issuedAt, expiresAt, signature (§8.2).
4. **`POST /po/:vendorId`** — `PurchaseOrderRequest` + `ProcurementCredential`
   (`development` or `pomerium`); returns `201 | 403`. Accepted orders are
   `status: "accepted"`, `inboundStatus: "scheduled"` — never a physical-refill claim.
5. **`DecisionEvent`** — correlationId, `DecisionPhase` (`observed`, `planned`,
   `recalled_history`, `sourced`, `authorization_attempted`, `authorization_denied`,
   `replanned`, `verifying`, `ineligible`, `blacklisted`, `attested`, `ordered`,
   `inbound_scheduled`, `failed`), vendor, detail, timestamp, safe metadata (no secrets).

Supporting contracts: `VendorCandidate`/`VendorQuote`, `EvidenceSignal`/`EvidenceSource`
(§9), `ProcurementResult` (status, enforcementPoint `development | pomerium | origin`,
requestId), `IncidentRecord` and `DemoState.learning` (§10), `DemoMetrics`
(atRiskPoValuePreventedCents, verificationSpendCents, inboundQuantity, modes, denied
request ID/enforcement point).

### 7.3 Six trust boundaries (from `docs/architecture.md`)

1. **Inventory event boundary.** In-process monitor and Nexla FlexFlow emit the same
   versioned contract; `source` makes the active path explicit. A local monitor event is
   never presented as Nexla proof.
2. **Evidence boundary.** Every signal names provider, serviceId, mode, cost, timestamp,
   receipt. A fixture signal is visibly labeled and cannot be represented as live Zero.
3. **Decision boundary.** `vendor-risk-v1` is deterministic. Claude may summarize
   reasons but cannot turn an ineligible result into an attestation.
4. **Capability boundary.** An attestation binds vendor, quote, evidence hash, amount
   ceiling, currency, nonce, policy version, expiry. It contains no service-account secret.
5. **Pomerium boundary.** A verified demo vendor maps to a vendor-scoped Pomerium
   service account; verification releases only the corresponding credential reference.
   Rejected vendors receive no capability.
6. **Origin boundary.** `POST /po/:vendorId` verifies `X-Pomerium-Jwt-Assertion`
   (signature, issuer, audience, expiry, `sub == vendor:<vendorId>`) **and** the signed
   Continuim attestation with full object binding. Authorization happens before
   idempotency lookup. The origin is not publicly reachable in prize mode.

Pomerium does not inspect arbitrary JSON bodies or read our SQLite database. A single
shared agent identity is insufficient because both vendor choices would look identical
to the proxy (DECISIONS `0007`).

### 7.4 Runtime flow (the canonical eleven steps)

1. A failed node (or shipment delay) consumes the last safe spare —
   `POST /api/demo/consume` is the deterministic demo input; it does **not** start
   procurement.
2. The always-on local monitor (2 s interval; `MONITOR_ENABLED=1`,
   `MONITOR_INTERVAL_MS=2000`) detects `currentQty <= threshold` with no run in flight
   and no inbound order, and emits schema v1.1 `stockout_risk` with `source: "monitor"`.
   In the sponsor path, Nexla FlexFlow posts the same contract with a Nexla event ID to
   `POST /api/events/stockout` (authenticated with `X-Continuim-Webhook-Secret` when
   `NEXLA_WEBHOOK_SECRET` is set).
3. The agent ranks the two disclosed synthetic candidates by fulfillment and price.
4. It submits the cheapest plan (the lookalike, $120.00/unit) using the authenticated
   **general-agent** identity — deliberately *before* verification (DECISIONS `0009`).
5. The request is denied: Pomerium returns `403` and the request never reaches the
   procurement origin (development mode: the origin guard denies for the missing
   capability — labeled development, never claimed as Pomerium proof).
6. The agent observes the missing vendor capability and replans: it buys independent
   evidence via Zero (fixture collector locally; `live_zero` adapter in prize mode).
7. The deterministic policy marks the lookalike `ineligible` (payee mismatch +
   typosquat hard failures, plus compound young-domain/no-footprint) and blacklists it
   for the run. No human intervenes.
8. The consistent candidate is `eligible` and receives a signed attestation bound to
   vendor, domain, SKU, payee, account reference, quote, unit price, quantity/amount
   ceiling, evidence hash, expiry, and one-time nonce.
9. The agent retries through the same route using the **vendor-scoped** service identity
   (`vendor:vendor-northstar`).
10. The private origin verifies both layers plus every object binding and the nonce,
    records the PO (`201`), and schedules inbound stock (20 units).
11. StableEmail sends the PO only when its live Zero adapter is configured; otherwise
    the email step is disclosed as pending/disabled.

The denied request occurs **before** evidence is acquired: the agent learns the
environment's authorization requirement from a real response and changes its plan. It is
never forced to order from a candidate it already classified ineligible (DECISIONS `0009`).

### 7.5 Pomerium 403 mechanics (prize-mode request path)

**Deny beat.** The agent POSTs to `POMERIUM_ROUTE_URL` (`https://po.<starter-domain>`)
with the `procurement-agent` service-account token (`POMERIUM_AGENT_TOKEN`). Pomerium
authenticates the token (identity is valid), then evaluates the route PPL
(`infra/pomerium/vendor-policy.example.yaml`):

```yaml
allow:
  and:
    - user:
        is: "vendor:vendor-northstar"
    - http_method:
        is: "POST"
    - http_path:
        is: "/po/vendor-northstar"
```

The subject does not match → Pomerium/Envoy returns `403` with a request ID and writes
an `authorize` log with `allow:false`. The origin's access log has **no matching
request** — that absence is part of the stage proof.

**Allow beat.** After verification, the agent retries with
`POMERIUM_VENDOR_TOKEN_VENDOR_NORTHSTAR` (the `vendor:vendor-northstar` service
account). Pomerium authorizes the exact subject-method-path triple, proxies to the
private origin (`http://procurement:4001`) with **Pass Identity Headers** enabled. The
origin then independently verifies:

1. `X-Pomerium-Jwt-Assertion`: signature against `POMERIUM_JWKS_URL`, issuer
   (`POMERIUM_ISSUER`), audience (`POMERIUM_AUDIENCE`), expiry, and
   `sub == POMERIUM_SUBJECT_PREFIX + vendorId` (i.e. `vendor:` + URL path vendor).
2. Continuim's signed `VendorAttestation` and the complete PO object binding (§8.3).
3. One-time nonce, request fingerprint, and only then the idempotency key.

Neither layer substitutes for the other. Never authorize on an unsigned `vendorId`
header, and never publish port 4001 in prize mode.

### 7.6 Local mode versus prize mode

| Property | Local development | Prize demo |
|---|---|---|
| Evidence | Disclosed `.example` fixtures, $0 | Pinned live Zero services + receipts |
| Trigger | Always-on local monitor | Nexla webhook → FlexFlow → `/api/events/stockout` |
| Authorization | Signed attestation guard at origin (`AUTH_MODE=development`) | Pomerium service account + PPL + signed attestation at origin (`AUTH_MODE=pomerium`) |
| Email | Pending/disabled or queued | StableEmail paid through Zero |
| Hosting | Local npm or Docker | Akash only if already stable |

The dashboard always displays the active evidence mode. Fixture mode is never acceptable
in the submitted Zero demo, and no fallback may silently change `live_zero` to fixture.

### 7.7 Data & scaling notes (from `docs/infrastructure.md`)

SQLite stores demo state and decision events. Procurement idempotency and nonce tracking
are currently **process-local** (one origin instance); do not scale the origin
horizontally without moving those maps to a transactional shared store. Fixture vendors
use `.example` domains and synthetic payee references — never passed off as real
organizations.

---

## 8. Security & Authorization Model

### 8.1 Identity model — the agent is not the vendor

A shared agent identity cannot implement a vendor-specific Pomerium policy: the agent is
the network caller, while the vendor is an object in the request (DECISIONS `0007`).
Prize mode therefore uses two machine identities:

- **`procurement-agent`** — a general service account that *authenticates* but fails
  the vendor PO policy. Its initial cheapest-plan request produces the stage `403`.
- **`vendor:<vendorId>`** (e.g. `vendor:vendor-northstar`) — a vendor-scoped service
  identity **released only after** that vendor's evidence passes. Allowed only on its
  exact vendor path and POST method.

The procurement origin has no public route other than Pomerium in prize mode.

### 8.2 The signed attestation (object capability)

Minted only for an `eligible` verdict, HMAC-signed (`packages/security`,
`signVendorAttestation`, secret `ATTESTATION_SIGNING_SECRET`), covering every field of
`VendorAttestation`: id, vendorId, vendorDomain, `verified: true`, quoteId, sku,
payeeName, payeeAccountRef, evidenceHash, `policyVersion: "vendor-risk-v1"`,
unitPriceCents, maxQuantity (= quote availableQty), maxAmountCents
(= unitPriceCents × availableQty), currency, one-time nonce, issuedAt, expiresAt
(15 minutes after evaluation). The attestation contains **no service-account secret**;
the Pomerium credential travels separately in the `ProcurementCredential`.

### 8.3 Origin verification order (both modes)

1. **Authorization first** — verify the credential (Pomerium assertion in prize mode)
   and the attestation signature/expiry **before** any idempotency lookup, so a replayed
   idempotency key cannot skip authorization.
2. **Complete object binding** — the `PurchaseOrderRequest` must equal the attestation
   on vendorId, vendorDomain, SKU, payeeName, payeeAccountRef, quoteId, unitPriceCents,
   currency, evidenceHash, and respect `quantity ≤ maxQuantity`,
   `quantity × unitPriceCents ≤ maxAmountCents`, and expiry. An authenticated identity
   cannot change the payee, account reference, SKU, or unit price.
3. **Replay defense** — request fingerprint comparison plus one-time
   `authorizationNonce`: a nonce cannot create two POs, and a changed replay under the
   same idempotency key is rejected. Tests: `packages/security/src/capability.test.ts`,
   `services/procurement/src/authorize.test.ts`, `services/procurement/src/index.test.ts`.

### 8.4 Security invariants (from `docs/architecture.md` — binding)

- No capability, no PO. Missing credentials are denied.
- A credential for vendor A cannot authorize vendor B.
- A capability cannot exceed its quote, amount, currency, evidence hash, or expiry.
- A rejected or insufficient-evidence vendor never receives a capability.
- The Pomerium route is the only network path to the production procurement origin.
- The stage denial must include a Pomerium request ID and authorize log; an
  origin-generated 403 does not satisfy the Pomerium claim.
- Fixture evidence and fixture costs are labeled in code, state, UI, and docs.
- A PO means `inbound_scheduled`; inventory increases only upon a later receipt event.
- The financial metric is `at-risk PO value prevented`, never `fraud dollars blocked`.
- Secrets remain environment-only; service-account tokens, wallet keys, complete
  Pomerium assertions, and recipient PII never enter decision-event metadata.
- The pre-commit hook (`scripts/githooks/pre-commit`) rejects staged `.env*` files and
  recognizable private keys.

### 8.5 Secrets inventory (from `config/example.env`)

Local: `ATTESTATION_SIGNING_SECRET`, `SQLITE_PATH`, monitor and port variables
(`CONTROL_PLANE_HOST/PORT=4000`, `PROCUREMENT_HOST/PORT=4001`,
`CONTROL_PLANE_INTERNAL_URL`, `PROCUREMENT_URL`, `DEMO_STEP_DELAY_MS=350`,
`MONITOR_ENABLED=1`, `MONITOR_INTERVAL_MS=2000`, `MONITOR_REQUESTED_QTY=20`).
Nexla: `NEXLA_WEBHOOK_SECRET`.
Live Zero: `VERIFICATION_MODE=live_zero`, `ZERO_EVIDENCE_ADAPTER_URL` (example
`http://127.0.0.1:4100/v1/evidence`), `ZERO_EVIDENCE_ADAPTER_TOKEN`,
`ZERO_EVIDENCE_TIMEOUT_MS=45000`.
Pomerium: `AUTH_MODE=pomerium`, `POMERIUM_ROUTE_URL`, `POMERIUM_JWKS_URL`,
`POMERIUM_ISSUER`, `POMERIUM_AUDIENCE`, `POMERIUM_SUBJECT_PREFIX=vendor:`,
`POMERIUM_AGENT_TOKEN`, `POMERIUM_VENDOR_TOKEN_VENDOR_NORTHSTAR`.
`.env` is created from `config/example.env` by `npm run setup` and is never
committed.

---

## 9. Verification & Evidence Policy

Implementation: `services/verification/src/policy.ts` (policy `vendor-risk-v1`),
`collector.ts` (fixture / `live_zero` modes), `fixtures.ts` (disclosed fixture signals).
Tests: `policy.test.ts`.

### 9.1 Evidence classes

**Required** (missing any ⇒ `insufficient_evidence`, never `eligible`):
`company_identity_match`, `domain_age_days`, `web_presence`, `payee_identity_match`,
`typosquat_detected`. **Supporting:** `contact_reachable`, `news_presence`.

### 9.2 Deterministic scoring (exact weights)

| Signal condition | Risk added | Note |
|---|---:|---|
| `company_identity_match = false` | +35 | |
| `domain_age_days < 30` | +30 | `< 90` adds +15 instead |
| `web_presence = false` | +20 | |
| `contact_reachable = false` | +20 | supporting signal |
| `payee_identity_match = false` | +100 | **hard failure** |
| `typosquat_detected = true` | +100 | **hard failure** |

Score is capped at 100. **Outcome:** missing required class ⇒ `insufficient_evidence`;
hard failure, or the compound failure (`domain_age_days < 30` **and**
`web_presence = false`), or `riskScore ≥ 60` ⇒ `ineligible`; otherwise `eligible`.
A young domain alone, missing news alone, or an unanswered phone alone is **not**
decisive (DECISIONS `0008`).

### 9.3 Provenance, cost, and expiry rules

- Every `EvidenceSource` carries provider, serviceId, `mode: fixture | live_zero`,
  costCents, observedAt, and (for paid signals) receiptId. The control plane rejects
  paid signals without receipt IDs, mismatched vendor IDs, non-live modes in
  `live_zero`, and malformed evidence.
- If one provider call yields several signals, all share its receipt;
  `paidCallCost()` deduplicates cost by receipt so it is counted once.
- The verdict's `evidenceMode` is `fixture` if **any** signal is fixture — a mixed
  bundle can never masquerade as fully live.
- `evidenceHash` = SHA-256 over vendorId, vendorDomain, quoteId, and the full signal
  set; it is bound into the attestation and the PO. Verdicts and attestations expire
  **15 minutes** after evaluation.

### 9.4 The LLM's role

An LLM may extract, normalize, or explain provider output but cannot add an independent
evidence vote, cannot adjudicate eligibility, and cannot mint or override a capability
(DECISIONS `0008`, reaffirmed in `0014`: if the Bedrock explainer ever disagrees with
the policy, the policy wins and the disagreement is logged).

### 9.5 Live evidence composition (DECISIONS `0003`, `0014` item C)

Zero.xyz does **not** broker credit-bureau, telco, business-registry, fraud-score, or
freight data (verified 3-0 by deep research against `zero.xyz/browse` and the
`zero-plugins` repo, 2026-07-17). The live verdict is therefore composed from tools that
provably exist: company/contact **enrichment** (identity match), a **domain-age/WHOIS**
paid call (the authentic anchor that genuinely catches the ~2-week typosquat),
**scraping** (web presence), **news/serp** (adverse media), optionally an **AI phone
call** (reachability). Re-verify the live catalog at `zero.xyz/browse` on the day —
it is dynamic — and never promise a provider from the marketing page alone.

---

## 10. Learning Layer Specification (DECISIONS `0015`)

**Status:** contracts landed in `packages/contracts/src/index.ts` (`IncidentRecord`,
`DemoState.learning`, `recalled_history` in `DecisionPhase`); runtime is being
implemented concurrently (2026-07-17). Describe it as part of the product; report its
implementation state honestly at demo time.

### 10.1 The append-only incident ledger

Every resolved run appends one `IncidentRecord`:

| Field | Meaning |
|---|---|
| `id`, `scenarioId`, `sku` | which incident, which profile |
| `startedAt`, `resolvedAt`, `resolutionMs` | resolution speed (the demo-visible number) |
| `orderedVendorId` | who fulfilled (null if failed) |
| `blacklistedVendorIds` | who was rejected during the run |
| `verificationSpendCents`, `poValueCents`, `atRiskPoValuePreventedCents` | the economics |
| `evidenceMode` | fixture vs live_zero — learning inherits the honesty labels |

The ledger is append-only, mirroring the repo's evidence discipline
(`logs/errors.jsonl` pattern): records are never edited or deleted.

### 10.2 What later runs do differently

1. **Skip the already-learned probe.** After a run has established that unattested POs
   are denied, subsequent runs do not re-probe; the loop emits a `recalled_history`
   decision phase citing the prior incident and proceeds directly to evidence
   acquisition. The first run's live 403 remains the canonical stage beat.
2. **Prefer proven vendors.** Among *eligible* candidates, ranking prefers vendors in
   `DemoState.learning.provenVendorIds` (proven fulfillment history) over an untested
   marginally-cheaper quote.
3. **Show the compounding.** Dashboard surfaces `learning.incidentCount`,
   `learning.lastResolutionMs`, and the proven-vendor list — visible speed-up across
   runs serves the self-correcting-loop judging theme.

### 10.3 The learning invariant (non-negotiable)

**Learning never bypasses the evidence gate or the signed capability.** It may skip the
probe and re-rank vendors, but every PO still requires a fresh eligible verdict within
its 15-minute expiry and a valid signed attestation verified at the origin. A remembered
vendor is a preference, not an authorization. (DECISIONS `0015`, invariant clause.)

---

## 11. Full Functional Requirements

### 11.1 WHAT WE HAVE — implemented and green (2026-07-17, tests 15/15; baseline commit `a1d85c3` plus the landed Learning Layer)

| Capability | Where |
|---|---|
| Schema v1.1 shared contracts (stockout, evidence, verdict, attestation, PO, decision, incident, demo state) | `packages/contracts/src/index.ts` |
| HMAC attestation signing/verification + request binding | `packages/security/src/index.ts` (+ `capability.test.ts`) |
| Deterministic vendor-risk policy `vendor-risk-v1` (three outcomes, hard/compound failures, receipt-deduped cost) | `services/verification/src/policy.ts` (+ `policy.test.ts`) |
| Pluggable fixture / `live_zero` evidence collector; paid signals without receipts refused | `services/verification/src/collector.ts` |
| Disclosed fixture vendors + signals for both profiles | `services/verification/src/fixtures.ts` |
| Horizontal scenario engine (datacenter + apparel) + quote-to-SKU consistency tests | `services/verification/src/scenarios.ts` (+ `scenarios.test.ts`) |
| Bounded autonomous loop: cheapest-unattested attempt → live 403 → replan → evidence → blacklist → attested order | `services/agent/src/index.ts` (+ `loop.test.ts`) |
| Always-on critical-inventory monitor (2 s; threshold + idle + no-inbound guards; no retrigger) | `services/control-plane/src/monitor.ts` (+ `monitor.test.ts`) |
| Control plane: orchestration, SQLite state, decision trail, demo endpoints (`POST /api/demo/consume`, `POST /api/demo/scenario`) | `services/control-plane/src/server.ts`, `store.ts`, `runtime.ts` |
| Authenticated Nexla-compatible webhook ingress (schema/quantity/source/secret validation; rejects events mid-run) | `POST /api/events/stockout` in `services/control-plane/src/server.ts` |
| Procurement origin: authorization-before-idempotency, full object binding, fingerprint + nonce replay defense, Pomerium assertion verification with subject-to-path equality | `services/procurement/src/authorize.ts`, `index.ts`, `server.ts` (+ tests) |
| One-screen responsive ops dashboard distinguishing fixture/local/live modes | `apps/dashboard/` |
| One-command setup + doctor gates | `scripts/bootstrap.sh`, `scripts/doctor.ts`; npm scripts `setup`, `dev`, `demo`, `check`, `build`, `doctor`, `doctor:prize` |
| Docker image + compose topology; Akash SDL example; Pomerium PPL example | `Dockerfile`, `compose.yaml`, `deploy/akash/deploy.example.yaml`, `infra/pomerium/vendor-policy.example.yaml` |
| Runbooks + demo script | `docs/integrations/{ZERO,POMERIUM,NEXLA,AKASH}.md`, `docs/DEMO.md` |
| Learning Layer contracts (`IncidentRecord`, `DemoState.learning`, `recalled_history`) | `packages/contracts/src/index.ts`; runtime landing concurrently |

### 11.2 P0 — submission-critical (must be true at 16:30; mostly implemented, must stay green)

- One command creates a safe local environment (`npm run setup`); one command starts the
  stack (`npm run dev`).
- The five shared contracts compile across every workspace (`npm run typecheck`).
- A critical threshold wakes the agent and runs end-to-end without a separate start
  action; the monitor does not retrigger while a run is active or inbound supply is
  scheduled.
- Required evidence classes produce `eligible` / `ineligible` / `insufficient_evidence`;
  rejected or insufficient candidates receive **no** attestation.
- A missing capability is denied before PO creation.
- A valid capability cannot be replayed for a second order or changed across vendor,
  domain, payee, account, SKU, quote, price, quantity, amount, evidence, expiry, or nonce.
- Pomerium mode verifies its signed assertion and exact vendor subject-to-path binding.
- The dashboard shows monitor health, decision events, evidence mode/spend, enforcement
  mode/request ID, illustrative outage exposure, at-risk PO value prevented, and inbound
  scheduled quantity.
- A PO changes inbound scheduled inventory only, never on-hand inventory.
- The scenario toggle is available but datacenter remains the default and the toggle is
  disabled mid-run.

### 11.3 P1 — WHAT WE NEED: sponsor proof (owners and time gates)

| # | Requirement | Owner | Time gate |
|---|---|---|---|
| 1 | Settle one live Zero call per candidate service; pin ≥3 useful services in `config/zero-services.json` (currently `services: []`, `verifiedAt: null`) with exact IDs, prices, receipt IDs, latency | Owner 2 (Zero Verification) | first settled call + receipt **within 30 min** of integration start |
| 2 | Implement the live Zero evidence adapter (`ZERO_EVIDENCE_ADAPTER_URL`) returning normalized receipted signals; show exact service price, receipt, and wallet delta in the trace | Owner 2 | with #1 |
| 3 | Create Pomerium Zero cluster, private route to the origin, and the two service accounts (`procurement-agent`, `vendor:vendor-northstar`); apply the exact-path PPL | Owner 3 (Policy + Procurement) | logged `403` **and** `201` on the same route **within 60 min** |
| 4 | Capture the denied request ID, `allow:false` authorize log, and absence from origin logs; then the vendor-identity `201` | Owner 3 | with #3 |
| 5 | Run the complete live Zero → Pomerium vertical slice to the dashboard | Owners 1+3 | **within 90 min** |
| 6 | Deliver a real Nexla FlexFlow-transformed event to `POST /api/events/stockout`; preserve the Nexla event ID through the decision trace | Owner 4 (Dashboard + Data) | before feature freeze |
| 7 | Send the accepted PO via StableEmail; capture message ID and received message | Owner 3 | only after Zero + Pomerium are green |

**Global gates:** feature freeze **75 minutes before submission** (≈15:15); first
complete recording + Devpost draft **45 minutes before submission** (≈15:45).
`npm run doctor:prize` is the recording gate and fails closed until the live Zero
service lock, adapter, Pomerium route, authenticated denied identity, and
verified-vendor identity are configured.

### 11.4 P2 — only after the core is green

- Learning Layer runtime completion (ledger persistence, `recalled_history` emission,
  proven-vendor ranking, dashboard learning strip) — concurrent build; invariant §10.3.
- Claude Agent SDK planner/explainer behind the existing loop ports; AWS Bedrock
  adapter (`@aws-sdk/client-bedrock-runtime` Converse, cross-region
  `us.anthropic.claude-haiku-4-5-*` inference-profile id; Anthropic-key fallback) —
  explainer only, policy wins on disagreement (DECISIONS `0014` item A).
- Labeled real-artifact replay mode with a `live | replay` dashboard badge
  (DECISIONS `0014` item B).
- StableEmail-primary with a disclosed non-Zero email fallback (DECISIONS `0014` item D).
- StablePhone call only if latency and consent are controlled.
- Akash deployment using an immutable image tag (`deploy/akash/deploy.example.yaml`).
- Replace the illustrative downtime rate with a cited operator-specific input.
- Additional vendor-risk patterns; demand-audit/purge branch (§15.1).

---

## 12. Tool Strategy

Recording rule for every row: **names and mode labels are not proof.** Record external
IDs and logs in the runbook under `docs/integrations/`; if the artifact is missing,
disclose the integration as pending (DECISIONS `0010`).

### 12.1 Zero.xyz — PRIMARY

- **Role:** wallet-funded, current, independent vendor evidence without standing API
  subscriptions; optionally StableEmail for the PO send. The stage compares evidence
  spend (cents) with governed PO value (dollars).
- **Status:** strict HTTP adapter seam implemented (`collector.ts`; paid signals without
  receipt IDs are refused). No live services locked — `config/zero-services.json` is
  empty pending Owner 2's settled calls.
- **Proof required:** exact pinned service IDs, quoted prices, wallet delta, receipt ID
  from one settled call per service; ≥3 receipts visible in the trace.
- **Discipline:** re-verify `zero.xyz/browse` on the day; do not promise a provider from
  the public catalog alone; do not describe a direct paid API call as Zero usage unless
  Zero actually discovered/activated and settled it. Composition per §9.5, with the real
  domain-age/WHOIS call as the authentic anchor (DECISIONS `0014` item C).

### 12.2 Pomerium — SECONDARY (co-primary prize target)

- **Role:** authorization boundary outside the agent — vendor-scoped machine identity on
  the PO route. A reverse proxy alone is insufficient; machine identity, exact-route
  policy, a private origin, and authorize logs are required.
- **Status:** origin assertion verification implemented (signature/issuer/audience/
  expiry/subject-to-path); live route and the two service accounts pending external
  configuration (`docs/integrations/POMERIUM.md`).
- **Proof required:** `403` + Pomerium/Envoy request ID + `allow:false` authorize log +
  absent origin request; then `201` with the vendor identity on the same route. An
  application-generated 403 never counts.

### 12.3 Nexla — meaningful coverage

- **Role:** FlexFlow (GA — not MCP Studio, which is Early Access same-day risk,
  DECISIONS `0005`) transforms an actual inventory record into the frozen schema v1.1
  `stockout_risk` contract and posts it to `POST /api/events/stockout`.
- **Status:** authenticated ingress implemented; external FlexFlow configuration pending.
- **Proof required:** the Nexla event ID preserved as the correlation ID in the decision
  trace. Setting `source: "nexla"` in local code is **not** integration.

### 12.4 Akash — coverage only

- **Role:** host the existing immutable container after the core proof is green.
- **Status:** Docker image + SDL example implemented; lease pending. Never on the
  critical demo path; no persistent-SQLite/custom-domain/multi-region investment.
- **Proof required:** active lease + public URL + image digest recorded in
  `docs/integrations/AKASH.md`.

### 12.5 Claude / Anthropic — P2 behind ports

- **Role:** planner/explainer behind the deterministic loop ports; may rank eligible
  options or explain evidence; may never mint a capability or override policy.
- **Status:** pending — the current loop is deterministic and port-driven; do not
  describe it as a live Claude Agent SDK integration.
- **Proof required:** model tool-call trace without authorization authority.

### 12.6 StableEmail — pending and optional

- **Role:** deliver the accepted PO after authorization (the honest replacement for
  Fillmore, DECISIONS `0004`).
- **Proof required:** Zero receipt + returned message ID + received message. Fallback:
  a disclosed non-Zero email path, never claimed as a Zero tool (DECISIONS `0014` item D).

### 12.7 Blueprint reconciliations adopted (DECISIONS `0014`, all P2)

(A) AWS Bedrock behind the planner/explainer port — adds the Amazon/AWS surface;
explainer-only; (B) labeled real-artifact replay mode — flake-proof recording, honest
because disclosed and the artifacts are genuine; (C) the named real WHOIS/domain-age
paid Zero call as the typosquat anchor; (D) StableEmail-primary + disclosed fallback.
Sequencing: P1 live Zero → Pomerium slice first, then C, then A/B/D.

### 12.8 Rejected tools and approaches (do not re-propose)

| Rejected | Why | Decision |
|---|---|---|
| Fillmore for PO drafting/sending | Recruiting-only (verified 3-0); domain mismatch a Metaview judge won't reward | `0004` |
| Mocked "verified supplier registry" / credit-bureau / fraud-score via Zero | Does not exist in Zero's catalog; a fake registry fakes the exact moment Zero judges scrutinize and guts the honest-trust-layer pitch | `0003` |
| Self-hosted x402-priced KYB endpoint | Same class as the fake registry; a real payment for self-authored evidence is weak verification | `0003`/`0014` |
| Nexla MCP Studio on the day | Early Access, same-day integration risk; FlexFlow is GA | `0005` |
| Forced Akash GPU/compute angle | Not needed; "we hosted a container" honesty stands | `0005` |
| Python/Flask/Streamlit rewrite | Discards the green TypeScript slice with hours left | `0014` |
| LLM emits the PASS/BLACKLIST verdict | Reverses `0008`; the deterministic policy adjudicates | `0008`/`0014` |
| "Fraud dollars blocked" / "inventory refills" wording | Violates committed invariants | `0014` |
| Shared agent identity for all vendors; attestation-header-presence auth; app 403 as proxy proof | Breaks the identity model | `0007` |
| ProcureLoop rename | Continuim stands | `0006`/`0013`/`0015` |

---

## 13. Honest State Model & Non-Claims

### 13.1 Surface-by-surface state

| Surface | Local development | Prize recording |
|---|---|---|
| Evidence | Synthetic `.example` fixtures, cost $0, labeled fixture | Paid Zero calls with receipts |
| Authorization | Signed origin guard (`development`) | Pomerium service identity + signed origin guard |
| Trigger | Always-on monitor after deterministic spare consumption | Nexla event ID through FlexFlow |
| Email | Pending/disabled unless adapter exists | StableEmail receipt + message ID |
| Hosting | Local npm or Docker | Akash only if already stable |

Fixture and live modes must be visible in the dashboard. No fallback may silently change
`live_zero` to fixture (DECISIONS `0010`).

### 13.2 Non-claims (binding, from every doc in the system)

- The system does not prove criminal fraud; the planted candidate is "high-risk /
  ineligible," never "proven fraudulent."
- Missing news, a young domain, or an unanswered phone alone are not decisive.
- The LLM does not adjudicate eligibility.
- The demo does not pay the supplier; a PO does not physically refill inventory
  (`inbound_scheduled` only).
- Pomerium does not validate the custom attestation; it validates machine identity. The
  Continuim origin validates the attestation.
- Candidate sourcing is synthetic unless a real source is added and shown.
- No credit-bureau, supplier-registry, fraud-score, or bank-account-ownership claim
  exists without a pinned live provider and captured receipt.
- The illustrative downtime rate is scenario input, not a measured customer loss.
- A development-origin `403` is not Pomerium proof; a local `source: monitor` event is
  not Nexla proof; fixture evidence is not paid Zero evidence.
- BEC/procurement-fraud industry statistics are unverified pending citation (§3.3) and
  must not appear in stage or submission copy until cited.

### 13.3 External-artifact requirements (DECISIONS `0010`)

Zero → receipts; Pomerium → authorize logs + request ID; Nexla → event ID in the trace;
StableEmail → message ID + received message; Akash → lease + URL. Environment labels and
`source` fields are never proof. `npm run doctor:prize` fails closed until the required
configuration and service lock exist.

---

## 14. Demo Plan

> This section is the demo script referenced by `CLAUDE.md` and
> `docs/STRATEGY-LEDGER.md` as "the 3-minute demo script in `docs/PRD.md`" (formerly
> §9). The full word-for-word script lives in `docs/DEMO.md`; this summarizes and binds it.

### 14.1 The three-minute script (datacenter default)

Pre-flight: `npm run doctor:prize` and `npm run check` pass; dashboard reads **Live
Zero** and **Pomerium** (not Fixture/Development); the Pomerium authorize log and the
received PO email are open in separate tabs; record one continuous take.

| Time | Beat | What is shown |
|---|---|---|
| 0:00–0:15 | **Hook** | "A datacenter incident has consumed its replacement memory. Continuim watches the spares pool, buys the recovery part, and keeps authorization outside the model." |
| 0:15–0:40 | **Autonomous trigger** | Click **Simulate node failure** until the final safe spare is consumed, then hands off. Monitor last-check time ticks; `stockout_risk` appears with no run action. Show the Nexla event ID if live; otherwise disclose the local monitor. State that vendors are disclosed synthetic candidates. |
| 0:40–1:00 | **Load-bearing denial** | Agent submits the cheaper lookalike plan with the authenticated general-agent identity. Pomerium `403`: request ID + `allow:false` authorize log; no matching origin request. |
| 1:00–1:40 | **Paid observation** | Agent replans and buys evidence through Zero: exact service names, prices, wallet delta, receipt IDs. Policy marks the lookalike **ineligible** from combined contradictions — not legal fraud from domain age alone. |
| 1:40–2:10 | **Capability and recovery** | Second candidate passes. Attestation summary: vendor, payee, quote, amount cap, evidence hash, expiry, nonce. Retry with the vendor-scoped Pomerium identity → `201`. |
| 2:10–2:35 | **Outcome** | PO ID; StableEmail message ID if live; "20 units inbound scheduled." On-hand stays 0 — a PO is not physical receipt. |
| 2:35–3:00 | **Close** | Two numbers: paid evidence cost vs **$2,400 at-risk PO value prevented**. "It noticed the shortage, recovered without another human action, and rejected a plan that lacked authority. Zero makes fresh evidence economical. Pomerium makes the result enforceable." |

### 14.2 Optional closer — same loop, any industry (only if under time)

Flip the scenario dropdown from **datacenter** to **apparel** (navy dye, halted line) and
say one line: "Same engine, different industry — the item and vendors are seed data; the
loop and its authorization boundary never change." Do **not** run a second full loop on
stage; the toggle plus one sentence is the whole beat. Never run apparel live before the
datacenter slice has passed twice.

### 14.3 Fallback rules

- Zero service fails → substitute another already-settled service from the lock; never
  switch silently to fixture evidence.
- No Pomerium authorize log → do not claim a live Pomerium denial.
- Nexla or Akash unavailable → disclose the local fallback; never simulate the sponsor
  surface.
- StablePhone/StableEmail are optional whenever they threaten the core Zero + Pomerium
  proof.

### 14.4 Demo acceptance checklist

- `npm run doctor:prize`, `npm run check`, and `npm run build` pass.
- Dashboard says Live Zero and Pomerium.
- The denied request has a matching Pomerium log and no origin request.
- ≥3 Zero service receipts visible; an ineligible vendor receives no capability.
- The eligible PO binds the exact payee and amount and returns `201`.
- The dashboard reads "at-risk PO value prevented" and "inbound scheduled."
- The complete run fits the script above / `docs/DEMO.md`; run the timed demo twice
  before recording.

---

## 15. Approved Extensions & Roadmap

### 15.1 Demand-audit / protected-purge branch (approved, deferred — DECISIONS `0012`)

Design: `docs/superpowers/specs/2026-07-17-two-branch-governance-design.md`. The
flywheel: monitor detects a critical SKU hitting zero in an anomalous window → freeze
fulfillment → paid demand audit on the order burst → deterministic branch: purge
fraudulent orders under a signed `PurgeCapability` (shelves restored for $0) or, when
demand is real and stock is still below threshold, run the existing verified-procurement
loop. Planted numbers make both branches fire: capacity 10, threshold 3, 6-order bot
cluster + 4 legit orders → purge restores 6, releasing 4 leaves 2 (< 3) → restock PO.
New contracts (`CustomerOrder`, `BuyerEvidenceKind`, `DemandVerdict`,
`PurgeCapability`, new decision phases), `demandPolicy.ts`, an extended
protected-actions API (`POST /orders/purge`), and a fulfillment-queue dashboard panel.
**Deferral condition:** implement only after live Zero + Pomerium proof is green; buyer
evidence stays fixture-labeled (Zero has no consumer device-reputation feed — `0003`);
never ship an unprotected purge; never let the branch destabilize the procurement slice.

### 15.2 Bedrock planner/explainer adapter (approved P2 — DECISIONS `0014` A)

`@aws-sdk/client-bedrock-runtime` Converse with the cross-region
`us.anthropic.claude-haiku-4-5-*` inference-profile id (the bare `anthropic.*` id
throws "on-demand throughput isn't supported"); Anthropic-key fallback. Done when the
Bedrock reasoning renders next to the policy verdict, policy wins on disagreement, and
the disagreement is logged. Stays in TypeScript.

### 15.3 Real-artifact replay mode (approved P2 — DECISIONS `0014` B)

Capture real receipts / tx hashes / Pomerium authorize logs / model output during a
green run; replay them for the recording behind a clearly-badged `live | replay`
dashboard indicator. Replay only plays back captured genuine artifacts, never invents
them; `doctor:prize` still distinguishes the modes.

### 15.4 Roadmap summary (mirrors `docs/ROADMAP.md`)

- **Foundation:** all ten boxes ticked 2026-07-17 (contracts, policy, attestation,
  replay defense, loop, state+dashboard, setup/doctor/Docker, Nexla ingress, monitor,
  scenario engine).
- **Prize-critical integration (open):** Zero service lock + adapter (Owner 2);
  Pomerium accounts + PPL + logs (Owner 3); full live slice (Owners 1+3); Nexla
  FlexFlow event ID (Owner 4).
- **Optional after core proof (open):** demand-audit branch; Claude Agent SDK adapter;
  cited downtime input; StableEmail; StablePhone; Akash.
- **Submission (open):** doctor:prize + build + timed demo twice; record; artifact IDs
  into runbooks; push demo-stable to `main`; Devpost.

---

## 16. Risks & Mitigations

| Risk | Likelihood/impact | Mitigation |
|---|---|---|
| Zero catalog drifted since research; a chosen service doesn't exist or settle | Medium / High | Re-verify `zero.xyz/browse` before relying on any tool (standing protocol); pin only after one settled call; substitute another settled service on failure — never fixture silently |
| Pomerium route/service accounts not configured in time | Medium / High | 60-minute time gate; the local slice still demos with the development guard, disclosed honestly — the Pomerium *claim* is simply not made |
| Venue network flakiness during recording | Medium / High | Approved replay mode (§15.3) with genuine captured artifacts, clearly badged; record early (45-min gate) |
| Nexla FlexFlow configuration stalls | Medium / Low | Coverage only; disclosed local monitor fallback (`source: monitor`); cut before Zero/Pomerium |
| StableEmail unavailable | Medium / Low | Optional; disclosed non-Zero fallback path never claimed as a Zero tool |
| Clock pressure tempts scope creep (demand audit, learning polish) | High / High | Cut order (§2.3); feature freeze 75 min out; demo-first scope rule; deferred branch stays deferred |
| Concurrent edits destabilize the green slice (4 owners + concurrent learning build) | Medium / High | Frozen contracts; owner path boundaries; `npm run check` before merge; `main` fast-forwarded only after green integration on `dev` |
| Overclaiming under stage adrenaline | Medium / High | Non-claims list (§13.2) and "claims to avoid" in `docs/DEMO.md` rehearsed; metric wording fixed |
| Horizontal scaling of the origin breaks nonce/idempotency | Low / Medium | Documented constraint: process-local maps; do not scale horizontally without a shared transactional store |
| Secrets leak into commits or decision events | Low / High | Pre-commit hook rejects `.env*`/keys; metadata rules ban tokens/assertions/PII |

---

## 17. Team & Workflow

### 17.1 Ownership (four owners, parallel after `npm run setup`)

| Owner | Paths | Definition of done |
|---|---|---|
| 1 — Agent Core | `services/agent`, Claude adapter under `services/control-plane` | consumes ports, replans after 403, no auth decisions in model output |
| 2 — Zero Verification | `services/verification`, `config/zero-services.json` | real normalized signals with receipts; eligible attestation only |
| 3 — Policy + Procurement | `services/procurement`, `infra/pomerium`, `deploy/akash` | real proxy deny/allow proof; private origin; no replay; StableEmail adapter |
| 4 — Dashboard + Data | `apps/dashboard`, Nexla setup, `docs/DEMO.md` | one-screen story; real event ID; timed recording |

The local control plane is integration scaffolding, not a fifth owner. Each owner
replaces a port without changing the contracts; contract changes require all four owners
to acknowledge.

### 17.2 Branch model and commands (CONTRIBUTING.md, CLAUDE.md)

`main` = demo-stable (fast-forwarded only after a green integration on `dev`); `dev` =
integration; owners work on `feat/<owner>-<task>` and merge via quick review with
`npm run check` green. Never push to `main` mid-build; never force-push `main`; never
`git add .` unreviewed. First run: `npm run setup && npm run doctor && npm run check &&
npm run dev` (Node.js ≥ 22.10, npm ≥ 10; dashboard at `http://localhost:3000`).

### 17.3 Documentation cadence (same-commit, never batched)

Append to `docs/CURRENT_STATE.md` (with commit hashes/sources) in the same commit as any
major change; tick the matching `docs/ROADMAP.md` box in that same commit; update
`docs/PROJECT_STATUS.md` when a summary-level fact changes; record every live
integration proof in its runbook before claiming it. Errors → `logs/errors.jsonl`;
repeated classes → `docs/lessons_learned.md`. Settled calls → `logs/DECISIONS.jsonl`
then `docs/STRATEGY-LEDGER.md`.

---

## 18. Decision Index (logs/DECISIONS.jsonl — one line each)

| ID | Decision (all 2026-07-17) |
|---|---|
| `0001` | Adopted the starter-pack anti-drift doc system; immutable layer enforced below the agent. |
| `0002` | Concept = Aegis, a procurement trust loop (rescue + fraud defense fused); Concepts A/B/C and pure-software ideas rejected. *(Superseded in part by 0006.)* |
| `0003` | Paid verification only on Zero tools that provably exist and settle; no mocked registry; verdict composed from enrichment + domain-age scrape + news + optional AI call. |
| `0004` | Fillmore dropped (recruiting-only); PO email via StableEmail. |
| `0005` | Tool roles fixed: Zero + Pomerium prize targets; Nexla via FlexFlow GA (not MCP Studio EA); Akash coverage only. *(Superseded in part by 0007.)* |
| `0006` | Public name is Continuim; thesis is policy-enforced agentic procurement. Supersedes 0002's naming. |
| `0007` | Pomerium enforces vendor-scoped machine identity; origin enforces object binding; shared identities and app-403-as-proxy-proof rejected. Supersedes 0005 in part. |
| `0008` | Deterministic three-outcome verification; hard failures = payee mismatch/typosquat; LLM explains, never adjudicates. Supersedes 0003 in part. |
| `0009` | The self-correction 403 is a pre-verification authorization denial, not a forced post-blacklist purchase. |
| `0010` | Every sponsor mode requires an external artifact; silent fixture fallback rejected; `doctor:prize` fails closed. |
| `0011` | Local demo is self-starting and critical-spares-first; monitor source labeled `monitor`, never Nexla proof. |
| `0012` | Demand-audit/purge branch approved but deferred until core sponsor proof is green. Supersedes 0006 in part. |
| `0013` | Hero = autonomous emergency-procurement loop; fraud defense = built-in trust subset; engine horizontal via locked datacenter + apparel profiles behind one toggle. |
| `0014` | External blueprint reconciled: adopt Bedrock explainer / replay mode / WHOIS anchor / StableEmail-fallback behind existing ports (all P2); reject Python rewrite, LLM verdicts, x402 KYB, dishonest wording. |
| `0015` | ProcureLoop three layers absorbed: Hero Runway / Secondary Guardrail / Learning Layer (append-only incident ledger, `recalled_history`, proven-vendor preference); learning never bypasses the evidence gate or the signed capability. |

---

## 19. Glossary

- **Attestation (`VendorAttestation`)** — the HMAC-signed object capability minted only
  for an eligible vendor, binding vendor/domain/SKU/payee/account/quote/price/quantity/
  amount/evidence-hash/currency/nonce/policy-version/expiry. The thing that makes "the
  agent cannot be unauthorized" literal.
- **At-risk PO value prevented** — the committed stage metric: the dollar value of the
  PO the ineligible vendor would have received ($2,400 datacenter / $18,000 apparel).
  Never phrased as "fraud dollars blocked."
- **Capability** — synonym for the attestation viewed as authority: vendor-scoped,
  quote-scoped, payee-bound, amount-limited, expiring, single-use.
- **Compound failure** — `domain_age_days < 30` combined with `web_presence = false`;
  ineligible even without a hard failure.
- **Decision event / phase** — the append-only trail entry (`DecisionEvent`) with its
  `DecisionPhase` (from `observed` through `inbound_scheduled`, including
  `recalled_history`).
- **`doctor:prize`** — `npm run doctor:prize`, the fail-closed recording gate for live
  sponsor claims.
- **Evidence hash** — SHA-256 over vendor identity, quote ID, and the full signal set;
  bound into attestation and PO so evidence cannot be swapped after the verdict.
- **`evidenceMode`** — `fixture | live_zero`; a bundle containing any fixture signal is
  `fixture`. Visible in state, UI, and every verdict.
- **Fixture** — disclosed synthetic evidence/vendors (`.example` domains, $0 cost,
  "Continuim fixture" provider); never presentable as live Zero.
- **Hard failure** — `payee_identity_match = false` or `typosquat_detected = true`;
  immediately ineligible regardless of score.
- **Hero Runway / Secondary Guardrail / Learning Layer** — the three product layers
  (DECISIONS `0015`; §4.2).
- **Incident ledger (`IncidentRecord`)** — the append-only per-run record powering the
  Learning Layer: timing, vendors, spend, PO value, prevented value, evidence mode.
- **`inbound_scheduled`** — what an accepted PO means: stock is scheduled inbound.
  On-hand inventory changes only on a later receipt event.
- **Idempotency key** — dedupes retries of the same PO request — but only *after*
  authorization is re-verified (authorization-before-idempotency).
- **Nonce (`authorizationNonce`)** — single-use value inside the attestation; one nonce
  can never create two POs.
- **Object binding** — the origin's field-by-field equality/ceiling check between the
  `PurchaseOrderRequest` and the attestation.
- **Pomerium assertion (`X-Pomerium-Jwt-Assertion`)** — Pomerium's signed identity
  JWT, verified at the origin (signature/issuer/audience/expiry/subject) with
  `sub == vendor:<vendorId>` bound to the URL path.
- **PPL** — Pomerium Policy Language; the exact subject-method-path allow rule in
  `infra/pomerium/vendor-policy.example.yaml`.
- **Prize mode / local mode** — the two honest operating states (§7.6, §13.1);
  `AUTH_MODE=pomerium|development`, `VERIFICATION_MODE=live_zero|fixture`.
- **`recalled_history`** — the decision phase a later run emits when it skips the
  already-learned unattested probe by citing a prior incident (learning may skip the
  probe, never the gate).
- **Receipt ID** — the settlement/provider receipt attached to every paid Zero signal;
  paid signals without one are refused; cost is deduplicated per receipt.
- **Replay mode** — the approved, clearly-badged playback of previously captured
  *genuine* artifacts for recording reliability (DECISIONS `0014` B).
- **Scenario profile (`ScenarioProfile`)** — the seed-data unit of horizontality: item
  (SKU, quantities, illustrative downtime) + disclosed vendor pair
  (`services/verification/src/scenarios.ts`; `datacenter` | `apparel`).
- **Schema v1.1** — the frozen contract version across all five seams
  (`SCHEMA_VERSION` in `packages/contracts/src/index.ts`).
- **Service lock (`config/zero-services.json`)** — the record of Zero services pinned
  after one settled call each (ID, price, receipt, latency); `verifiedAt` stays null
  until then.
- **Stockout risk event (`StockoutRiskEvent`)** — the versioned trigger contract emitted
  identically by the local monitor (`source: monitor`) and Nexla (`source: nexla`).
- **Typosquat** — the lookalike-domain pattern (e.g. `Distributi0n`, `C0.`) the planted
  vendors carry; a hard failure, anchored in live mode by a real domain-age/WHOIS call.
- **Vendor-scoped identity** — the `vendor:<vendorId>` Pomerium service account released
  only for an eligible vendor, allowed only on its exact path.
- **`vendor-risk-v1`** — the deterministic verification policy version
  (`VERIFICATION_POLICY_VERSION`).

---

*This PRD supersedes the previous `docs/PRD.md` in structure while preserving its every
commitment; the prior document's P0/P1/P2 lists, honest state model, non-claims,
security model, tool strategy, time gates, and demo acceptance criteria are carried
forward verbatim-in-substance in §§11, 13, 8, 12, 11.3, and 14.4 respectively.
Maintained per the doc-system rules in `CLAUDE.md`: update deliberately as scope
settles; never let it drift from the frozen contracts.*
