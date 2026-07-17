import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { DecisionEvent, DemoState, PurchaseOrder } from "@stockshield/contracts";
import { DEMO_VENDORS } from "@stockshield/verification";

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
    if (!this.read()) this.reset();
  }

  reset(): DemoState {
    this.database.exec("DELETE FROM decision_events");
    const state: DemoState = {
      runStatus: "idle",
      inventory: {
        sku: "LAPTOP-14",
        name: "Aperture Pro 14",
        currentQty: 4,
        threshold: 3,
        inboundQty: 0,
      },
      events: [],
      vendors: DEMO_VENDORS,
      blacklistedVendorIds: [],
      metrics: {
        atRiskPoValuePreventedCents: 0,
        verificationSpendCents: 0,
        inboundQuantity: 0,
        verificationMode: "fixture",
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

  start(): DemoState {
    return this.update((state) => ({
      ...state,
      runStatus: "running",
      inventory: { ...state.inventory, currentQty: 0 },
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
        inboundQuantity: input.order?.quantity ?? 0,
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
