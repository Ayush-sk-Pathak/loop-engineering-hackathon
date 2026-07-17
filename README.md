# Aegis 🛡️ — the autonomous procurement agent that can't be scammed

> **Loop Engineering Hackathon · 2026-07-17.** An autonomous stockout-rescue procurement
> agent that verifies every supplier with real, paid checks *before* it is allowed to
> spend a cent — so it **cannot be scammed**.

> **The pitch:** *Everyone here gave an AI agent a wallet today. We built the reason you can.*

![Aegis architecture — an agent that verifies suppliers with real paid Zero.xyz checks, then a Pomerium gate blocks any payment to an unverified vendor](docs/assets/architecture.svg)

---

## The problem

Procurement fraud and vendor impersonation cost businesses billions (FBI IC3 pegs Business
Email Compromise near **~$2.9B/yr**; vendor-impersonation / "our bank details changed" scams
are its largest slice). The moment of **maximum vulnerability is a stockout emergency** —
revenue is bleeding every second an item is out of stock, so a rushed buyer (human *or* an
autonomous agent) skips due diligence and wires money to the first vendor that answers.

> *"Stockouts lose revenue every second — but rushing the fix is how you wire $40k to a fake supplier."*

## The solution — a procurement **trust loop**

An agent whose loop has fraud defense built into every step, and whose ability to spend is
**physically gated** on verification passing. It maps 1:1 to the hackathon theme
(plan → act → observe → self-correct):

1. **Observe / trigger** — a hot SKU crosses its safety threshold → `stockout_risk` (Nexla).
2. **Plan** — rescue the SKU; verify every candidate before any money moves.
3. **Act – source** — produce 2 backup vendors (1 legit, 1 planted fraud: typosquatted
   domain, ~2-week-old registration, no footprint).
4. **Act – verify (paid)** — the agent **spends real USDC via Zero.xyz** on: business
   enrichment, domain-age scrape, adverse-media news, and an **AI phone call** to the vendor.
5. **Observe + self-correct** — the fraud vendor fails → the agent **blacklists it, logs why,
   and re-sources.** It never proceeds on a rejected vendor.
6. **Act – gate & order** — the PO goes through **Pomerium**, which authorizes it **only if
   the vendor holds a valid verification attestation.** Unverified → **`403`.** Verified →
   PO placed (StableEmail), inventory refills.

**Defense in depth (the core bet):** the agent's LLM reasoning is the *soft* layer; Pomerium
is the *hard* layer. **Even if the agent's reasoning is wrong or prompt-injected, the payment
API physically rejects an unverified vendor.** That property is a live, provable demo beat.

## Sponsor tools (only genuine fits)

| Tool | Role | Prize |
|---|---|---|
| **Zero.xyz** ⭐ | Agent **wallet** + the **paid verification loop** (enrichment, domain-age scrape, adverse-media, AI call) + PO email (StableEmail); pays per-call in USDC on Base (x402). | Primary — $2,000 |
| **Pomerium** ⭐ | Identity-aware gate on the payment/PO API; policy = *attested-vendors-only*; unverified → `403` at the proxy. | Secondary — $1,000 |
| **Nexla** | FlexFlow (GA) real-time inventory stream → the stockout trigger. | Coverage |
| **Akash** | Hosts the containers (honest: coverage, not the critical path). | Coverage |
| **Claude** | Agent brain (Claude Agent SDK — reasoning + tool-calling). | — |

