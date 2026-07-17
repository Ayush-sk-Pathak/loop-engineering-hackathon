# Aegis — Infrastructure (end to end)

> How the whole system is wired at runtime: the topology, every deployable unit, the
> exact request paths (including how the Pomerium `403` physically happens), the
> Zero.xyz paid-call plumbing, secrets, and local-vs-Akash deployment. The binding
> design shape is `docs/architecture.md`; this doc is the operational detail behind it.

## 1. Topology (what runs where)

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

**The single most important infra fact:** `services/procurement` (the thing that "moves
money") **has no public route and no direct internal route from the agent.** Its only
ingress is **through Pomerium.** So the agent cannot bypass the gate even if its reasoning
is compromised or prompt-injected — there is physically no network path to the payment API
except the proxy. Defense in depth at the network layer, not just in code.

## 2. Deployable units

| Service | Tech | Port | Reachable by | Responsibility |
|---|---|---|---|---|
| `apps/dashboard` | Next.js/React | 3000 (public) | anyone | Storefront + ops dashboard; live decision trail (SSE/websocket from the agent) + "$ fraud blocked / revenue saved" counter. |
| `services/agent` | Node/TS + Claude Agent SDK | 4000 (internal) | Nexla webhook, dashboard | The plan→act→observe→self-correct loop. Calls `verify`, calls `POST /po` **through Pomerium**, handles the `403` and self-corrects, streams decision events. |
| `services/verify` | Node/TS + Zero SDK/CLI | 4100 (internal) | agent | `verify(vendor) → verdict`. Runs the paid Zero checks, aggregates a verdict, **mints a signed attestation** on PASS. |
| `services/procurement` | Node/TS | 4200 (**internal only, behind Pomerium**) | **Pomerium only** | The payment/PO endpoint. On an authorized call: send PO via StableEmail, refill inventory. Never exposed directly. |
| `services/inventory` | Node/TS + Nexla FlexFlow | 4300 (internal) | storefront/db | Streams stock levels; emits `stockout_risk` on threshold breach. FlexFlow primary; local poller fallback. |
| **Pomerium** | Pomerium proxy | 8443 (public edge) | agent → procurement | Identity-aware reverse proxy; authenticates the caller and enforces the **attested-vendors-only** policy; unverified → `403`. |
| **SQLite** | file in `data/` | — | agent, verify, procurement, inventory | `products/inventory`, `vendors`, `blacklist`, `attestations`, `decisions`. (`data/` is git-ignored.) |

## 3. Critical path — a Pomerium-gated PO request, step by step

This is the crux: how the `403` happens at the wire level.

1. Agent decides to order from a vendor → `POST https://pomerium:8443/po` with body
   `{ vendorId, sku, qty }` and its own **caller identity** (service-account JWT / mTLS —
   proves *"this is the agent"*).
2. **Pomerium terminates the request first.** It authenticates the caller, then evaluates
   its policy (PPL). The authorization decision depends on whether the **target vendor is
   attested**.
3. To make the decision vendor-specific, Pomerium runs an **external authorization** check
   that confirms a valid, unexpired `verified` attestation exists for `vendorId`:
   - **No attestation (fraud vendor)** → deny → **Pomerium returns `403`; the request never
     reaches `services/procurement`.** The payment code does not run.
   - **Valid attestation (legit vendor)** → Pomerium forwards to `procurement:4200` →
     PO sent + inventory refilled → `200`.
4. The agent observes the `403`, reasons about the denial, keeps the vendor blacklisted, and
   retries with the verified vendor. (The on-stage self-correction beat.)

**Implementation options (pick by time budget):**
- **(A) Attestation-as-JWT — recommended.** `verify` mints a signed JWT per verified vendor
  `{vendorId, status:"verified", exp}`. The agent attaches that vendor's token to the `/po`
  call; a Pomerium policy requires a valid attestation claim matching the requested
  `vendorId`. The token *is* the proof — no shared DB read at gate time.
- **(B) External-authz sidecar.** Pomerium forwards to a tiny `/authz` service that queries
  the SQLite `attestations` table live. More "correct," slightly more wiring.
- **Fallback (if Pomerium eats the clock).** A thin forward-auth reverse proxy
  (Caddy/nginx `auth_request`, or a ~30-line Node proxy) enforcing the identical
  attested-only invariant. The *invariant* is what's judged — but wire real Pomerium if at
  all possible, since it is a prize target.

## 4. Zero.xyz plumbing (the paid loop)

- **Wallet/config:** `~/.zero/config.json` holds the funded wallet + a **hard spend
  ceiling**. Lives on the host, git-ignored (`.zero/`), mounted read-only into `verify`.
- **One paid check (x402):** call a Zero tool → provider returns **HTTP 402 + payment
  spec** → the Zero layer signs a **gasless USDC micropayment on Base (EIP-3009)** → retry
  with proof → receive data. Sub-2-second settlement, fractions of a cent. `verify` wraps
  each as `check() → { signal, evidence, costUSD }`.
- **The four checks (all real, ~cents total):** enrichment (Apollo/PDL — footprint),
  scrape+WHOIS (Firecrawl — domain age), news (serp — adverse media), StablePhone (AI call —
  live number?). Aggregate → `verdict`.
- **PO email:** a StableEmail Zero call from `procurement` after authorization.
- **Infra invariant:** every check must produce a **real wallet debit** (receipt captured so
  the dashboard shows the wallet ticking down). No mocked verification vendor — hard rule.

## 5. Trigger plumbing (Nexla)

- **Primary:** a Nexla **FlexFlow** (Kafka-backed, GA) reads the inventory feed; a threshold
  rule POSTs `POST /events { type:"stockout_risk", sku, currentQty, threshold }` to the agent.
- **Fallback:** `services/inventory` polls the SQLite inventory table and POSTs the identical
  event. Nexla is **not** on the critical path; the poller keeps the demo intact.

## 6. Data & secrets

- **Data:** one SQLite file under `data/` (git-ignored). Tables: `products/inventory`,
  `vendors`, `blacklist`, `attestations`, `decisions`. Deliberately trivial — it's a demo.
- **Secrets:** each service reads creds from its own `.env` (git-ignored + the pre-commit
  hook refuses staged `.env*`). Keys: Zero wallet (`.zero/`), attestation signing key (env),
  Pomerium identity/session secrets, Nexla API token, Anthropic API key. **Nothing sensitive
  is ever committed** — enforced below the agent (`CLAUDE.md §Enforcement`).

## 7. Deployment: local-first, Akash as bonus

- **Local dev + demo fallback:** `docker compose up` brings up all five services + Pomerium
  + the SQLite volume on one internal Docker network. Only `dashboard:3000` and
  `pomerium:8443` are published; `procurement` and the rest are internal-only. **The entire
  demo runs on the presenter's laptop** — the reliable path.
- **Akash (P2, coverage):** translate the compose file into an **Akash SDL**
  (`deploy/akash/deploy.yaml`), bid → deploy → public URI for the dashboard + Pomerium
  ingress. Honest: hosting a container is a weak Akash-prize case, so this is *coverage
  only* and **never the critical path**.
- **Trust boundaries:** public edge = dashboard + Pomerium; everything else on the internal
  network with no external route; procurement reachable *only* via Pomerium. That boundary
  is the product.

## 8. Live vs. staged (infra honesty)

- **Genuinely live (unfakeable):** the Zero paid calls (real USDC settlement) and the
  Pomerium `403`.
- **Deliberately staged (deterministic):** the storefront, the two planted vendors, the
  SQLite data, and the stockout trigger — so the demo can't flake while the two things judges
  care about stay real.
