# Pomerium Integration

**Owner:** Policy + Procurement. **Status:** origin assertion verification implemented; live
Pomerium Zero route and service accounts must be configured.

## Identity Model

The general agent and the verified vendor capability are separate machine identities:

- `procurement-agent`: authenticated but not allowed to call a vendor PO route. Its initial
  request produces the stage `403`.
- `vendor:vendor-northstar`: released only after evidence passes. It can call only the
  matching vendor path.

Pomerium authenticates the machine identity. StockShield's signed attestation independently
binds the PO object. Neither layer substitutes for the other.

## Data-plane topology (self-hosted)

Pomerium Zero is a **hosted control plane + self-hosted data plane**: you run the
Pomerium proxy yourself and bootstrap it with a cluster token (`POMERIUM_ZERO_TOKEN`).
Run the proxy **inside the same private network as procurement** (the compose network,
or the Akash deployment) so it reaches `http://procurement:4001` directly. No separate
tunnel/connector is required — the proxy is the ingress and the origin keeps no
published port. Public traffic terminates at the proxy; only the proxy can reach `4001`.

The default `compose.yaml` runs in development auth mode (no proxy); a commented
`pomerium` proxy service in that file documents the prize-mode topology.

## Pomerium Zero Setup (exact steps)

Console: <https://console.pomerium.app>. Confirm any renamed console labels in the
console while applying this live (B5).

**1. Cluster + self-hosted data plane.**
   - Create an organization + cluster in the Zero console; it issues a starter domain
     (`<starter-domain>`) and a **cluster token**.
   - Run the Pomerium proxy in your network with that token as `POMERIUM_ZERO_TOKEN`
     (image `pomerium/pomerium`, or the Zero-provided run command). It dials the control
     plane and pulls routes/policies/certs.

**2. Service accounts** (Settings → Service Accounts → **+ New Service Account**).
   Set each **User ID** explicitly — it is the value a policy matches with `user.is`,
   and the origin requires the assertion `sub` to equal it:
   - `procurement-agent` — the general agent. Authenticated but **not** granted the
     vendor route, so its request is the stage `403`.
   - `vendor:vendor-northstar` — the vendor capability. **User ID must be exactly
     `vendor:vendor-northstar`** (colon included) so it satisfies both the route policy
     (`user.is`) and the origin check `sub == vendor:<vendorId>` in
     `services/procurement/src/authorize.ts`.
   Save each token once (non-retrievable afterward): the `procurement-agent` token is
   `POMERIUM_AGENT_TOKEN`, the vendor token is `POMERIUM_VENDOR_TOKEN_VENDOR_NORTHSTAR`.
   The agent presents them as `Authorization: Bearer Pomerium-<token>` (already wired in
   `services/control-plane/src/runtime.ts`).

**3. Private route** (Routes → **New Route**).
   - **From:** `https://po.<starter-domain>` (public).
   - **To:** `http://procurement:4001` (private origin on the proxy's network).
   - Enable **Pass Identity Headers** (config-YAML equivalent `pass_identity_headers:
     true`) so the origin receives `X-Pomerium-Jwt-Assertion`.
   - **Policy:** paste the ALLOW body of `infra/pomerium/vendor-policy.example.yaml`
     (`user.is vendor:vendor-northstar` AND `POST` AND path `/po/vendor-northstar`).
     Everything else is denied — that implicit deny is the `procurement-agent` `403`.

**4. Environment** (set in the runtime `.env.local`, then `npm run doctor:prize`).

   | Variable | Value | Source |
   |---|---|---|
   | `AUTH_MODE` | `pomerium` | flips the origin to assertion verification |
   | `POMERIUM_ROUTE_URL` | `https://po.<starter-domain>` | route **From** URL |
   | `POMERIUM_JWKS_URL` | `https://po.<starter-domain>/.well-known/pomerium/jwks.json` | route domain + fixed path |
   | `POMERIUM_ISSUER` | `po.<starter-domain>` | route hostname (`iss` claim) |
   | `POMERIUM_AUDIENCE` | `po.<starter-domain>` | route hostname (`aud` claim) |
   | `POMERIUM_SUBJECT_PREFIX` | `vendor:` | origin builds `sub` = prefix + vendorId |
   | `POMERIUM_AGENT_TOKEN` | `procurement-agent` service-account token | step 2 |
   | `POMERIUM_VENDOR_TOKEN_VENDOR_NORTHSTAR` | `vendor:vendor-northstar` service-account token | step 2 |

The procurement origin verifies assertion signature, issuer, audience, expiry, and
`sub == vendor:<vendorId>`. It then verifies the signed StockShield attestation and every PO
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
