import assert from "node:assert/strict";
import test from "node:test";
import type { PlannerContext } from "@stockshield/agent";
import {
  createClaudePlanner,
  createPlannerFromEnv,
  resolvePlannerTransport,
  type ClaudeTransport,
} from "./claude.ts";

const context: PlannerContext = {
  stockout: {
    schemaVersion: "1.1",
    type: "stockout_risk",
    eventId: "planner-e1",
    sku: "DDR5-ECC-64GB",
    currentQty: 0,
    threshold: 3,
    requestedQty: 20,
    occurredAt: new Date().toISOString(),
    source: "local",
  },
  rankedCandidates: [
    {
      id: "vendor-a",
      legalName: "Alpha Supply",
      tradingName: "Alpha",
      domain: "alpha.example",
      synthetic: true,
      quote: {
        id: "quote-a",
        sku: "DDR5-ECC-64GB",
        payeeName: "Alpha Supply",
        payeeAccountRef: "ref-a",
        unitPriceCents: 100_00,
        currency: "USD",
        availableQty: 20,
        leadTimeDays: 1,
      },
    },
  ],
};

function fakeTransport(reply: string): ClaudeTransport {
  return { async complete() { return reply; } };
}

test("planner parses structured JSON advice from the model", async () => {
  const planner = createClaudePlanner(
    fakeTransport('{"preferredVendorIds":["vendor-a"],"rationale":"Established footprint."}'),
  );
  const advice = await planner.advise(context);
  assert.deepEqual(advice.preferredVendorIds, ["vendor-a"]);
  assert.equal(advice.rationale, "Established footprint.");
});

test("planner tolerates prose-wrapped JSON and non-JSON replies", async () => {
  const wrapped = await createClaudePlanner(
    fakeTransport('Here is my take: {"rationale":"Looks fine."} hope that helps'),
  ).advise(context);
  assert.equal(wrapped.rationale, "Looks fine.");
  assert.equal(wrapped.preferredVendorIds, undefined);

  const prose = await createClaudePlanner(
    fakeTransport("I could not produce JSON"),
  ).advise(context);
  assert.equal(prose.rationale, "I could not produce JSON");
  assert.equal(prose.preferredVendorIds, undefined);
});

test("PLANNER_MODE=off (the default) wires no planner", () => {
  assert.equal(createPlannerFromEnv({}), undefined);
  assert.equal(createPlannerFromEnv({ PLANNER_MODE: "off" }), undefined);
  assert.equal(resolvePlannerTransport({ PLANNER_MODE: "off" }), null);
});

test("explicit modes resolve a transport; enabled-but-unconfigured fails closed", () => {
  assert.notEqual(
    resolvePlannerTransport({ PLANNER_MODE: "anthropic", ANTHROPIC_API_KEY: "test-key" }),
    null,
  );
  assert.notEqual(
    resolvePlannerTransport({ PLANNER_MODE: "bedrock", AWS_REGION: "us-east-1" }),
    null,
  );
  assert.throws(() => resolvePlannerTransport({ PLANNER_MODE: "auto" }));
  assert.throws(() => resolvePlannerTransport({ PLANNER_MODE: "anthropic" }));
});
