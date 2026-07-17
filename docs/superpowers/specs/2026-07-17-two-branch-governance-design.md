# Design: Continuim Two-Branch Governance Loop (Monitor → Freeze → Audit → Purge-or-Procure)

**Date:** 2026-07-17 · **Status:** Approved extension; deferred until the core sponsor proof is green · **Extends:** DECISIONS 0007/0008 · **Supersedes in part:** 0006's rejection of demand-side auditing (user-directed fusion) · **New record:** DECISIONS 0012

## 1. What Continuim is (framing for ALL docs)

> **Continuim is an autonomous governance agent that sits between inventory
> systems and fulfillment lines. The moment a critical item hits zero, it
> freezes the fulfillment queue, runs a paid identity audit on the demand, and
> self-corrects: purging fraudulent orders to restore stock for $0 — or, when
> demand is real, buying from a backup supplier it has cryptographically
> verified. On the configured protected paths, a vendor PO or order purge is
> rejected unless its exact object carries a valid signed capability.**

The story order everywhere: **(1) stockout emergency → (2) autonomous detection
and triage ("is this demand even real?") → (3) the cheap rescue (purge, $0) →
(4) the safe spend (verified procurement)**. The wallet line closes, never opens.

### Judging-criteria mapping (docs must make this explicit)

| Criterion (20%) | Answer |
|---|---|
| Autonomy | Always-on monitor fires the loop unprompted; a deterministic policy decides the branch from disclosed evidence |
| Idea | Dual loss: phantom stockouts drive away real customers while bot demand tricks you into buying inventory you don't need; plus vendor fraud lands exactly when buying is rushed |
| Technical | Signed, quote-bound attestations; signed purge capabilities; nonce replay protection; deterministic policies |
| Tool Use (≥3) | Zero.xyz paid vendor evidence (and buyer evidence only if catalog-verified) · Pomerium gates both protected actions · Nexla-shaped event stream |
| Presentation | One arc, two beats (§7) |

## 2. The flywheel

```
[Monitor: critical SKU hits zero in anomalous window]
        │  StockoutRiskEvent (source: "monitor", Nexla-compatible)
        ▼
[Freeze fulfillment queue]            phase: fulfillment_frozen
        ▼
[Paid demand audit on order burst]    phase: auditing_demand   (Zero evidence)
        ▼
⚖️ Decision matrix (deterministic policy; agent narrates)
 ├─ FRAUD ORDERS → signed purge capability → Pomerium-gated purge
 │                 → shelves restored for $0                  phases: orders_purged, shelves_restored
 └─ REAL DEMAND remains / stock still below threshold
                 → existing verified-procurement loop          phases: sourced … attested, ordered
        ▼
[Release fulfillment; legit orders ship; inbound scheduled]    phase: fulfillment_released
```

Demo numbers are chosen so **both branches fire naturally**: capacity 10,
threshold 3; bot cluster ordered 6, legit customers ordered 4 → stock 0.
Purging 6 restores stock to 6; releasing 4 legit orders leaves 2 (< 3) →
procurement branch triggers a restock PO from the verified distributor.

## 3. Code changes

### 3.1 Contracts (`packages/contracts`)
- `CustomerOrder`: id, sku, quantity, buyerEmail, buyerIp, unitPriceCents,
  placedAt, status: `pending | held | purged | released`.
- `BuyerEvidenceKind`: `order_velocity_anomaly | email_identity_match |
  ip_proxy_detected | payment_identity_match` — reuses `EvidenceSignal` shape
  (kind/value/outcome/detail/source), so collectors and cost accounting are shared.
- `DemandVerdict`: status `fraudulent_demand | legitimate_demand | mixed |
  insufficient_evidence`, riskScore, reasons, signals, evidenceMode,
  totalCostCents, `flaggedOrderIds`.
- `PurgeCapability`: signed object binding `flaggedOrderIds` + sku + restoredQty
  + nonce + expiry (same HMAC scheme as `VendorAttestation`).
