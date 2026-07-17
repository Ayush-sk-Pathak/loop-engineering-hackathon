# Continuim Infrastructure

## Local Topology

```text
browser :3000
  -> Next.js same-origin proxy
  -> control plane :4000
       -> always-on critical-inventory monitor
       -> evidence collector (fixture or Zero adapter)
       -> procurement origin :4001 (development mode only)
       -> SQLite decision state
```

`npm run dev` runs the control plane, procurement origin, evidence adapter, and primary
Continuum UI. `docker compose up --build` runs the same topology
with the procurement service exposed only to the container network. The monitor checks the
spares pool every two seconds by default and emits the same contract as the Nexla ingress.
Local mode uses a signed attestation guard and is visibly labeled **development**, not
Pomerium.

## Prize Topology

```text
Nexla FlexFlow -> POST /api/events/stockout -> control plane
                                                |
                                                +-> Zero evidence adapter -> paid providers
                                                |
                                                +-> Pomerium public route
                                                      |
                                                      +-> private procurement origin
```

The protected request carries two independent artifacts:

1. A Pomerium service-account credential. The initial general-agent identity is authenticated
   but denied; an eligible vendor maps to a vendor-scoped identity allowed on its exact path.
2. A signed Continuim attestation. The origin verifies its signature, expiry, and complete
   PO object binding.

Pomerium does not read SQLite or inspect an arbitrary PO body. Continuim does not authorize
on a custom header's presence. The origin verifies Pomerium's signed assertion, including
issuer, audience, expiry, and subject-to-path equality.

## Ports

| Component | Local port | Prize exposure |
|---|---:|---|
| Dashboard | 3000 | public |
| Control plane | 4000 | public webhook/API or private behind dashboard |
| Procurement origin | 4001 | private; Pomerium only |
| Zero adapter | owner-defined, example 4100 | private |

The dashboard uses a same-origin Next.js proxy and `CONTROL_PLANE_INTERNAL_URL`, so one build
works locally, in Docker, and on Akash.

`POST /api/demo/consume` is the deterministic demo input: it represents a failed node
consuming one spare. It does not start procurement. The independent monitor starts the loop
only when the critical threshold is reached, the loop is idle, and no inbound order exists.

## Data

SQLite stores the current demo state and decision events. Procurement idempotency and nonce
tracking are currently process-local because the demo uses one origin instance. Do not scale
the procurement origin horizontally without moving those maps to a transactional shared
store.

Fixture vendors use `.example` domains and synthetic payee references. They are never passed
off as real organizations.

## Secrets

`.env` is ignored and created from `config/example.env`. Required prize secrets include
the Zero adapter token, attestation signing secret, Pomerium route/JWKS configuration, the
general agent token, and the eligible vendor service-account token.

The pre-commit hook rejects runtime environment files and recognizable private keys. Never
place service-account tokens, wallet keys, complete Pomerium assertions, or email recipient
PII in decision-event metadata.

## Deployment

The root `Dockerfile` builds one immutable image used by all three Node services. The local
compose file is the reliable development fallback. The Akash template is under
`deploy/akash/`; it is coverage only and deliberately stays out of the critical Zero +
Pomerium demo path.

Integration-specific setup and proof requirements live under `docs/integrations/`.
