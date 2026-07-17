# StockShield Tool Blueprint

This file distinguishes implemented seams from sponsor proof. The current recording gate is
`npm run doctor:prize`.

| Tool | Genuine role | Current state | Stage proof |
|---|---|---|---|
| Zero.xyz | Wallet-funded, current vendor evidence; optional StableEmail | Strict adapter implemented; live services unpinned | Service IDs, price, wallet delta, receipt IDs |
| Pomerium | Authenticates vendor-scoped identities on the PO route | Assertion verification implemented; route/accounts pending | `403` request ID, `allow:false`, absent origin request, then `201` |
| Nexla FlexFlow | Transforms inventory data into schema v1.1 `stockout_risk` | Authenticated ingress implemented; FlexFlow pending | Nexla event ID preserved in decision trace |
| Akash | Hosts the existing containers | Docker image and SDL example implemented; lease pending | Active lease and public URL |
| Claude Agent SDK | Planner/explainer behind deterministic ports | Pending | Model tool-call trace without authorization authority |
| StableEmail | Delivers an accepted PO after authorization | Pending and optional | Zero receipt, message ID, received message |

## Zero.xyz

The evidence adapter accepts normalized signals only in `live_zero` mode and rejects any paid
signal without a receipt ID. Owner 2 must re-verify the live catalog, settle one call per
chosen service, and fill `config/zero-services.json`. Do not build or buy a fake verification
registry just to produce an x402 transaction. No bank ownership, credit bureau, business
registry, or fraud-score claim exists without a pinned live provider.

## Pomerium

Pomerium authenticates the caller; it does not inspect the PO body or decide vendor risk. The
general-agent identity must be authenticated but denied. An eligible candidate maps to a
vendor-scoped identity allowed only on its vendor path. The origin then verifies Pomerium's
signed assertion and StockShield's signed attestation, including every purchase binding.

An Express-origin `403` validates local behavior but does not count for the Pomerium prize.

## Nexla

The local monitor and Nexla emit the same event shape but different `source` values. The
monitor makes the local autonomy path reliable. Nexla counts only when a real FlexFlow event
ID reaches `POST /api/events/stockout` and remains the correlation ID in the trace.

## Akash

Akash is coverage after the core is green. The repo already builds an immutable container
and includes an SDL example. Do not spend prize-critical time on persistent SQLite,
multi-region deployment, or a custom domain.

## Claude

The current loop is deterministic and port-driven. Claude may later rank eligible options or
explain evidence, but model output must never mint a capability or override policy. Do not
describe the existing loop as a live Claude Agent SDK integration.

## Tools Deliberately Excluded

- Fillmore: recruiting-specific and not a procurement PO integration.
- AWS/Bedrock: no implemented dependency in the demo-stable TypeScript stack.
- Custom mock registry sold through x402: produces a real payment for self-authored evidence,
  which is weak verification and a likely judge objection.

## Recording Rule

Names and mode labels are not proof. Record external IDs and logs in each file under
`docs/integrations/`; if the artifact is missing, disclose the integration as pending.
