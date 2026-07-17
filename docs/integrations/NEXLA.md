# Nexla FlexFlow Integration

**Owner:** Dashboard + Data. **Status:** authenticated webhook ingress implemented; FlexFlow
must be configured in Nexla.

Local development uses an always-on inventory monitor that emits the identical v1.1 event
shape with `source: "monitor"`. This proves the autonomous control flow but is not Nexla
integration proof. Prize proof still requires the Nexla event ID below.

## FlexFlow design

One FlexFlow turns a real-time critical-spares inventory stream into a stockout trigger:
a raw inventory record is normalized to the frozen v1.1 `StockoutRiskEvent` contract, gated
to genuine stockouts, and delivered to the control plane's authenticated webhook. Four
stages, source → transform → filter → destination:

**1. Source — webhook (push) data source.** Critical-spares updates arrive as records on a
Nexla webhook source (one record per SKU observation: SKU, on-hand quantity, reorder point,
site, observed-at timestamp). Nexla stamps each record with a run/record identifier — that
identifier is what the transform carries through as `eventId`, so the *same* ID appears in
the Nexla flow log and in the StockShield decision trail (this is the "prove the event ID
end to end" claim).

**2. Transform — attribute transform to schema v1.1.** Map the raw record onto the exact
shape the control plane validates (`packages/contracts` → `StockoutRiskEvent`; the payload
below). Every field is required and type-checked server-side:

| v1.1 field | Transform value | Notes |
|---|---|---|
| `schemaVersion` | `"1.1"` (constant) | must equal `SCHEMA_VERSION`; an old schema is rejected |
| `type` | `"stockout_risk"` (constant) | |
| `eventId` | Nexla run/record id (e.g. `{{ nexla_run_id }}`) | non-empty; becomes the decision-trail `correlationId` |
| `sku` | raw `sku` | non-empty; must match a configured scenario SKU (else `400`) |
| `currentQty` | raw on-hand qty | safe integer ≥ 0 |
| `threshold` | raw reorder point | safe integer ≥ 0 |
| `requestedQty` | replenishment lot (constant `20`, or `target − currentQty`) | not in the source — transform-computed; integer > 0 |
| `occurredAt` | raw observed-at, as ISO-8601 | must be `Date.parse`-able |
| `source` | `"nexla"` (constant) | the ingress endpoint accepts only `source: "nexla"` |

**3. Filter — `currentQty <= threshold`.** A Nexla filter rule forwards only records at or
below the reorder point; everything else is dropped before the destination. The control
plane re-checks the identical condition and returns `400` if it fails, so the filter is the
efficiency gate (don't POST healthy-stock records), not the trust boundary.

**4. Destination — webhook to the control plane.** POST the transformed record to
`POST {CONTROL_PLANE_URL}/api/events/stockout` (canonical local: `http://127.0.0.1:4000`),
content-type `application/json`, with header
`X-StockShield-Webhook-Secret: {{ NEXLA_WEBHOOK_SECRET }}`. When the control plane has
`NEXLA_WEBHOOK_SECRET` set, a missing/mismatched header is rejected `401`; when it is unset
(local dev) the header is ignored. A successful ingest returns `202
{"accepted":true,"eventId":"<the Nexla id>"}`; the control plane then runs autonomously and
rejects a second event while a run is active (`409`).

Canonical destination payload:

```json
{
  "schemaVersion": "1.1",
  "type": "stockout_risk",
  "eventId": "nexla-event-001",
  "sku": "DDR5-ECC-64GB",
  "currentQty": 0,
  "threshold": 2,
  "requestedQty": 20,
  "occurredAt": "2026-07-17T19:30:00.000Z",
  "source": "nexla"
}
```

Local ingress check:

```bash
curl -i http://127.0.0.1:4000/api/events/stockout \
  -H 'content-type: application/json' \
  -H "x-stockshield-webhook-secret: $NEXLA_WEBHOOK_SECRET" \
  --data @config/nexla-stockout.example.json
```

The endpoint rejects an old schema, invalid quantities, non-Nexla source, bad secret, and a
second event while a run is active. For the prize claim, show the Nexla flow/event ID and the
same ID in the StockShield decision trail.

## Local ingress rehearsal (verified 2026-07-17)

Rehearsed in the lane-C worktree stack — control plane `:4400`, procurement `:4401`,
`MONITOR_ENABLED=0`, `AUTH_MODE=development`, `VERIFICATION_MODE=fixture` — by POSTing the
canonical payload above to `/api/events/stockout` (no `NEXLA_WEBHOOK_SECRET` configured, so
no secret header was required):

- Ingest returned `202 {"accepted":true,"eventId":"nexla-event-001"}`.
- The autonomous run drained to `runStatus:"complete"` with a 14-phase decision trail:
  `observed → planned → sourced → authorization_attempted → authorization_denied →
  replanned → verifying → ineligible → blacklisted → sourced → verifying → attested →
  ordered → inbound_scheduled`.
- **Every trail event carried `correlationId: "nexla-event-001"`** — the posted `eventId`
  is the decision-trail correlation key end to end (`services/agent/src/index.ts:67`).
- Resulting order `PO-45CA6A84`, 20 units, inbound scheduled.

This exercises the local ingress contract only; it is **not** Nexla-integration proof. The
live FlexFlow flow → canonical ingress carrying the Nexla-issued event ID is the prize item
(ROADMAP: "connect Nexla FlexFlow and prove the event ID end to end").
