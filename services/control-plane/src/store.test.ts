import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { PurchaseOrder } from "@continuim/contracts";
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

test("store persists a client incident with the live control-plane state", () => {
  const store = new DemoStore(":memory:");
  store.reset("datacenter");

  store.setClientIncident("meridian", "gpu-07", "node_offline");
  const incident = store.read()?.clientIncident;
  assert.equal(incident?.nodeId, "gpu-07");
  assert.equal(incident?.clientId, "meridian");
  assert.equal(incident?.faultType, "node_offline");
  assert.ok(!Number.isNaN(Date.parse(incident?.detectedAt ?? "")));

  assert.equal(store.reset().clientIncident, undefined);
});

test("client-scoped stores keep concurrent client recovery state isolated", () => {
  const directory = mkdtempSync(join(tmpdir(), "continuim-client-state-"));
  try {
    const database = join(directory, "control-plane.db");
    const meridian = new DemoStore(database, "meridian");
    const northwind = new DemoStore(database, "northwind");
    meridian.reset("datacenter");
    northwind.reset("apparel");

    meridian.setClientIncident("meridian", "gpu-02", "thermal_runaway");
    northwind.setClientIncident("northwind", "navy-dye-line-04", "supplier_delay");
    meridian.start(0);
    northwind.start(0);

    assert.equal(meridian.read()?.scenario.id, "datacenter");
    assert.equal(meridian.read()?.clientIncident?.nodeId, "gpu-02");
    assert.equal(meridian.read()?.runStatus, "running");
    assert.equal(northwind.read()?.scenario.id, "apparel");
    assert.equal(northwind.read()?.clientIncident?.nodeId, "navy-dye-line-04");
    assert.equal(northwind.read()?.runStatus, "running");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
