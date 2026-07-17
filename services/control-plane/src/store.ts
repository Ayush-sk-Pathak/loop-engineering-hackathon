import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { DecisionEvent, DemoState, PurchaseOrder, ScenarioId } from "@stockshield/contracts";
import { SCENARIOS } from "@stockshield/verification";

function defaultScenarioId(): ScenarioId {
  const configured = process.env.SCENARIO;
  return configured && configured in SCENARIOS ? (configured as ScenarioId) : "datacenter";
}

export class DemoStore {
  private readonly database: DatabaseSync;

  constructor(path = process.env.SQLITE_PATH ?? "data/stockshield.db") {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.database = new DatabaseSync(path);
    this.database.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS demo_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        payload TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS decision_events (
        id TEXT PRIMARY KEY,
        correlation_id TEXT NOT NULL,
        phase TEXT NOT NULL,
        payload TEXT NOT NULL,
        occurred_at TEXT NOT NULL
      );
    `);
    const current = this.read();
    if (!current || !current.monitor || !current.scenario) {
      this.reset();
    }
  }

  reset(scenarioId?: ScenarioId): DemoState {
    const scenario = SCENARIOS[scenarioId ?? this.read()?.scenario?.id ?? defaultScenarioId()];
    this.database.exec("DELETE FROM decision_events");
    const state: DemoState = {
      runStatus: "idle",
      scenario: {
        id: scenario.id,
        label: scenario.label,
        industry: scenario.industry,
        trigger: scenario.trigger,
      },
      inventory: {
        sku: scenario.item.sku,
        name: scenario.item.displayName,
        currentQty: scenario.item.currentQty,
        threshold: scenario.item.threshold,
        inboundQty: 0,
        critical: scenario.item.critical,
        downtimeCostCentsPerMinute: scenario.item.downtimeCostCentsPerMinute,
      },
      monitor: {
        active: process.env.MONITOR_ENABLED !== "0",
        watchedSkus: [scenario.item.sku],
        lastCheckAt: null,
      },
      events: [],
      vendors: scenario.vendors,
      blacklistedVendorIds: [],
      metrics: {
        atRiskPoValuePreventedCents: 0,
        verificationSpendCents: 0,
        inboundQuantity: 0,
        verificationMode: "fixture",
        authorizationMode: process.env.AUTH_MODE === "pomerium" ? "pomerium" : "development",
      },
      updatedAt: new Date().toISOString(),
    };
    this.write(state);
    return state;
  }

  read(): DemoState | undefined {
    const row = this.database.prepare("SELECT payload FROM demo_state WHERE id = 1").get() as
      | { payload: string }
      | undefined;
    return row ? (JSON.parse(row.payload) as DemoState) : undefined;
  }

  start(currentQty = 0): DemoState {
    return this.update((state) => ({
      ...state,
      runStatus: "running",
      inventory: { ...state.inventory, currentQty },
    }));
  }

  consumeUnit(): DemoState {
    return this.update((state) => ({
      ...state,
      inventory: {
        ...state.inventory,
        currentQty: Math.max(0, state.inventory.currentQty - 1),
      },
    }));
  }

  setMonitorActive(active: boolean): DemoState {
    return this.update((state) => ({
      ...state,
      monitor: { ...state.monitor, active },
    }));
  }

  markMonitorCheck(at = new Date().toISOString()): DemoState {
    return this.update((state) => ({
      ...state,
      monitor: { ...state.monitor, lastCheckAt: at },
    }));
  }

  appendEvent(event: DecisionEvent): DemoState {
    this.database.prepare(
      "INSERT INTO decision_events (id, correlation_id, phase, payload, occurred_at) VALUES (?, ?, ?, ?, ?)",
    ).run(event.id, event.correlationId, event.phase, JSON.stringify(event), event.occurredAt);
    return this.update((state) => ({ ...state, events: [...state.events, event] }));
  }

  complete(input: {
    blacklistedVendorIds: string[];
    atRiskPoValuePreventedCents: number;
    verificationSpendCents: number;
    verificationMode: DemoState["metrics"]["verificationMode"];
    deniedRequestId?: string;
    deniedEnforcementPoint?: DemoState["metrics"]["deniedEnforcementPoint"];
    order?: PurchaseOrder;
  }): DemoState {
    return this.update((state) => ({
      ...state,
      runStatus: input.order ? "complete" : "failed",
      blacklistedVendorIds: input.blacklistedVendorIds,
      order: input.order,
      inventory: {
        ...state.inventory,
        inboundQty: input.order?.quantity ?? 0,
      },
      metrics: {
        ...state.metrics,
        atRiskPoValuePreventedCents: input.atRiskPoValuePreventedCents,
        verificationSpendCents: input.verificationSpendCents,
        verificationMode: input.verificationMode,
        inboundQuantity: input.order?.quantity ?? 0,
        deniedRequestId: input.deniedRequestId,
        deniedEnforcementPoint: input.deniedEnforcementPoint,
      },
    }));
  }

  fail(): DemoState {
    return this.update((state) => ({ ...state, runStatus: "failed" }));
  }

  private update(mutator: (state: DemoState) => DemoState): DemoState {
    const current = this.read() ?? this.reset();
    const next = { ...mutator(current), updatedAt: new Date().toISOString() };
    this.write(next);
    return next;
  }

  private write(state: DemoState): void {
    this.database
      .prepare("INSERT INTO demo_state (id, payload) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload")
      .run(JSON.stringify(state));
  }
}