> Deliberately **not** used: **Fillmore** (recruiting-only — can't draft POs), and any
> credit-bureau / registry / fraud-score "lookup" (verified absent from Zero's catalog).
> We assemble the fraud verdict from Zero tools that genuinely exist and settle real money —
> **no mocked verification vendor.** See [`docs/STRATEGY-LEDGER.md`](docs/STRATEGY-LEDGER.md).

## Architecture / Infrastructure

`services/procurement` (the thing that moves money) **has no route except through Pomerium** —
so the agent cannot bypass the gate even if compromised. That network boundary *is* the product.

<details>
<summary>Text version of the topology (fallback)</summary>

```
                          PUBLIC EDGE                          |          INTERNAL NETWORK (not publicly routable)
                                                               |
  ┌──────────────┐         ┌────────────────────┐             |   ┌──────────────────┐
  │  Judge/Demo  │──HTTP──▶│  Dashboard (Next.js)│             |   │ services/agent   │
  │   browser    │         │   apps/dashboard    │─────────────────▶│  (Claude Agent   │
  └──────────────┘         │   :3000  (public)   │◀──SSE trail──────│   SDK loop)      │
                           └────────────────────┘             |   │  :4000           │
                                                               |   └───┬───────┬──────┘
  ┌──────────────┐                                             |       │       │
  │  Nexla       │──webhook: stockout_risk────────────────────────────▶│       │ verify(vendor)
  │  FlexFlow    │   (fallback: services/inventory poller)     |       │       ▼
  └──────────────┘                                             |       │   ┌──────────────────┐
                                                               |       │   │ services/verify  │──x402──▶ Zero.xyz
                    ┌───────────────────────────┐             |       │   │  :4100            │  (enrichment,
  ┌──────────────┐  │   POMERIUM  (proxy)       │             |       │   │  mints attestation│   scrape, news,
  │ services/    │  │   :8443  identity-aware   │             |       │   └────────┬─────────┘   StablePhone/Email)
  │ agent        │──┼─▶ POST /po ──┐            │             |       │            │ writes
  └──────────────┘  │   policy: attested?       │             |       │            ▼
     (the ONLY      │   ├─ yes → forward ───────┼─────────────────────┼──▶ ┌──────────────────┐   ┌──────────┐
      way to reach  │   └─ no  → 403 (blocked)  │             |       └───▶│ services/        │──▶│  SQLite  │
      procurement)  └───────────────────────────┘             |            │ procurement :4200│   │  data/   │
                          ▲ external authz check               |            │ (payment/PO API) │   │  *.db    │
                          └─── reads attestation store ────────────────────│  StableEmail PO  │   └──────────┘
                                                               |            └──────────────────┘
```

</details>

**The five interface seams** (freeze first, then build against mocks in parallel):
`stockout_risk` → `verify(vendor)→verdict` → `attestation` → `POST /po → 200|403` → `decision_event`.

**Full detail:** [`docs/infrastructure.md`](docs/infrastructure.md) — topology, the
Pomerium `403` request path step by step, the Zero x402 paid-call plumbing, secrets, and
local-vs-Akash deployment.

## Repo layout

```
apps/dashboard/          storefront + ops dashboard (decision trail, $ counter)
services/agent/          the plan→act→observe→self-correct loop (Claude Agent SDK)
services/verify/         Zero.xyz paid checks → verdict + attestation
services/procurement/    payment/PO API — reachable ONLY through Pomerium
services/inventory/      Nexla FlexFlow trigger (+ local poller fallback)
packages/contracts/      shared TS types for the 5 seams + mocks
deploy/akash/            Docker Compose → Akash SDL
docs/                    PRD, architecture, infrastructure, strategy ledger, status, roadmap
```

## Quickstart (local — the reliable demo path)

```bash
# prerequisites: Docker, a funded Zero wallet at ~/.zero/config.json, an Anthropic API key
cp .env.example .env          # fill in ANTHROPIC_API_KEY, NEXLA_TOKEN, ATTESTATION_SIGNING_KEY, ...
docker compose up --build     # dashboard :3000, Pomerium :8443; internal services not exposed
# open http://localhost:3000 → drop the hot item's stock to 0 → watch the loop run
```

> Only the **Zero paid calls** and the **Pomerium `403`** are truly live; the storefront,
> the two planted vendors, and the trigger are deterministic so the demo can't flake.

## The team (4 owners)

1. **Agent Core** — the loop + `403` recovery. 2. **Zero Verification** — wallet + real paid
checks + attestation. 3. **Pomerium + Procurement API + Akash** — the hard backstop + hosting.
4. **Dashboard + Nexla + Demo** — storefront, decision trail, $ counter, the recording.
See [`docs/PRD.md §10`](docs/PRD.md).

## Docs map

- [`docs/PRD.md`](docs/PRD.md) — the full plan (hackathon, requirements, demo script, team).
- [`docs/architecture.md`](docs/architecture.md) — the binding design blueprint.
- [`docs/infrastructure.md`](docs/infrastructure.md) — this system, end to end.
- [`docs/STRATEGY-LEDGER.md`](docs/STRATEGY-LEDGER.md) — settled decisions + rejected options.
- [`START-HERE.md`](START-HERE.md) — session reading order · [`CLAUDE.md`](CLAUDE.md) — the constitution.
