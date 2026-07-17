# StockShield Project Status

**Phase:** autonomous local vertical slice hardened; live sponsor integrations in progress.

- **Product:** autonomous critical-spares recovery with policy-enforced procurement, not
  general fraud detection.
- **Pitch:** “An agent may be wrong, but it cannot be unauthorized.”
- **Local setup:** `npm run setup`, `npm run doctor`, `npm run dev`.
- **Quality gate:** `npm run check`; production build via `npm run build`.
- **Schema:** v1.1 frozen across stockout, evidence, attestation, PO, and decision events.
- **Local flow:** spare consumption -> monitor wake-up -> initial deny -> replan -> fixture
  evidence -> blacklist -> signed capability -> accepted PO -> inbound scheduled.
- **Autonomy:** two-second threshold monitor is implemented and tested against duplicate
  triggers during active runs or existing inbound supply.
- **Security:** full vendor/payee/quote/price/amount binding, authorization before idempotency,
  request fingerprints, and nonce replay defense are implemented and tested.
- **Dashboard:** one responsive operations screen; fixture/local/live modes are explicit.
- **Nexla:** webhook ingress exists; external FlexFlow configuration is pending.
- **Zero:** strict HTTP adapter seam exists; no live services are locked yet.
- **Pomerium:** assertion verification exists; route, policy, and two service accounts are pending.
- **StableEmail:** service candidate identified; adapter and received-message proof pending.
- **Claude Agent SDK:** pending behind the current port-driven deterministic loop.
- **Akash:** Docker image and coverage template exist; deployment is P2.
- **Primary targets:** Zero.xyz and Pomerium. Nexla/Akash remain coverage.
- **Non-claims:** no supplier payment, instant refill, legal fraud verdict, or dynamic sourcing.
- **Recording gate:** `npm run doctor:prize` must pass before sponsor claims are filmed.
- **Approved extension:** demand audit and protected order purge are designed in
  `docs/superpowers/specs/2026-07-17-two-branch-governance-design.md` but intentionally
  deferred until the Zero + Pomerium slice is live.
- **Team workflow:** owner paths and branch commands are in `CONTRIBUTING.md`.
- **Demo:** revised continuous script is in `docs/DEMO.md`.
- **Submission deadline:** 2026-07-17 16:30 America/Los_Angeles.
