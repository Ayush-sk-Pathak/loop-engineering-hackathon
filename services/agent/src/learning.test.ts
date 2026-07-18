import assert from "node:assert/strict";
import test from "node:test";
import type {
  DecisionEvent,
  ProcurementCredential,
  PurchaseOrder,
  StockoutRiskEvent,
  VendorAttestation,
  VendorCandidate,
} from "@continuim/contracts";
import { DEMO_VENDORS, evaluateEvidence, fixtureEvidence } from "@continuim/verification";
import { runProcurementLoop, type LoopHistory, type LoopResult } from "./index.ts";

const event: StockoutRiskEvent = {
  schemaVersion: "1.2",
  type: "stockout_risk",
  eventId: "stockout-learning-1",
  sku: "DDR5-ECC-64GB",
  currentQty: 0,
  threshold: 3,
  requestedQty: 20,
  occurredAt: new Date().toISOString(),
  source: "local",
};

async function runWithHistory(
  candidates: VendorCandidate[],
  history: LoopHistory,
  events: DecisionEvent[],
): Promise<LoopResult> {
  return runProcurementLoop(event, candidates, {
    verification: {
      async verify(vendor) {
        return evaluateEvidence(vendor, fixtureEvidence(vendor), "secret");
      },
    },
    credentials: {
      async forAttestation(_attestation: VendorAttestation): Promise<ProcurementCredential> {
        return { attestation: _attestation };
      },
    },
    procurement: {
      async submit(request, credential) {
        if (!credential) {
          return { status: 403, reason: "missing capability", enforcementPoint: "origin", requestId: "deny-1" };
        }
        const order: PurchaseOrder = {
          id: "po-learning-1",
          vendorId: request.vendorId,
          sku: request.sku,
          quantity: request.quantity,
          totalAmountCents: request.unitPriceCents * request.quantity,
          currency: request.currency,
          status: "accepted",
          inboundStatus: "scheduled",
          createdAt: new Date().toISOString(),
        };
        return { status: 201, order, enforcementPoint: "origin", requestId: "allow-1" };
      },
    },
    decisions: { async emit(decision) { events.push(decision); } },
  }, 0, history);
}

test("loop recalls the authorization requirement and skips the unattested probe", async () => {
  const events: DecisionEvent[] = [];
  const result = await runWithHistory(
    DEMO_VENDORS,
    { provenVendorIds: [], knowsAuthorizationRequired: true },
    events,
  );

  assert.ok(events.some((item) => item.phase === "recalled_history"));
  assert.ok(!events.some((item) => item.phase === "authorization_attempted"));
  assert.ok(!events.some((item) => item.phase === "authorization_denied"));
  assert.equal(result.orderedVendorId, "vendor-northstar");
  assert.equal(result.deniedRequestId, undefined);
  assert.equal(result.deniedEnforcementPoint, undefined);
  assert.equal(result.atRiskPoValuePreventedCents, 0);
});

test("loop ranks a proven vendor ahead of a cheaper unproven candidate", async () => {
  const proven: VendorCandidate = {
    ...DEMO_VENDORS[1]!,
    id: "vendor-proven",
    quote: { ...DEMO_VENDORS[1]!.quote, id: "quote-proven-1", unitPriceCents: 130_00 },
  };
  const cheaper: VendorCandidate = {
    ...DEMO_VENDORS[1]!,
    id: "vendor-cheaper",
    quote: { ...DEMO_VENDORS[1]!.quote, id: "quote-cheaper-1", unitPriceCents: 100_00 },
  };
  const events: DecisionEvent[] = [];
  const result = await runWithHistory(
    [cheaper, proven],
    { provenVendorIds: ["vendor-proven"], knowsAuthorizationRequired: true },
    events,
  );

  const firstSourced = events.find((item) => item.phase === "sourced");
  assert.equal(firstSourced?.vendorId, "vendor-proven");
  assert.ok(firstSourced?.detail.includes("prioritized: proven fulfillment"));
  assert.equal(result.orderedVendorId, "vendor-proven");
});
