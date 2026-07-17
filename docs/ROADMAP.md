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

- [ ] Owner 2: settle one live Zero call per candidate service and fill the service lock
- [ ] Owner 2: implement the Zero evidence adapter with real receipt IDs
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
- [ ] Push the green demo-stable revision to `main`
- [ ] Complete the public repository and Devpost submission
