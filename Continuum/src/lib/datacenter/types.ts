export type NodeHealth = "healthy" | "warning" | "critical" | "offline";

export type FaultType =
  | "node_offline"
  | "thermal_runaway"
  | "ecc_spike"
  | "network_loss"
  | "power_failure";

export type IncidentStatus = "detected" | "agent_reviewing" | "action_started" | "resolved";

export type TimelineTone = "neutral" | "info" | "warning" | "critical" | "success";

export interface NodeMetrics {
  gpuUtil: number;
  memoryUtil: number;
  temperature: number;
  powerWatts: number;
  heartbeat: boolean;
  eccErrors: number;
  networkLoss: number;
}

export type NumericMetricKey = Exclude<keyof NodeMetrics, "heartbeat">;

export interface GpuNode {
  id: string;
  label: string;
  rack: string;
  model: string;
  workload: string;
  health: NodeHealth;
  metrics: NodeMetrics;
}

export interface MetricSample {
  ts: number;
  nodeId: string;
  metrics: NodeMetrics;
}

export interface ActiveFault {
  nodeId: string;
  type: FaultType;
  injectedAt: number;
}

export interface DetectionResult {
  ruleId: string;
  title: string;
  evidence: string;
  severity: "warning" | "critical";
}

export interface ClientIncident {
  id: string;
  nodeId: string;
  faultType: FaultType;
  title: string;
  evidence: string;
  detectedAt: number;
  status: IncidentStatus;
}

export interface TimelineItem {
  id: string;
  ts: number;
  source: "Telemetry" | "Detector" | "Continuum agent" | "Action broker" | "Operator";
  message: string;
  detail?: string;
  tone: TimelineTone;
  simulated?: boolean;
}

export interface DatacenterSnapshot {
  connected: boolean;
  tick: number;
  lastUpdated: number;
  nodes: GpuNode[];
  history: Record<string, MetricSample[]>;
  selectedNodeId: string;
  selectedMetric: NumericMetricKey;
  activeFault: ActiveFault | null;
  incident: ClientIncident | null;
  timeline: TimelineItem[];
}
