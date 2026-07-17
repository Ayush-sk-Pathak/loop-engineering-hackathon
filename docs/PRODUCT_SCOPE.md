# StockShield Product Scope

**Event:** Loop Engineering Hackathon, 2026-07-17. **Submission:** 16:30.

## Goal

Demonstrate a self-starting critical-spares procurement loop whose spending authority is
enforced outside the model. The demo must show real sponsor artifacts, not logos or source
labels.

## Demo-Stable Product

Two deterministic scenario profiles ship through one engine: a datacenter consumes its final
safe 64 GB ECC memory spare, or an apparel line consumes its navy dye reserve. The datacenter
profile is the primary stage path; the apparel selector is a short generalization closer.
The inventory monitor detects the threshold crossing and starts the loop without a separate
run action. The agent attempts its lowest-cost plan, observes an authorization denial, buys
evidence, blacklists an ineligible lookalike, and issues a PO to an eligible vendor. A PO
schedules inbound stock; it does not pay a supplier or claim receipt of goods.

The two candidate vendors are disclosed synthetic inputs. Dynamic vendor discovery is out of
scope.

## Judging Alignment

| Criterion | Proof |
|---|---|
| Idea | Critical-spares recovery without ungoverned emergency buying |
| Technical | Signed object capability, Pomerium subject-to-path binding, replay defense |
| Tool use | Zero receipts, Pomerium authorize logs, and a Nexla event ID when live |
| Presentation | Threshold -> deny -> replan -> blacklist -> authorized PO in one screen |
| Autonomy | Monitor wakes the agent; no operator action after the threshold crossing |

## Implemented P0

- Schema v1.1 contracts for stockout, evidence, verdict, attestation, PO, and decisions.
- Always-on local monitor plus authenticated Nexla-compatible webhook ingress.
- Deterministic `eligible | ineligible | insufficient_evidence` policy.
- Signed attestation bound to vendor, domain, SKU, quote, payee, account reference, price,
  quantity, amount, evidence hash, expiry, and one-time nonce.
- Authorization before idempotency; changed replay and nonce reuse are rejected.
- Pomerium assertion verification with exact vendor subject-to-path equality.
- Fixture and live-Zero collector modes with receipt enforcement for paid signals.
- Data-driven datacenter/apparel scenario profiles with quote-to-SKU consistency tests.
- SQLite decision state, responsive dashboard, one-command setup, Docker image, and runbooks.

## Prize-Critical P1

- Settle and record the exact Zero services in `config/zero-services.json`.
- Configure the Pomerium general-agent deny identity and eligible-vendor allow identity.
- Capture a Pomerium `403` request ID, `allow:false` log, and absence from origin logs.
- Deliver a real Nexla FlexFlow event and preserve its event ID through the trace.
- Add StableEmail only after the Zero + Pomerium path is green.

`npm run doctor:prize` is the recording gate. It must fail until these artifacts exist.

## Explicit Non-Claims

- No criminal fraud verdict, supplier payment, physical inventory receipt, or live sourcing.
- No credit bureau, supplier registry, fraud score, or bank-account ownership data unless a
  live provider is pinned and its receipt captured.
- Fixture evidence is not paid Zero evidence.
- A development-origin `403` is not Pomerium proof.
- The illustrative downtime rate is scenario input, not a measured customer loss.

## Approved Extension

The demand-audit and protected order-purge branch is designed in
`docs/superpowers/specs/2026-07-17-two-branch-governance-design.md`. It is deliberately
deferred because it adds a second evidence model, signed capability, protected mutation, and
UI workflow. It must not destabilize the sponsor-critical procurement slice.

## Horizontal Scenario Profiles (implemented, off the critical path)

The scenario-profile engine (DECISIONS `0013`) is implemented and tested: `datacenter`
(default, the demo-stable scenario above) and `apparel` (NAVY-DYE-20L, disclosed
typosquat/consistent vendor pair) run the identical loop, selected by a dashboard toggle
(`POST /api/demo/scenario`). The demo default remains datacenter; the toggle is only the
optional "same loop, any industry" closer in `docs/DEMO.md` and must not displace the
live vertical slice.

## Cut Order

Cut dynamic sourcing, demand audit, StablePhone, StableEmail, UI extras, and Akash deployment
before cutting the real Zero receipt or Pomerium denial. The second scenario profile is seed
data behind the existing engine — demo it only via the optional closer; never run it live on
stage before the datacenter vertical slice passes twice.
