# Aegis — Roadmap (forward source of truth)

> The **future** — the forward mirror of `CURRENT_STATE.md` (the past).
>
> **Sync rule:** when `CURRENT_STATE.md` logs an item done, tick its box here **in
> the same commit**. `[ ]` = open, `[x]` = done **with the commit hash and ISO date
> in parens**. Keep items terse — detail lives in CURRENT_STATE. Never delete
> shipped items; the checked trail is the history of the plan.
>
> Companions: `vision.md` (why) · `docs/architecture.md` (how) · `docs/PRD.md` (the
> full plan) · `docs/STRATEGY-LEDGER.md` (settled decisions).

## Where we are (2026-07-17)

Scaffolded; concept locked. The build is a ~5.5-hour sprint against the timeline below.
This roadmap mirrors `docs/PRD.md §10` (team split) and §11 (timeline).

## Phase 0 — Foundation (all four, first 45 min)

- [x] Scaffold the doc system + enforcement (`/starter-pack`, 2026-07-17)
- [x] Fill `docs/architecture.md` with the real blueprint (2026-07-17)
- [x] Write `docs/PRD.md` (2026-07-17)
- [ ] **RE-VERIFY `zero.xyz/browse`** — confirm Apollo/PDL, Firecrawl, serp, StablePhone/StableEmail are live and settle from our wallet (blocks Owner 2)
- [ ] Freeze the five interface signatures (`architecture.md §Data flow`); commit shared types/mocks
- [ ] Repo skeleton: `apps/dashboard`, `services/{agent,verify,procurement,inventory}`, `deploy/akash`, shared `packages/contracts`

## Phase 1 — Parallel build against mocks (all four, ~2.5 h)

- [ ] Owner 1 — Agent Core loop: intake → source → verify → self-correct (blacklist+retry) → order
- [ ] Owner 2 — Zero verify module: real paid calls (enrichment, scrape+WHOIS, news, AI call) → verdict + attestation
- [ ] Owner 3 — Procurement API + Pomerium policy (attested-only) + attestation store
- [ ] Owner 4 — Storefront + inventory gauge + decision-trail panel + Nexla FlexFlow trigger

## Phase 2 — Integration (all four, ~1 h)

- [ ] Wire real seams (drop mocks): trigger → agent → verify → attestation → Pomerium → PO → dashboard
- [ ] Plant the two demo vendors (1 legit, 1 fraud) and tune so the fraud vendor fails every check
- [ ] Prove the invariants: fraud PO returns `403` at Pomerium; counterfactual "reasoning bypassed → still denied"
- [ ] Deploy to Akash (or local fallback if setup stalls)

## Phase 3 — Demo + submission (all four, last ~45 min)

- [ ] Rehearse the 3-minute script (`docs/PRD.md §9`) twice, timed
- [ ] Record the 3-min demo video
- [ ] README with architecture diagram + tool mapping; push public repo
- [ ] Submit on Devpost with all required fields

## Product notes (capture-only)

<!-- observations / dogfood points land here immediately, unprocessed -->
