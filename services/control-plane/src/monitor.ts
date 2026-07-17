import { randomUUID } from "node:crypto";
import { SCHEMA_VERSION, type DemoState, type StockoutRiskEvent } from "@stockshield/contracts";

export interface InventoryMonitorStore {
  read(): DemoState | undefined;
  setMonitorActive(active: boolean): DemoState;
  markMonitorCheck(at?: string): DemoState;
}

export interface InventoryMonitorOptions {
  intervalMs?: number;
  requestedQty?: number;
  onError?: (error: unknown) => void;
}

export type StockoutRunner = (event: StockoutRiskEvent) => Promise<void>;

export async function checkInventoryOnce(
  store: InventoryMonitorStore,
  runStockout: StockoutRunner,
  requestedQty = 20,
): Promise<boolean> {
  const state = store.markMonitorCheck();
  const inventory = state.inventory;
  const shouldTrigger =
    state.monitor.active &&
    inventory.critical &&
    inventory.currentQty <= inventory.threshold &&
    inventory.inboundQty === 0 &&
    state.runStatus === "idle";

  if (!shouldTrigger) return false;

  const event: StockoutRiskEvent = {
    schemaVersion: SCHEMA_VERSION,
    type: "stockout_risk",
    eventId: randomUUID(),
    sku: inventory.sku,
    currentQty: inventory.currentQty,
    threshold: inventory.threshold,
    requestedQty,
    occurredAt: new Date().toISOString(),
    source: "monitor",
  };
  await runStockout(event);
  return true;
}

export function startInventoryMonitor(
  store: InventoryMonitorStore,
  runStockout: StockoutRunner,
  options: InventoryMonitorOptions = {},
): () => void {
  const intervalMs = options.intervalMs ?? 2_000;
  const requestedQty = options.requestedQty ?? 20;
  const onError = options.onError ?? ((error) => console.error("inventory monitor tick failed", error));
  let tickRunning = false;

  store.setMonitorActive(true);
  const timer = setInterval(() => {
    if (tickRunning) return;
    tickRunning = true;
    void checkInventoryOnce(store, runStockout, requestedQty)
      .catch(onError)
      .finally(() => { tickRunning = false; });
  }, intervalMs);
  timer.unref();

  return () => {
    clearInterval(timer);
    store.setMonitorActive(false);
  };
}