- New `DecisionPhase` variants: `fulfillment_frozen`, `auditing_demand`,
  `demand_fraudulent`, `demand_legitimate`, `orders_purged`,
  `shelves_restored`, `fulfillment_released`.
- Inventory item: `critical: boolean`, `stockoutCostCentsPerMinute` (generalizes
  the earlier downtime-cost field: lost revenue for retail, downtime for infra).
  `DemoState`: `monitor` block + `orders` list.
  `DemoMetrics`: + `capitalPreservedCents`, `chargebacksAvoidedCents`.
- `StockoutRiskEvent.source`: + `"monitor"`.

### 3.2 Monitor (`services/control-plane/src/monitor.ts`) — unchanged from approved design
Interval loop (default 2s, `MONITOR_INTERVAL_MS`); triggers iff critical item
at/below threshold ∧ no run in flight ∧ no inbound scheduled; try/catch per
tick; `MONITOR_ENABLED` toggle. Emits the Nexla-compatible event.

### 3.3 Demand audit (`services/verification`)
- `demandPolicy.ts`: deterministic per-order scoring mirroring `policy.ts` —
  hard fail on `payment_identity_match=false` or `ip_proxy_detected=true`;
  velocity + fresh-email add risk; per-order flag threshold; aggregate verdict.
  Signs a `PurgeCapability` over the flagged set when fraud is found.
- `buyerFixtures.ts`: planted order book (6-order bot cluster: same /24, day-old
  emails, one stolen-card identity mismatch; 4 legit orders) + fixture signals.
- `collector.ts` gains a buyer-evidence path with the same
  `fixture | live_zero` modes. **Honesty note carried into docs:** Zero's
  verified catalog has no consumer device-reputation feed (DECISIONS 0003);
  buyer signals run fixture-mode until the on-site catalog re-check, and any
  live wiring uses only tools that actually exist (e.g., person/email
  enrichment). Disclosed in the demo, never faked as a Zero purchase.

### 3.4 Protected actions (`services/procurement` — extended, not a new service)
- It already owns attestation verification + dev/pomerium modes; it becomes the
  gated **protected-actions API**: existing `POST /po/:vendorId` plus new
  `POST /orders/purge` requiring a valid signed `PurgeCapability`
  (signature, expiry, nonce single-use, order-set binding). Same enforcement
  story on both branches: *no capability, no mutation — 403.*

### 3.5 Orchestration (`services/agent` + control-plane)
- New `runGovernanceLoop(stockout, ports)`: freeze → audit → branch:
  purge (via protected-actions API) → restore stock → release holds → if still
  below threshold, call the existing `runProcurementLoop` unchanged.
- Control-plane store: `orders` table; freeze/release/purge mutations; restored
  quantities update inventory; metrics computed (chargebacks avoided = value of
  purged orders; capital preserved = wholesale cost of inventory NOT bought for
  fake demand).
- `POST /api/demo/hype-drop` seeds the order burst and drains stock so the
  monitor fires organically (replaces the single-consume button; deterministic).

### 3.6 Dashboard (`apps/dashboard`)
- Fulfillment queue panel: orders with live status chips
  (pending → held → purged/released).
- Monitor strip ("Monitoring N critical items · last check Xs ago").
- Metrics band: capital preserved · chargeback exposure · at-risk PO value prevented
  (vendor) · verification spend.
- Branch visualization: the decision-matrix moment gets its own trail entries.
- Copy: governance/ops language; "Simulate hype drop" button.

### 3.7 Tests
- `demandPolicy.test.ts`: bot cluster flagged + capability minted; legit orders
  pass; mixed verdict splits correctly.
- Purge capability binding test (tamper/expiry/nonce reuse rejected).
- Governance loop test: both branches fire with the planted numbers.
- Monitor test (from approved design). Existing 6 tests stay green.

## 4. Doc changes (full pass)

