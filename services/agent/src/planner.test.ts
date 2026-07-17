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
import { runProcurementLoop, type LoopResult, type PlannerPort } from "./index.ts";

const event: StockoutRiskEvent = {
  schemaVersion: "1.1",
  type: "stockout_risk",
  eventId: "stockout-planner-1",
  sku: "DDR5-ECC-64GB",
  currentQty: 0,
  threshold: 3,
  requestedQty: 20,
  occurredAt: new Date().toISOString(),
  source: "local",
};

async function runWithPlanner(
  planner: PlannerPort,
  events: DecisionEvent[],
): Promise<LoopResult> {
  return runProcurementLoop(event, DEMO_VENDORS, {
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
          id: "po-planner-1",
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
    planner,
  });
}

// The deterministic policy ranks the cheaper vendor-lookalike first; a disagreeing
// planner that prefers vendor-northstar must not change which vendor is attempted,
// denied, blacklisted, or ordered — its output never feeds verify/authorize.
test("policy ranking wins when the advisory planner disagrees", async () => {
  const events: DecisionEvent[] = [];
  const planner: PlannerPort = {
    async advise() {
      return {
        preferredVendorIds: ["vendor-northstar", "vendor-lookalike"],
        rationale: "The established supplier looks safer to me.",
      };
    },
  };
  const result = await runWithPlanner(planner, events);

  // Outcome is identical to the no-planner run: the lookalike is still attempted,
  // denied, and blacklisted; the eligible vendor is still the one ordered.
  assert.deepEqual(result.blacklistedVendorIds, ["vendor-lookalike"]);
  assert.equal(result.orderedVendorId, "vendor-northstar");
  assert.equal(result.atRiskPoValuePreventedCents, 240_000);
  assert.ok(events.some((item) => item.phase === "authorization_denied"));
});

test("planner/policy disagreement is logged as advisory metadata", async () => {
  const events: DecisionEvent[] = [];
  const planner: PlannerPort = {
    async advise() {
      return {
        preferredVendorIds: ["vendor-northstar"],
        rationale: "The established supplier looks safer to me.",
      };
    },
  };
  await runWithPlanner(planner, events);

  const advisory = events.find(
    (item) => item.phase === "planned" && item.metadata?.planner === "advisory",
  );
  assert.ok(advisory, "expected an advisory planned event");
  assert.equal(advisory.metadata?.policyOverride, true);
  assert.equal(advisory.metadata?.plannerPreferredVendorId, "vendor-northstar");
  assert.equal(advisory.metadata?.policySelectedVendorId, "vendor-lookalike");
  assert.equal(
    advisory.metadata?.plannerRationale,
    "The established supplier looks safer to me.",
  );
});

test("a throwing planner never disrupts the deterministic loop", async () => {
  const events: DecisionEvent[] = [];
  const planner: PlannerPort = {
    async advise() {
      throw new Error("model transport unavailable");
    },
  };
  const result = await runWithPlanner(planner, events);

  assert.equal(result.orderedVendorId, "vendor-northstar");
  assert.deepEqual(result.blacklistedVendorIds, ["vendor-lookalike"]);
  assert.ok(!events.some((item) => item.metadata?.planner === "advisory"));
});
