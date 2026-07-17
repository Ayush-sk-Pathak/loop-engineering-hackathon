# Aegis — Project Status

> **Read this first (30-second orientation).** A stable, low-churn snapshot for fast
> orientation — NOT the history (that's `CURRENT_STATE.md`) and NOT the future
> (that's `ROADMAP.md`). **Rules:** update only when a summary-level fact changes
> (counts, limits, phase, stack); keep it **≤25 bullets and ~500 words**.

**What it is.** An autonomous stockout-rescue procurement agent that verifies every supplier with real paid checks before it can spend a cent, so it can't be scammed.

**Phase.** Scaffolded 2026-07-17 — pre-build. Concept locked; interfaces not yet frozen.

## Key facts

- **Event —** Loop Engineering Hackathon, 2026-07-17. Hacking 11:00 AM → **submission 4:30 PM** (~5.5 h). Deliverables: public GitHub repo + 3-min demo video + Devpost entry.
- **One-line pitch —** "Everyone here gave an agent a wallet today; we built the reason you can."
- **Stack —** TypeScript/Node (agent + APIs), Next.js/React (dashboard), Claude Agent SDK (reasoning), Zero.xyz (paid verification + wallet), Pomerium (policy gate), Nexla FlexFlow (trigger), SQLite, Docker on Akash.
- **Branch model —** `main` = demo-stable; `dev` = integration; owners on `feat/<area>` → `dev`. Never push to `main` mid-build.
- **Team —** 4 owners: (1) Agent Core, (2) Zero Verification, (3) Pomerium + Procurement API + Akash, (4) Dashboard + Nexla + Demo. See `docs/PRD.md §10`.
- **Prize targets —** Best use of Zero.xyz ($2,000, primary) + Most Innovative Pomerium ($1,000). Nexla and Akash for coverage.
- **Load-bearing risk —** the Zero paid-verification tools must be live on-site; **re-verify `zero.xyz/browse` before writing Zero code** (`STRATEGY-LEDGER` decision 3).
- **Dropped —** Fillmore (recruiting-only; PO email uses StableEmail instead).
- **Verification signal —** business enrichment + domain-age scrape + adverse-media news + optional AI phone call — all real Zero calls; the planted fraud vendor fails all four.
- **The hard backstop —** Pomerium denies any PO to a vendor without a valid verification attestation, even if the agent's reasoning is wrong. Defense in depth.
