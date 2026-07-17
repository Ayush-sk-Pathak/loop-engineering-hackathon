# StockShield Product Requirements

**Event:** Loop Engineering Hackathon, 2026-07-17. **Submission:** 4:30 PM.
**Primary prizes:** Best Use of Zero.xyz; Most Innovative Use of Pomerium.

## Product

StockShield is a policy-enforced autonomous procurement loop for critical-infrastructure
stockout emergencies.

> An agent may be wrong, but it cannot be unauthorized.

An always-on monitor observes the spares pool and wakes the agent at a critical threshold.
The agent evaluates vendor candidates, buys current evidence, and replans. A deterministic
verifier can mint a constrained vendor capability. Pomerium enforces the machine identity at
the network boundary, and the private origin independently verifies the signed capability and
PO object bindings.

This is not a general fraud detector. It is a vendor-risk control and authorization system.

## Judging Thesis

| Criterion | What must be visible |
|---|---|
| Idea | Fast critical-spares recovery without making emergency purchasing ungoverned |
| Technical | Identity and signed object-capability checks outside the LLM; replay defense |
| Tool use | Real Zero receipts and real Pomerium authorize logs, not sponsor logos |
| Presentation | One continuous denial -> evidence -> replan -> accepted PO story |
| Autonomy | Monitor detects the threshold and starts the loop; no separate run action |

The differentiated angle is a self-starting recovery loop with policy-enforced agentic
spending. The monitor makes the autonomy visible; the independent authorization boundary
makes it safe to delegate.

## User Flow

1. A failed node consumes the last safe ECC memory spare.
2. The always-on local monitor emits schema v1.1 `stockout_risk` without a run button. In the
   sponsor path, Nexla FlexFlow emits the same contract with a Nexla event ID.
3. The agent ranks two disclosed synthetic candidates by fulfillment and price.
4. It submits the cheapest plan using the authenticated general-agent identity.
5. Pomerium returns `403`; the request never reaches the procurement origin.
6. The agent observes the missing vendor capability and buys independent evidence via Zero.
7. The deterministic policy marks the lookalike candidate `ineligible` and blacklists it for
   the run. It continues without human intervention.
8. A consistent candidate receives a signed attestation bound to vendor, domain, SKU, payee,
   account reference, quote, unit price, quantity/amount ceiling, evidence, expiry, and nonce.
9. The agent retries through the same Pomerium route using the vendor-scoped service identity.
10. The private origin verifies both layers, records the PO, and schedules inbound stock.
11. StableEmail sends the PO only when its live Zero adapter is configured.

## Honest State Model

| Surface | Local development | Prize recording |
|---|---|---|
| Evidence | Synthetic `.example` fixtures, cost `$0` | Paid Zero calls with receipts |
| Authorization | Signed origin guard | Pomerium service identity + signed origin guard |
| Trigger | Always-on monitor after deterministic spare consumption | Nexla event ID through FlexFlow |
| Email | Pending/disabled unless adapter exists | StableEmail receipt and message ID |
| Hosting | Local npm or Docker | Akash only if already stable |

Fixture and live modes must be visible in the dashboard. No fallback may silently change
`live_zero` to fixture mode.

## Functional Requirements

### P0: Submission-Critical

- One command creates a safe local environment; one command starts the stack.
- The five shared contracts compile across every workspace.
- A critical threshold wakes the agent and runs end-to-end without a separate start action.
- The monitor does not retrigger while a run is active or inbound supply is scheduled.
- Required evidence classes produce `eligible`, `ineligible`, or `insufficient_evidence`.
- Rejected or insufficient candidates receive no attestation.
- A missing capability is denied before PO creation.
- A valid capability cannot be replayed for a second order or changed across vendor, domain,
  payee, account, SKU, quote, price, quantity, amount, evidence, expiry, or nonce.
- Pomerium mode verifies its signed assertion and exact vendor subject-to-path binding.
- The dashboard shows monitor health, decision events, evidence mode/spend, enforcement
  mode/request ID, illustrative outage exposure, at-risk PO value prevented, and inbound
  scheduled quantity.
- A PO changes inbound scheduled inventory only, never on-hand inventory.

### P1: Sponsor Proof

