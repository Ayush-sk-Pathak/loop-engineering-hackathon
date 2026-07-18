# Continuim Roadmap

## Foundation

- [x] Freeze schema v1.1 shared contracts (2026-07-17)
- [x] Implement deterministic vendor-risk policy and disclosed fixtures (2026-07-17)
- [x] Implement signed attestation and complete PO object binding (2026-07-17)
- [x] Enforce authorization before idempotency and nonce replay protection (2026-07-17)
- [x] Implement bounded autonomous denial/replan/order loop (2026-07-17)
- [x] Implement SQLite state and one-screen operations dashboard (2026-07-17)
- [x] Add one-command setup, local/prize doctor, Docker build, and owner workflow (2026-07-17)
- [x] Add real Nexla-compatible webhook ingress (2026-07-17)
- [x] Add autonomous critical-inventory monitor and no-run-button demo path (2026-07-17)
- [x] Add horizontal scenario-profile engine (datacenter + apparel) with dashboard toggle (2026-07-17)

## Prize-Critical Integration

- [x] Owner 2: settle one live Zero call per candidate service and fill the service lock (62db3b7, 2026-07-17)
- [x] Owner 2: implement the Zero evidence adapter with real receipt IDs (62db3b7, 2026-07-17)
- [ ] Owner 3: create Pomerium general-agent and verified-vendor service accounts
- [ ] Owner 3: configure exact-route PPL and capture `403`/`201` authorize logs
- [ ] Owners 1+3: run the complete live Zero -> Pomerium vertical slice
- [ ] Owner 4: connect Nexla FlexFlow and prove the event ID end to end

## Optional After Core Proof

- [ ] Implement the approved demand-audit and protected-purge branch from the design spec
- [ ] Add Claude Agent SDK planner/explainer without moving authorization into model output
- [ ] Replace the illustrative downtime rate with a cited operator-specific input
- [ ] Add StableEmail adapter and received-message proof
- [ ] Add StablePhone only if call latency and consent are controlled
- [ ] Publish immutable image and deploy the coverage topology to Akash

## Submission

- [ ] Run `npm run doctor:prize`, `npm run build`, and the timed demo twice
- [ ] Record the continuous three-minute demo
- [ ] Add live request IDs, receipts, and deployment URLs to the runbooks
- [x] Push the green demo-stable revision to `main` (43e6cc7, 2026-07-17)
- [ ] Complete the public repository and Devpost submission

## Post-Hackathon Repair (2026-07-17 plan — de-sponsored working agent)

- [x] Stage 0: unbreak local — `.env` back to a satisfiable mode; loop verified end to end (a0f2b91, 2026-07-17)
- [x] Stage 1: real evidence without Zero — in-process `VERIFICATION_MODE=live` (RDAP + Firecrawl + optional Linkup), catalog on real domains, hard-fail precedence (2026-07-17)
- [x] Stage 2: de-sponsor — Zero/Pomerium/Akash/Bedrock/Codex/StableEmail surfaces removed, webhook genericized, apps/dashboard dropped (2026-07-18)
- [x] Stage 3a: prod repaired in place — trimmed-boot SDL, port pins, accept hosts; first on-site e2e PO-C92351A9 (c3657ba, 2026-07-18)
- [ ] Stage 3b: switch dseq 1784324838403 to the immutable-image SDL (blocked: user makes both GHCR `continuim-*` packages public, then `console-axi deployment update --sdl deploy/akash/deploy.image.yaml`)
- [ ] Fix `www.continuum-hq.com` DNS record (000/NXDOMAIN — Cloudflare record missing or misconfigured)
