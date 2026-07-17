# Pomerium Integration

**Owner:** Policy + Procurement. **Status:** origin assertion verification implemented; live
Pomerium Zero route and service accounts must be configured.

## Identity Model

The general agent and the verified vendor capability are separate machine identities:

- `procurement-agent`: authenticated but not allowed to call a vendor PO route. Its initial
  request produces the stage `403`.
- `vendor:vendor-northstar`: released only after evidence passes. It can call only the
  matching vendor path.

Pomerium authenticates the machine identity. Continuim's signed attestation independently
binds the PO object. Neither layer substitutes for the other.

## Pomerium Zero Setup

1. Create a Pomerium Zero cluster and private route to `http://procurement:4001` or the
   equivalent internal origin.
2. Enable **Pass Identity Headers** so the origin receives `X-Pomerium-Jwt-Assertion`.
3. Create the two service accounts above and save their one-time tokens securely.
4. Apply the route policy in `infra/pomerium/vendor-policy.example.yaml`.
5. Set the `POMERIUM_*` variables from `config/example.env` and run
   `npm run doctor:prize`.

The procurement origin verifies assertion signature, issuer, audience, expiry, and
`sub == vendor:<vendorId>`. It then verifies the signed Continuim attestation and every PO
binding. Never authorize on an unsigned `vendorId` header.

## Required Network Boundary

In prize mode, do not publish port `4001`. The origin must be reachable only by Pomerium on
the private container network. Local npm mode binds it to `127.0.0.1` and is explicitly
labeled development-only.

## Stage Proof

For the denied `procurement-agent` request, capture:

- HTTP status `403` and Pomerium/Envoy request ID.
- Pomerium authorize log with `allow:false`, reason fields, path, and service-account ID.
- No matching request in the procurement origin log.

Then use the verified-vendor service account and show `201`, the same route, the origin's
signed-assertion verification, and the PO ID. An application-generated `403` is not Pomerium
proof.
