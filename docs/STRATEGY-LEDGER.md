# STRATEGY LEDGER — load-bearing decisions & invariants

**Read this before any strategic or direction-setting work.** It carries the standing
decisions and invariants that `vision.md` (intent) and `CLAUDE.md` (the laws) do
**not** already hold — the ones a long or fresh session would otherwise re-litigate
or silently contradict. It is injected into every session by the SessionStart hook
(`.claude/settings.json`). **Do not reverse any of these without logging an explicit
supersede to `logs/DECISIONS.jsonl`.**

## Current front (2026-07-17) — where we are right now

Shipped. `origin/main` is green (39/39) and the product is deployed: 3-service topology on
Akash (dseq `1784324838403`), live at **https://continuum-hq.com**. Zero evidence is settled
(3 real receipts in `config/zero-services.json`); Pomerium is staged (route + PPL + data-plane
runbook proven; the live 403/201 is blocked only on co-locating procurement with the proxy —
runtime reverted to `development`, one-line reflip). Explainer = the external fallback chain
(decision 0017). Nearest follow-ups: immutable-image deploy (kills clone-at-boot downtime),
procurement/proxy co-location, post-ship doc/board archive sweep.


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

6. **The public product is Continuim and the security thesis is policy-enforced agentic
   procurement (2026-07-17).** The value is that an agent may research and replan but cannot
   commit a PO without constrained authority. **Rejected:** “cannot be scammed,” a general
   fraud detector, or merging customer checkout screening into this workflow. DECISIONS
   `0006`, superseding the naming/framing in `0002`.

7. **Pomerium enforces vendor-scoped machine identity; the origin enforces request-object
   binding (2026-07-17).** A shared agent token cannot distinguish vendors, and Pomerium does
   not read local SQLite. Prize mode requires a general agent identity for the denial and a
   separate eligible-vendor identity for the allow. The origin verifies Pomerium's assertion
   and Continuim's signed attestation. **Rejected:** arbitrary attestation-header presence,
   shared agent identity, and application 403s presented as proxy proof. DECISIONS `0007`.

8. **Verification has three deterministic outcomes (2026-07-17).** Evidence supports
   `eligible`, `ineligible`, or `insufficient_evidence`; an LLM explains but does not decide.
   Payee mismatch and typosquatting are hard failures. **Rejected:** fraud labels based on
   young domains, missing news, or model prose. DECISIONS `0008`.

9. **The self-correction is learned from a pre-verification authorization denial
   (2026-07-17).** The general agent's cheapest plan receives a live 403, then the agent
   acquires evidence and replans. **Rejected:** forcing an already-correct agent to order from
   a blacklisted candidate. DECISIONS `0009`.

10. **Every sponsor mode requires external proof (2026-07-17).** Zero requires receipts,
    Pomerium requires authorize logs, Nexla requires an event ID, StableEmail a message ID,
    and Akash a lease/URL. **Rejected:** silent fixture fallback and environment labels as
    proof. DECISIONS `0010`.

11. **The local demo is self-starting and critical-spares-first (2026-07-17).** A two-second
    monitor emits the same versioned event shape as Nexla when a simulated node failure
    consumes the final safe spare. The local source remains labeled `monitor`; it is not
    presented as Nexla proof. DECISIONS `0011`.

12. **The demand-audit/purge branch is an approved extension, not part of the demo-stable
    baseline (2026-07-17).** It needs a separate buyer evidence policy, signed purge
    capability, protected mutation, and queue UI. Implement it only after live Zero and
    Pomerium proof is green; never imply buyer evidence was paid through Zero while it is
    fixture-only. DECISIONS `0012`.

13. **The hero is the autonomous emergency-procurement loop; fraud defense is its built-in
    trust subset; the engine is horizontal (2026-07-17).** Explicit user direction: the
    rescue story leads every doc and pitch, and vendor-risk verification is the tool that
    makes the autonomy safe — never the headline. The loop is scenario-agnostic: two locked
    profiles (datacenter compute spares, apparel dye — `PRODUCT_SCOPE.md §3a`) run through
    the identical engine behind one dashboard toggle. **Rejected, do not re-propose:**
    renaming to ProcureLoop (Continuim stands, `0006`); Fillmore PO drafting (`0004`
    stands); a mocked verified-registry paid via Zero (`0003` stands); fraud-first framing.
    DECISIONS `0013`.

14. **The external tool-blueprint is reconciled: adopt its additive wins behind existing
    ports; reject what reverses a decision or discards the green slice (2026-07-17).**
    Adopt: AWS Bedrock backing the planner/explainer port (LLM explains, never adjudicates —
    `0008` holds), a clearly-badged real-artifact replay mode for the recording, one real
    paid WHOIS/domain-age Zero call as the authentic anchor, and StableEmail-primary with a
    disclosed non-sponsor email fallback. Full map: `docs/blueprint-reconciliation.md`.
    DECISIONS `0014`.

15. **ProcureLoop's three-layer definition is absorbed: Hero Runway / Secondary Guardrail /
    Learning Layer (2026-07-17).** The hero runway (autonomous monitoring + procurement) and
    the guardrail's vendor-verification half are implemented; the demand-audit half stays the
    deferred extension (`0012`). New: an append-only **incident ledger** — every resolved run
    logs anomaly profile, vendor, spend, and resolution speed; later runs skip the
    already-learned unattested probe (emitting `recalled_history`) and prefer
    proven-fulfillment vendors. **Invariant: learning never bypasses the evidence gate or the
    signed capability.** **Rejected, do not re-propose:** Fillmore auto-PO (`0004`), paid
    B2B registry lookup via Zero (`0003`), renaming to ProcureLoop (`0006`/`0013`).
    DECISIONS `0015`.

16. **The public product name is Continuim (2026-07-17).** User-directed rename from
    StockShield: global rename across docs, package scope (`@continuim/*`), UI strings,
    mockups, and deploy files. Supersedes the naming in `0006` and the "name stands"
    clause of `0013`; every other clause of those decisions (hero/subset hierarchy,
    horizontal engine, security thesis) stands unchanged. **Rejected, do not re-propose:**
    reverting to StockShield or ProcureLoop; a docs-only partial rename that leaves code
    and docs disagreeing. DECISIONS `0016`.

## Standing directives & envelope

- **Demo-first scope.** If a feature isn't on the 3-minute demo script (`docs/PRD.md §14`),
  it isn't in scope today. A smaller thing that runs beats a bigger thing that doesn't.
- **Determinism over live-API roulette.** Vendors are disclosed synthetic candidates and the
  scenario is scripted; the *only* things that must be genuinely live are the Zero paid calls
  and the Pomerium denial. Everything else is controllable.
- **Envelope (2026-07-17):** local contracts, security, loop, state, dashboard, Docker build,
  and Nexla ingress exist. Unproven: live Zero settlements, live Pomerium route/service
  accounts, StableEmail delivery, Claude Agent SDK adapter, Nexla control-plane flow, and
  Akash deployment. Do not claim any of those until its runbook contains external proof.
