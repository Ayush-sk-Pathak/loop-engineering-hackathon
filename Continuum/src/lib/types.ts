export type WorkspaceId = "northwind" | "meridian";
export type PipelineStageId = "detect" | "source" | "verify" | "guard" | "procure" | "learn";
export type StageStatus = "idle" | "active" | "done" | "skipped" | "denied";
export type AgentStatus = "IDLE" | "MONITORING" | "REMEDIATING";
export type IncidentSeverity = "critical" | "high" | "medium";
export type PathKind = "cold" | "warm";
export type VendorStatus = "verified" | "ineligible" | "unchecked";
export type AssetStatus = "healthy" | "low" | "critical" | "failed";
export type Tone = "neutral" | "warn" | "ok" | "info" | "bad";

export interface EvidenceSignal {
  label: string;
  value: string;
  state: "good" | "bad" | "neutral";
}

export interface Supplier {
  id: string;
  name: string;
  region: string;
  capacityClass: string;
  trustScore: number;
  settlementRail: string;
  baseFee: number;
  slaMs: number;
  status: VendorStatus;
  note: string;
  evidence: EvidenceSignal[];
}

export interface Asset {
  id: string;
  name: string;
  current: string;
  threshold: string;
  status: AssetStatus;
  source: string;
}

export interface PurchaseAttempt {
  id: string;
  vendorName: string;
  item: string;
  amount: number;
  status: "placed" | "blocked" | "delivered";
  reason: string;
  createdAt: string;
}

export interface ActivityItem {
  time: string;
  source: string;
  message: string;
  tone: Tone;
}

export interface Scenario {
  id: string;
  workspaceId: WorkspaceId;
  type: string;
  site: string;
  title: string;
  metricLabel: string;
  threshold: number;
  breachValue: number;
  unit: string;
  severity: IncidentSeverity;
  description: string;
  impact: string;
  item: string;
  candidateVendorIds: string[];
  blockedAmount: number;
  protectedLabel: string;
  protectedValue: string;
  protectedDetail: string;
}

export interface Workspace {
  id: WorkspaceId;
  name: string;
  shortName: string;
  industry: string;
  host: string;
  scenario: Scenario;
  assets: Asset[];
  suppliers: Supplier[];
  purchases: PurchaseAttempt[];
  activity: ActivityItem[];
  kpis: {
    activeAlerts: string;
    blockedYtd: string;
    blockedDetail: string;
    verifiedVendors: string;
    verifiedDetail: string;
    protectedLabel: string;
    protectedValue: string;
    protectedDetail: string;
  };
  reportRows: { label: string; amount: number }[];
  spendCeiling: number;
  integrations: { name: string; purpose: string; status: "connected" | "healthy" }[];
}

export interface TranscriptEntry {
  id: string;
  ts: number;
  source: string;
  message: string;
  tone?: Tone;
}

export interface StageArtifact {
  headline: string;
  detail: string;
  meta?: string;
}

export interface PipelineStageState {
  id: PipelineStageId;
  label: string;
  status: StageStatus;
  artifact?: StageArtifact;
}

export interface IncidentRecord {
  id: string;
  workspaceId?: WorkspaceId;
  scenarioId: string;
  type: string;
  site: string;
  title: string;
  severity: IncidentSeverity;
  vendorId: string;
  vendorName: string;
  fee: number;
  blockedAmount?: number;
  latencyMs: number;
  path: PathKind;
  startedAt: number;
  completedAt: number;
}

export interface LedgerEntry {
  incidentType: string;
  vendorId: string;
  vendorName: string;
  fee: number;
  latencyMs: number;
  confidence: number;
  lastUsed: number;
  hits: number;
}

export interface SimulationSnapshot {
  status: AgentStatus;
  speed: number;
  activeScenario: Scenario | null;
  stages: PipelineStageState[];
  transcript: TranscriptEntry[];
  path: PathKind | null;
  selectedVendor: Supplier | null;
  rejectedVendor: Supplier | null;
  elapsedMs: number;
  running: boolean;
  sparkline: number[];
}
