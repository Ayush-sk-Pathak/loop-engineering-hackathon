import type { IncidentRecord, LedgerEntry } from "../types";

const LEDGER_KEY = "continuum.ledger.v1";
const INCIDENTS_KEY = "continuum.incidents.v1";

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

export function loadLedger(): LedgerEntry[] {
  return readJson<LedgerEntry[]>(LEDGER_KEY, []);
}

export function saveLedger(entries: LedgerEntry[]): void {
  writeJson(LEDGER_KEY, entries);
}

export function findWarmPath(incidentType: string): LedgerEntry | null {
  const entries = loadLedger();
  const hit = entries.find((e) => e.incidentType === incidentType && e.hits >= 1);
  return hit ?? null;
}

export function upsertLedgerEntry(input: {
  incidentType: string;
  vendorId: string;
  vendorName: string;
  fee: number;
  latencyMs: number;
}): LedgerEntry[] {
  const entries = loadLedger();
  const idx = entries.findIndex((e) => e.incidentType === input.incidentType);
  const now = Date.now();

  if (idx >= 0) {
    const prev = entries[idx];
    entries[idx] = {
      ...prev,
      vendorId: input.vendorId,
      vendorName: input.vendorName,
      fee: input.fee,
      latencyMs: Math.round((prev.latencyMs * prev.hits + input.latencyMs) / (prev.hits + 1)),
      confidence: Math.min(99, prev.confidence + 4),
      lastUsed: now,
      hits: prev.hits + 1,
    };
  } else {
    entries.push({
      incidentType: input.incidentType,
      vendorId: input.vendorId,
      vendorName: input.vendorName,
      fee: input.fee,
      latencyMs: input.latencyMs,
      confidence: 72,
      lastUsed: now,
      hits: 1,
    });
  }

  saveLedger(entries);
  return entries;
}

export function loadIncidents(): IncidentRecord[] {
  return readJson<IncidentRecord[]>(INCIDENTS_KEY, seedIncidents());
}

export function saveIncidents(records: IncidentRecord[]): void {
  writeJson(INCIDENTS_KEY, records);
}

export function appendIncident(record: IncidentRecord): IncidentRecord[] {
  const all = loadIncidents();
  const next = [record, ...all].slice(0, 40);
  saveIncidents(next);
  return next;
}

function seedIncidents(): IncidentRecord[] {
  const now = Date.now();
  return [
    {
      id: "inc_seed_1",
      scenarioId: "traffic-spike",
      type: "traffic_anomaly",
      site: "global · edge mesh",
      title: "Sudden traffic spike",
      severity: "high",
      vendorId: "cloudflare-anycast",
      vendorName: "Cloudflare Anycast Burst",
      fee: 8600,
      latencyMs: 4800,
      path: "cold",
      startedAt: now - 86_400_000,
      completedAt: now - 86_395_200,
    },
    {
      id: "inc_seed_2",
      scenarioId: "inventory-zero",
      type: "warehouse_stockout",
      site: "midwest-dc · Bay 14",
      title: "Critical SKU at zero",
      severity: "critical",
      vendorId: "dhl-rush-3",
      vendorName: "DHL Rush Inventory-3",
      fee: 4200,
      latencyMs: 6200,
      path: "cold",
      startedAt: now - 172_800_000,
      completedAt: now - 172_793_800,
    },
  ];
}