| File | Change |
|---|---|
| `README.md` | Retitle Continuim (fixes stale "Aegis"); lead with the §1 framing verbatim-adjacent; flywheel diagram; honest tool table |
| `docs/PRD.md` | Continuim header; problem = dual loss (phantom stockout + fraud-driven procurement); §9 demo script replaced with §7 |
| `docs/architecture.md` | Add monitor, fulfillment/orders model, demand-audit seam, purge capability, protected-actions API (protected file — unlock, edit, re-protect) |
| `docs/infrastructure.md` | Watcher + purge path documented; Nexla swap-in noted |
| `docs/STRATEGY-LEDGER.md` | Entry 9 from DECISIONS 0009; "Current front" updated |
| `docs/PROJECT_STATUS.md` | Rewritten snapshot (fixes stale "nothing built") |
| `docs/CURRENT_STATE.md` | Overdue entries: committed skeleton + attestation refactor (hashes), then this change |
| `docs/ROADMAP.md` | Tick completed boxes with commits; add fusion build items + §6 follow-ups |
| `vision.md` | Draft §1 framing as the vision text; presented for product-direction approval before landing |
| `logs/DECISIONS.jsonl` | **0009:** two-branch fusion per user direction — partially supersedes 0006 (demand-side auditing now IN, as a branch of one loop, one data model, one demo arc); re-affirms 0003 (no fake Zero purchases — buyer audit fixture-mode until catalog verified) and 0004 (Fillmore stays out); rejects: full pivot away from supply-side, severity-loosened verification |

## 5. Invariants preserved
- Verification/audit rigor never loosens under urgency (0008 extended to demand).
- No mocked "Zero purchases" — fixture mode is labeled fixture mode (0003).
- Both mutations (purge, PO) require signed capabilities; dev-mode guard local,
  Pomerium mode identical contract (0007).
- Determinism directive: planted orders and vendors; only real Zero calls and
  the Pomerium denial need to be live.

## 6. Explicit out-of-scope / follow-ups (ROADMAP, not today unless time remains)
- Live Nexla FlexFlow pipe (event shape ready).
- One real external verification axis (live WHOIS/domain-age) — top follow-up.
- LLM narration of the branch decision via Claude (answers "where's the agent?"
  even harder); AWS adoption; auto-drain; severity tiers beyond `critical`.

## 7. Demo script (3 minutes, one arc, two beats)
1. **0:00–0:25** — Hype drop live; stock ticker draining; monitor strip ticking.
2. **0:25–0:50** — Stock hits 0 in an anomalous window. Hands off. Monitor
   fires; **fulfillment freezes** itself. *(Autonomy beat.)*
3. **0:50–1:35** — Disclosed demand audit: 6 orders light red (proxy IPs, day-old
   emails, card-identity mismatch) → purge capability minted → gated purge →
   **shelves restore +6 for $0**; counter: capital preserved + chargebacks avoided.
4. **1:35–2:30** — 4 real orders release; stock dips below threshold →
   procurement branch: lookalike distributor denied unattested + fails paid
   verification → blacklisted; verified distributor → attested PO → inbound.
5. **2:30–3:00** — Close: *"It noticed, it triaged, it restored stock for zero
   dollars, and when it did have to spend, the protected route rejected an
   unauthorized vendor plan. Everyone here gave an agent a wallet today — we
   built the reason you can."*

## 8. Build order under the clock (degrade gracefully)
P0: monitor → orders model + freeze → demand policy + fixtures → purge via
protected-actions → governance loop → dashboard queue panel. P1: doc pass +
demo tuning. **If time runs out mid-P0:** ship monitor + supply-side (already
green) and present the purge branch as designed-not-yet-wired — never demo a
broken branch.

## 9. Success criteria
- `npm run dev` → click "Simulate hype drop" → **no further input**: freeze,
  audit, purge, restore, release, restock PO all complete; all tests green;
  `npm run typecheck` clean.
- A cold reader of README/PRD describes Continuim as "an autonomous
  governance agent between inventory and fulfillment", not "a fraud detector".
