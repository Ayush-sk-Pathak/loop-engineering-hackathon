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
