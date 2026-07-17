# Nexla FlexFlow Integration

**Owner:** Dashboard + Data. **Status:** authenticated webhook ingress implemented; FlexFlow
must be configured in Nexla.

Local development uses an always-on inventory monitor that emits the identical v1.1 event
shape with `source: "monitor"`. This proves the autonomous control flow but is not Nexla
integration proof. Prize proof still requires the Nexla event ID below.

## Flow

1. Use a Nexla webhook source for critical-spares inventory updates.
2. Transform the source record into schema v1.1.
3. Filter for `currentQty <= threshold`.
4. Send the transformed record to `POST /api/events/stockout` on the control plane.
5. Add `X-StockShield-Webhook-Secret` when `NEXLA_WEBHOOK_SECRET` is configured.

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
