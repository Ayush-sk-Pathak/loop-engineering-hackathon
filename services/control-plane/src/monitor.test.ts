import assert from "node:assert/strict";
import test from "node:test";
import type { DemoState, StockoutRiskEvent } from "@stockshield/contracts";
import { checkInventoryOnce, type InventoryMonitorStore } from "./monitor.ts";

function state(overrides: Partial<DemoState> = {}): DemoState {
  return {
    runStatus: "idle",
    scenario: {
      id: "datacenter",
      label: "On-prem compute spares",
      industry: "Regulated datacenter",
      trigger: "Node failure drains the critical spares pool",
    },
    inventory: {
      sku: "DDR5-ECC-64GB",
      name: "64 GB DDR5 ECC Memory Module",
      currentQty: 2,
      threshold: 2,
      inboundQty: 0,
      critical: true,
      downtimeCostCentsPerMinute: 18_000,
    },
    monitor: { active: true, watchedSkus: ["DDR5-ECC-64GB"], lastCheckAt: null },
    events: [],
    vendors: [],
    blacklistedVendorIds: [],
    metrics: {
      atRiskPoValuePreventedCents: 0,
      verificationSpendCents: 0,
      inboundQuantity: 0,
      verificationMode: "fixture",
      authorizationMode: "development",
    },
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function store(initial: DemoState): InventoryMonitorStore {
  let current = initial;
  return {
    read: () => current,
    setMonitorActive: (active) => (current = {
      ...current,
      monitor: { ...current.monitor, active },
    }),
    markMonitorCheck: (at = new Date().toISOString()) => (current = {
      ...current,
      monitor: { ...current.monitor, lastCheckAt: at },
    }),
  };
}

test("monitor fires a Nexla-compatible event at the critical threshold", async () => {
  const events: StockoutRiskEvent[] = [];
  const triggered = await checkInventoryOnce(store(state()), async (event) => {
    events.push(event);
  });

  assert.equal(triggered, true);
  assert.equal(events.length, 1);
  assert.equal(events[0]?.source, "monitor");
  assert.equal(events[0]?.sku, "DDR5-ECC-64GB");
});

test("monitor does not fire during a run or when inbound is scheduled", async () => {
  let calls = 0;
  const run = async () => { calls += 1; };

  assert.equal(await checkInventoryOnce(store(state({ runStatus: "running" })), run), false);
  assert.equal(await checkInventoryOnce(store(state({
    inventory: { ...state().inventory, inboundQty: 20 },
  })), run), false);
  assert.equal(calls, 0);
});
