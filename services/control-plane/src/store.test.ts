import assert from "node:assert/strict";
import test from "node:test";
import type { PurchaseOrder } from "@stockshield/contracts";
import { DemoStore } from "./store.ts";

const order: PurchaseOrder = {
  id: "po-store-1",
  vendorId: "vendor-northstar",
  sku: "DDR5-ECC-64GB",
  quantity: 20,
  totalAmountCents: 255_000,
  currency: "USD",
  status: "accepted",
  inboundStatus: "scheduled",
  createdAt: new Date().toISOString(),
};

test("store ledgers incidents, survives soft reset, and clears on hard reset", () => {
  const store = new DemoStore(":memory:");
  store.reset("datacenter");
  assert.deepEqual(store.history(), { provenVendorIds: [], knowsAuthorizationRequired: false });

  store.start(0);
  const completed = store.complete({
    blacklistedVendorIds: ["vendor-lookalike"],
    atRiskPoValuePreventedCents: 240_000,
    verificationSpendCents: 120,
    verificationMode: "fixture",
    order,
  });

  assert.equal(completed.learning.incidentCount, 1);
  assert.deepEqual(completed.learning.provenVendorIds, ["vendor-northstar"]);
  assert.ok((completed.learning.lastResolutionMs ?? -1) >= 0);
  assert.deepEqual(store.history(), {
    provenVendorIds: ["vendor-northstar"],
    knowsAuthorizationRequired: true,
  });

  const soft = store.reset();
  assert.equal(soft.learning.incidentCount, 1);
  assert.deepEqual(soft.learning.provenVendorIds, ["vendor-northstar"]);

  const hard = store.reset(undefined, true);
  assert.equal(hard.learning.incidentCount, 0);
  assert.deepEqual(store.history(), { provenVendorIds: [], knowsAuthorizationRequired: false });
});
