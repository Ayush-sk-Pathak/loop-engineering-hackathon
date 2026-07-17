import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { DecisionEvent, DemoState, EvidenceMode, IncidentRecord, PurchaseOrder, ScenarioId } from "@continuim/contracts";
import { SCENARIOS } from "@continuim/verification";

function defaultScenarioId(): ScenarioId {
  const configured = process.env.SCENARIO;
  return configured && configured in SCENARIOS ? (configured as ScenarioId) : "datacenter";
}

export class DemoStore {
  private readonly database: DatabaseSync;
  private runStartedAt: string | null = null;

  constructor(path = process.env.SQLITE_PATH ?? "data/continuim.db") {
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
      CREATE TABLE IF NOT EXISTS incidents (
        id TEXT PRIMARY KEY,
        scenario_id TEXT NOT NULL,
        sku TEXT NOT NULL,
        resolution_ms INTEGER NOT NULL,
        ordered_vendor_id TEXT,
        payload TEXT NOT NULL,
        resolved_at TEXT NOT NULL
      );
    `);
    const current = this.read();
    if (!current || !current.monitor || !current.scenario) {
      this.reset();
    }
  }

  reset(scenarioId?: ScenarioId, hard = false): DemoState {
    const scenario = SCENARIOS[scenarioId ?? this.read()?.scenario?.id ?? defaultScenarioId()];
    this.database.exec("DELETE FROM decision_events");
    if (hard) this.database.exec("DELETE FROM incidents");
    this.runStartedAt = null;
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
      learning: this.learningSummary(scenario.id),
      updatedAt: new Date().toISOString(),
    };
    this.write(state);
    return state;
  }

  read(): DemoState | undefined {
    const row = this.database.prepare("SELECT payload FROM demo_state WHERE id = 1").get() as
      | { payload: string }
      | undefined;
    if (!row) return undefined;
    const state = JSON.parse(row.payload) as DemoState;
    if (state.scenario) state.learning = this.learningSummary(state.scenario.id);
    return state;
  }

  history(): { provenVendorIds: string[]; knowsAuthorizationRequired: boolean } {
    const learning = this.learningSummary(this.read()?.scenario?.id ?? defaultScenarioId());
    // Simplest honest signal: every completed run either observed the unattested
    // denial or recalled it, so any recorded incident implies the requirement is known.
    return {
      provenVendorIds: learning.provenVendorIds,
      knowsAuthorizationRequired: learning.incidentCount > 0,
    };
  }

  start(currentQty = 0, sku?: string): DemoState {
    const current = this.read();
    if (sku && current?.inventory.sku !== sku) {
      const matchingScenario = Object.values(SCENARIOS).find(
        (scenario) => scenario.item.sku === sku,
      );
      if (!matchingScenario) throw new Error(`No scenario is configured for SKU ${sku}`);
      this.reset(matchingScenario.id);
    }
    this.runStartedAt = new Date().toISOString();
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

  setClientIncident(nodeId: string, faultType: string): DemoState {
    return this.update((state) => ({
      ...state,
      clientIncident: { nodeId, faultType, detectedAt: new Date().toISOString() },
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
    this.recordIncident(input);
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

  private recordIncident(input: {
    blacklistedVendorIds: string[];
    atRiskPoValuePreventedCents: number;
    verificationSpendCents: number;
    verificationMode: EvidenceMode;
    order?: PurchaseOrder;
  }): void {
    const state = this.read();
    if (!state) return;
    const resolvedAt = new Date().toISOString();
    const startedAt = this.runStartedAt ?? resolvedAt;
    const incident: IncidentRecord = {
      id: randomUUID(),
      scenarioId: state.scenario.id,
      sku: state.inventory.sku,
      startedAt,
      resolvedAt,
      resolutionMs: Math.max(0, Date.parse(resolvedAt) - Date.parse(startedAt)),
      orderedVendorId: input.order?.vendorId ?? null,
      blacklistedVendorIds: input.blacklistedVendorIds,
      verificationSpendCents: input.verificationSpendCents,
      poValueCents: input.order?.totalAmountCents ?? 0,
      atRiskPoValuePreventedCents: input.atRiskPoValuePreventedCents,
      evidenceMode: input.verificationMode,
    };
    this.database.prepare(
      "INSERT INTO incidents (id, scenario_id, sku, resolution_ms, ordered_vendor_id, payload, resolved_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run(
      incident.id,
      incident.scenarioId,
      incident.sku,
      incident.resolutionMs,
      incident.orderedVendorId,
      JSON.stringify(incident),
      incident.resolvedAt,
    );
    this.runStartedAt = null;
  }

  private learningSummary(scenarioId: ScenarioId): DemoState["learning"] {
    const count = this.database
      .prepare("SELECT COUNT(*) AS count FROM incidents WHERE scenario_id = ?")
      .get(scenarioId) as { count: number };
    const last = this.database
      .prepare("SELECT resolution_ms FROM incidents WHERE scenario_id = ? ORDER BY rowid DESC LIMIT 1")
      .get(scenarioId) as { resolution_ms: number } | undefined;
    const proven = this.database
      .prepare("SELECT DISTINCT ordered_vendor_id AS id FROM incidents WHERE scenario_id = ? AND ordered_vendor_id IS NOT NULL")
      .all(scenarioId) as { id: string }[];
    return {
      incidentCount: count.count,
      lastResolutionMs: last?.resolution_ms ?? null,
      provenVendorIds: proven.map((row) => row.id),
    };
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
