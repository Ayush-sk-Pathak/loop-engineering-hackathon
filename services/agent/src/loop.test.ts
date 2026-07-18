import assert from "node:assert/strict";
import test from "node:test";
import type {
  DecisionEvent,
  ProcurementCredential,
  PurchaseOrder,
  StockoutRiskEvent,
  VendorAttestation,
} from "@continuim/contracts";
import { DEMO_VENDORS, evaluateEvidence, fixtureEvidence } from "@continuim/verification";
import { runProcurementLoop } from "./index.ts";

test("loop blacklists the lookalike, proves denial, and orders from the eligible vendor", async () => {
  const events: DecisionEvent[] = [];
  const event: StockoutRiskEvent = {
    schemaVersion: "1.2",
    type: "stockout_risk",
    eventId: "stockout-1",
    sku: "DDR5-ECC-64GB",
    currentQty: 0,
    threshold: 3,
    requestedQty: 20,
    occurredAt: new Date().toISOString(),
    source: "local",
  };
  const result = await runProcurementLoop(event, DEMO_VENDORS, {
    verification: {
      async verify(vendor) {
        return evaluateEvidence(vendor, fixtureEvidence(vendor), "secret");
      },
    },
    credentials: {
      async forAttestation(_attestation: VendorAttestation): Promise<ProcurementCredential> {
        return { kind: "development", attestation: _attestation };
      },
    },
    procurement: {
      async submit(request, credential) {
        if (!credential) {
          return { status: 403, reason: "missing capability", enforcementPoint: "development", requestId: "deny-1" };
        }
        const order: PurchaseOrder = {
          id: "po-1",
          vendorId: request.vendorId,
          sku: request.sku,
          quantity: request.quantity,
          totalAmountCents: request.unitPriceCents * request.quantity,
          currency: request.currency,
          status: "accepted",
          inboundStatus: "scheduled",
          createdAt: new Date().toISOString(),
        };
        return { status: 201, order, enforcementPoint: "development", requestId: "allow-1" };
      },
    },
    decisions: { async emit(decision) { events.push(decision); } },
  });

  assert.deepEqual(result.blacklistedVendorIds, ["vendor-lookalike"]);
  assert.equal(result.orderedVendorId, "vendor-northstar");
  assert.equal(result.atRiskPoValuePreventedCents, 240_000);
  assert.ok(events.some((item) => item.phase === "authorization_denied"));
  assert.ok(events.some((item) => item.phase === "replanned"));
  assert.ok(events.some((item) => item.phase === "inbound_scheduled"));
});
