# STRATEGY LEDGER — load-bearing decisions & invariants

**Read this before any strategic or direction-setting work.** It carries the standing
decisions and invariants that `vision.md` (intent) and `CLAUDE.md` (the laws) do
**not** already hold — the ones a long or fresh session would otherwise re-litigate
or silently contradict. It is injected into every session by the SessionStart hook
(`.claude/settings.json`). **Do not reverse any of these without logging an explicit
supersede to `logs/DECISIONS.jsonl`.**

## Current front (2026-07-17) — where we are right now

Concept is **locked**: Aegis, the autonomous procurement agent with fraud defense in the
loop (see `docs/PRD.md`). Repo scaffolded with the anti-drift doc system. Immediate next
step: the 4 owners agree the five interface signatures in `docs/architecture.md §Data flow`,
then build against mocks in parallel. **Before any Zero code: re-verify the live catalog at
`zero.xyz/browse`** (decision 3).

## The load-bearing decisions (do not silently reverse)

1. **Adopted the starter-pack doc system (2026-07-17).** Docs are split by what
   drifts: intent (`vision.md`) / laws (`CLAUDE.md`) / decisions (this ledger) /
   past (`CURRENT_STATE`) / future (`ROADMAP`) / design (`architecture`) / evidence
   (`logs/*.jsonl`); the immutable layer is enforced below the agent. **Rejected,
   do not re-propose:** relying on a vision doc alone, or on instructions without
   enforcement. DECISIONS `0001`.

2. **The concept is Aegis — a procurement TRUST loop, not a plain stockout-rescue or a
   plain fraud-detector (2026-07-17).** We fuse both: the agent rescues a stockout but
   cannot pay an unverified supplier. The winning frame is "everyone here gave an agent a
   wallet today — we built the reason you can." **Rejected, do not re-propose:** (a) pure
   stockout-rescue (Concept A) — its autonomous-spend premise has no answer to "what stops
   it getting scammed?"; (b) pure fraud-interceptor on customer checkout (Concept B) — reads
   as "just Stripe Radar" and its data source doesn't exist in Zero; (c) cargo rerouter
   (Concept C) — worst data availability + least demoable; (d) pure-software "agent security
   / prompt-injection firewall" ideas — the team wanted real-world P&L impact. DECISIONS `0002`.

3. **The paid verification step runs ONLY on Zero.xyz tools that provably exist and settle;
   we do NOT mock a "verification vendor" (2026-07-17).** Verified by deep research (3-0,
   two independent fetches of `zero.xyz/browse` + the `zero-plugins` repo): Zero does **NOT**
   broker credit-bureau, telco/carrier, business-registry, fraud-score, or freight data.
   It **does** broker: business/contact enrichment (Apollo/PDL/Wiza/Crustdata), web scraping
   (Firecrawl/BrightData), news/search (serp), weather, stock/FX quotes (Alpha Vantage),
   places/real-estate (Maps/Zillow/RentCast), travel, media generation, and communication
   (StableEmail/StablePhone). So the fraud verdict is assembled from **enrichment + domain-age
   scrape + adverse-media news + optional AI phone call** — each a real paid Zero call — and
   the planted fraud vendor is engineered to fail all of them (empty footprint, ~2-week-old
   domain, no news, dead phone). **Rejected, do not re-propose:** buying a "verified supplier
   registry / credit-bureau / fraud-score" via Zero (does not exist), or standing up a fake
   registry service we call through Zero (that fakes the one thing the Zero prize judges
   scrutinize, and it guts the "honest trust layer" pitch). **Re-verify the catalog on-site
   the morning of the event** — it is dynamic. DECISIONS `0003`.

4. **Fillmore is dropped (2026-07-17).** Deep research confirmed (3-0) Metaview's Fillmore is
   recruiting-ONLY (candidate sourcing/outreach/scheduling in Slack); it cannot draft purchase
   orders. Using it for procurement is a domain mismatch a Metaview judge will not reward.
   The PO email is sent via **StableEmail** (a real Zero communication tool) instead.
   **Rejected, do not re-propose:** using Fillmore to draft/send the PO. The only honest way
   to contend for the Fillmore prize would be a genuinely *recruiting* subtask — out of scope.
   DECISIONS `0004`.

5. **Tool roles are fixed to genuine fits; Akash is coverage, not a prize play (2026-07-17).**
   Zero = wallet + paid verification (prize target). Pomerium = identity-aware gate on the
   payment/PO API, policy = attested-vendors-only (prize target). Nexla = real-time inventory
   stream / stockout trigger via **FlexFlow (GA)**, NOT MCP Studio (Early Access, same-day
   integration risk). Akash = hosting the containers (honest: "we hosted a container" is a
   weak Akash-prize case — don't over-invest). **Rejected, do not re-propose:** using Nexla
   MCP Studio on the day (EA risk); forcing an Akash GPU/compute angle we don't need.
   DECISIONS `0005`.

## Standing directives & envelope

- **Demo-first scope.** If a feature isn't on the 3-minute demo script (`docs/PRD.md §9`),
  it isn't in scope today. A smaller thing that runs beats a bigger thing that doesn't.
- **Determinism over live-API roulette.** Vendors are planted (1 legit, 1 fraud) and the
  scenario is scripted; the *only* things that must be genuinely live are the Zero paid calls
  and the Pomerium denial. Everything else is controllable.
- **Envelope (2026-07-17):** nothing is built yet — the repo contains only the doc system and
  this plan. Unproven until code exists: (a) that the specific Zero tools (Apollo/PDL,
  Firecrawl, serp, StablePhone) are live and settle from our wallet on the day — **must
  re-verify on-site**; (b) that Pomerium policy can read our attestation store within the
  time box (fallback: a thin reverse-proxy policy check if Pomerium cloud setup stalls);
  (c) the cash-metric figure — anchor on FBI IC3 Business Email Compromise (~$2.9B/yr,
  vendor-impersonation / bank-change fraud) but **source the exact current number before it
  goes on a slide** (deep research did not verify cash figures).