- Pin at least three useful Zero services after one settled call each.
- Show exact service price, receipt, and wallet delta in the trace.
- Configure Pomerium general-agent and vendor-scoped service identities.
- Capture the denied request ID, `allow:false` log, and absent origin request.
- Deliver a real Nexla-transformed event to the implemented webhook.
- Send the accepted PO with StableEmail and capture its message ID.

### P2: Only After The Core Is Green

- Claude Agent SDK planner/explainer adapter behind the existing loop ports.
- StablePhone call if latency and consent are controlled.
- Akash deployment using an immutable image tag.
- Additional vendor-risk patterns.

## Non-Claims

- The system does not prove criminal fraud.
- Missing news, a young domain, or an unanswered phone alone are not decisive.
- The LLM does not adjudicate eligibility.
- The demo does not pay the supplier.
- A PO does not physically refill inventory.
- Pomerium does not validate the custom attestation; it validates machine identity. The
  StockShield origin validates the attestation.
- Candidate sourcing is synthetic unless a real source is added and shown.

## Evidence Policy

Required evidence classes are company identity, domain age, web presence, payee identity,
and typosquat result. Contact reachability and news are supporting signals.

Hard failures are payee mismatch or detected typosquatting. A young domain combined with no
web footprint is a compound failure. Other signals contribute to a versioned risk score.
Missing required classes yield `insufficient_evidence`.

An LLM may extract or explain provider output but cannot add an independent vote. If one
provider call produces several signals, all signals share its receipt and cost is counted
once.

## Security Model

The agent is not the vendor. A shared agent identity therefore cannot implement a
vendor-specific Pomerium policy.

Prize mode uses:

- A general `procurement-agent` service account that authenticates but fails the PO policy.
- A `vendor:<vendorId>` service identity released only for an eligible fixture vendor.
- A route limited to the exact vendor path and POST method.
- `X-Pomerium-Jwt-Assertion` verification at the origin.
- A signed StockShield attestation sent separately and verified at the origin.
- Authorization before idempotency, request fingerprint comparison, and one-time nonce use.

The procurement origin has no public route other than Pomerium in prize mode.

## Tool Strategy

**Zero.xyz is primary.** Its value is economically buying fresh independent evidence without
standing API subscriptions. The stage should compare evidence spend with governed PO value.
Use the live service lock; do not promise a provider based on the public catalog alone.

**Pomerium is secondary.** Its value is an authorization boundary outside the agent. A reverse
proxy alone is insufficient; machine identity, route policy, private origin, and authorize
logs are required.

**Nexla is meaningful coverage.** FlexFlow must transform an actual inventory record into the
frozen stockout contract. Setting `source: nexla` in local code is not integration.

**Akash is coverage only.** Deploy the existing container after the core proof is green.

## Team Plan

| Owner | Paths | Definition of done |
|---|---|---|
| Agent Core | `services/agent`, Claude adapter | consumes ports, replans after 403, no auth decisions in model output |
| Zero Verification | `services/verification`, service lock | real normalized signals with receipts; eligible attestation only |
| Policy + Procurement | `services/procurement`, Pomerium, Akash | real proxy deny/allow proof; private origin; no replay |
| Dashboard + Data | `apps/dashboard`, Nexla, demo | one-screen story; real event ID; timed recording |

All owners start with `npm run setup`, branch from `main`, and preserve schema v1.1. See
`CONTRIBUTING.md`.

## Time Gates

- **Within 30 minutes:** one settled Zero call and recorded receipt.
- **Within 60 minutes:** Pomerium returns a logged 403 and 201 on the same route.
- **Within 90 minutes:** complete live vertical slice reaches the dashboard.
- **75 minutes before submission:** feature freeze.
- **45 minutes before submission:** first complete recording and Devpost draft.

Cut in this order: dynamic sourcing, StablePhone, UI polish, StableEmail, Akash, then Nexla.
Never cut the real Zero receipt or real Pomerium denial because they are the prize thesis.

## Demo Acceptance

- `npm run doctor:prize`, `npm run check`, and production build pass.
- Dashboard says Live Zero and Pomerium.
- The denied request has a matching Pomerium log and no origin request.
- At least three Zero service receipts are visible.
- An ineligible vendor receives no capability.
- The eligible PO binds the exact payee and amount and returns `201`.
- The dashboard reads “at-risk PO value prevented” and “inbound scheduled.”
- The complete run fits the script in `docs/DEMO.md`.
