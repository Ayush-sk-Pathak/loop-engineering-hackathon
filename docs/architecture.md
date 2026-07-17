# Aegis — Architecture (blueprint of record)

> The **design** — the immutable blueprint of record. `CLAUDE.md` is this document's
> distilled, binding form. Protected below the agent (chmod 444 + pre-commit);
> deliberate, user-approved changes use `chmod u+w` + `git commit --no-verify`,
> then re-run `scripts/bootstrap.sh`. Superseded designs are never deleted — mark
> them `Status: Superseded by <doc>` and keep them.
>
> Full rationale, the demo, and the team split live in `docs/PRD.md`. This file is the
> tight, binding shape; the PRD is the prose.

**Thesis.** Aegis is a **procurement trust loop**: an autonomous agent that rescues a
stockout by sourcing backup suppliers, but is structurally incapable of paying an
unverified one. The core bet is **defense in depth** — the agent's LLM reasoning is the
*soft* layer (it verifies vendors with real paid checks and self-corrects when one fails),
and an identity-aware policy proxy (Pomerium) is the *hard* layer (the payment/PO API
physically rejects any vendor lacking a valid verification attestation, even if the
reasoning is wrong or prompt-injected). The paid verification step runs on Zero.xyz tools
that provably settle, so the "buy the check" moment is real, not mocked. This shape serves
the vision because it turns the scariest objection to autonomous spending — "what stops it
getting scammed?" — into the product itself.

## Components

- **Storefront + Ops Dashboard** (`apps/dashboard`, Next.js/React) — the demo surface: a
  storefront selling an item, an inventory gauge, a live decision-trail panel, and the
  "$ fraud blocked / revenue saved" counter. Owner 4.
- **Inventory + Trigger** (`services/inventory`, Nexla FlexFlow → webhook) — streams stock
  levels; when a SKU crosses the safety threshold it emits a `stockout_risk` event to the
  agent. Nexla FlexFlow (GA) is primary; a local webhook/poller is the fallback. Owner 4.
- **Agent Core** (`services/agent`, TS + Claude Agent SDK) — the plan/act/observe/
  self-correct loop: receive `stockout_risk` → source candidate vendors → call verify on
  each → blacklist failures and re-source → issue a PO to the first that passes. Emits
  decision events to the dashboard and `logs/DECISIONS.jsonl`. Owner 1.
- **Verification Module** (`services/verify`, TS + Zero.xyz) — `verify(vendor) → verdict`.
  Spends real USDC via Zero on: business/contact enrichment (Apollo/PDL/Crustdata),
  web scrape + domain age (Firecrawl/BrightData + WHOIS), news/adverse-media (serp), and
  optionally a StablePhone AI call to the vendor's number. On PASS it writes a signed
  **verification attestation** for that vendor. Owner 2. **Prize-critical (Zero).**
- **Procurement API + Policy Gate** (`services/procurement` behind **Pomerium**) — the
  endpoint that "moves money" (`POST /po`). Pomerium authorizes the call only if the target
  vendor carries a valid attestation; unverified → `403`. Sends the PO via StableEmail
  (Zero). Owner 3. **Prize-critical (Pomerium).**
- **Hosting** (`deploy/akash`) — Docker Compose → Akash SDL. Owner 3. (Coverage, not a
  prize contender — see ledger.)

## Data flow

```
[Storefront] --stock drop--> [Nexla FlexFlow] --stockout_risk(SKU,qty)--> [Agent Core]
                                                                              |
                                    plan: rescue SKU, verify before paying    |
                                                                              v
            [Agent Core] --verify(vendor)--> [Verification Module] --paid Zero calls-->
              (enrichment | scrape+WHOIS | news | AI call)  ==> verdict{pass|fail, reasons, cost}
                                                                              |
                     fail: blacklist + log + re-source (self-correct) <-------+
                     pass: write attestation(vendor)  ----------------------->|
                                                                              v
            [Agent Core] --POST /po(vendor,qty)--> [Pomerium] --policy: attested?-->
                                       yes -> [Procurement API] -> StableEmail PO + inventory refill
                                       no  -> 403 -> Agent reasons about denial, blacklists, retries
                                                                              |
                                                                              v
                                          [Dashboard] decision trail + "$ fraud blocked"
```

**Seams that must stay stable (the interfaces between owners):**
1. `stockout_risk` event: `{ sku, currentQty, threshold, ts }` (Owner 4 → Owner 1).
2. `verify(vendor) → verdict`: `verdict = { status: "verified"|"rejected", riskScore, reasons[], costUSD }` (Owner 1 → Owner 2).
3. **Attestation:** on PASS, Owner 2 writes `{ vendorId, status:"verified", sig, expires }` to the shared attestation store that Pomerium's policy reads (Owner 2 → Owner 3).
4. `POST /po { vendorId, sku, qty }` through Pomerium → `200 | 403` (Owner 1 → Owner 3).
5. Decision events: `{ phase: "sourced"|"verifying"|"rejected"|"blacklisted"|"ordered", vendor, detail, ts }` (Owner 1 → Owner 4).

Agree these five signatures in the first 30 minutes; then all four workstreams can build
against mocks in parallel.

## Workflow / phases

- **Phase 1 — Intake:** stockout event received; agent states a plan and success criteria.
- **Phase 2 — Source:** produce ≥2 candidate vendors (demo: 1 legit + 1 planted fraud).
- **Phase 3 — Verify (paid):** run `verify` on each candidate via Zero; aggregate a verdict.
- **Phase 4 — Self-correct:** rejected vendors are blacklisted, logged, and the search
  widens; the agent never proceeds on a rejected vendor.
- **Phase 5 — Gate & order:** PO attempted through Pomerium; unverified is denied at the
  proxy; verified is ordered, PO emailed, inventory refilled.
- **Phase 6 — Account:** dashboard updates the decision trail and the fraud/revenue counter.

## Invariants

- **No pay without attestation.** A PO for a vendor without a valid, unexpired attestation
  MUST fail. *Enforced:* Pomerium policy at the proxy (not app code) — the demo's
  "try to pay the fraud vendor" beat must return `403`, and a test asserts it.
- **Every paid check is a real settlement.** The verify step calls a real Zero.xyz tool
  that settles USDC; no mocked "verification vendor" stands in for the Zero call.
  *Enforced:* a smoke test that asserts a non-zero wallet debit / real API response per
  check; if a specific tool is absent on-site, swap to another *real* Zero tool, never a mock.
- **Every agent decision is sourced.** Each blacklist/order decision writes a
  `logs/DECISIONS.jsonl` line with the evidence that drove it. *Enforced:* the agent's
  order path refuses to proceed without a logged verdict id.
- **Reasoning is never the only gate.** Removing/altering the agent's verify step must NOT
  let a fraudulent PO through, because Pomerium still blocks it. *Enforced:* the demo's
  counterfactual ("reasoning bypassed → Pomerium still denies").
