import { submitClientIncident } from "./agent-bridge";
import { INITIAL_NODES } from "./config";
import { evaluateNode } from "./detector";
import type { DecisionEvent, DemoState } from "@/lib/live/contracts";
import type {
  ActiveFault,
  ClientIncident,
  DatacenterSnapshot,
  FaultType,
  GpuNode,
  MetricSample,
  NumericMetricKey,
  TimelineItem,
} from "./types";

const cloneNodes = (): GpuNode[] =>
  INITIAL_NODES.map((node) => ({ ...node, metrics: { ...node.metrics } }));

const timelineItem = (
  source: TimelineItem["source"],
  message: string,
  detail: string,
  tone: TimelineItem["tone"],
  simulated = false,
): TimelineItem => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  ts: Date.now(),
  source,
  message,
  detail,
  tone,
  simulated,
});

function initialSnapshot(): DatacenterSnapshot {
  return {
    connected: false,
    tick: 0,
    lastUpdated: 0,
    nodes: cloneNodes(),
    history: Object.fromEntries(INITIAL_NODES.map((node) => [node.id, []])),
    selectedNodeId: "gpu-07",
    selectedMetric: "gpuUtil",
    activeFault: null,
    incident: null,
    timeline: [
      {
        id: "boot",
        ts: 0,
        source: "Telemetry",
        message: "Client telemetry ready",
        detail: "Waiting for NVIDIA DCGM and cluster samples.",
        tone: "neutral",
      },
    ],
  };
}

class DatacenterRuntime {
  private snapshot = initialSnapshot();
  private listeners = new Set<() => void>();
  private timer: number | null = null;
  private breachCount = 0;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.snapshot;

  private publish(next: DatacenterSnapshot) {
    this.snapshot = next;
    this.listeners.forEach((listener) => listener());
  }

  start = () => {
    if (this.timer !== null) return;
    this.tick();
    this.timer = window.setInterval(this.tick, 1_000);
  };

  stop = () => {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  };

  syncControlPlane = (state: DemoState | null, connected: boolean) => {
    if (!state) {
      this.publish({ ...this.snapshot, connected: false });
      return;
    }

    // This console is Meridian's client surface. A Northwind incident belongs
    // only in its own client console and must not be presented as GPU telemetry.
    if (state.scenario.id !== "datacenter") {
      this.publish({
        ...this.snapshot,
        connected,
        activeFault: null,
        incident: null,
        timeline: this.snapshot.timeline.filter((item) => item.simulated || item.id === "boot"),
      });
      return;
    }

    const localTimeline = this.snapshot.timeline.filter((item) => item.simulated || item.id === "boot");
    const timeline = [...localTimeline, ...state.events.map(controlTimelineItem)];
    const completed = state.runStatus === "complete";
    const failed = state.runStatus === "failed";
    const persistedIncident = state.clientIncident && (state.clientIncident.clientId ?? "meridian") === "meridian"
      ? incidentFromControlPlane(state.clientIncident)
      : null;
    const incident = (this.snapshot.incident ?? persistedIncident)
      ? {
          ...(this.snapshot.incident ?? persistedIncident!),
          status: completed ? "resolved" as const : failed ? "detected" as const : "agent_reviewing" as const,
        }
      : null;

    this.publish({
      ...this.snapshot,
      connected,
      activeFault: completed ? null : this.snapshot.activeFault,
      incident,
      timeline,
    });
  };

  private tick = () => {
    const now = Date.now();
    const tick = this.snapshot.tick + 1;
    const fault = this.snapshot.activeFault;

    const nodes = INITIAL_NODES.map((base, index) => {
      const wave = Math.sin((tick + index * 1.7) / 3);
      const node: GpuNode = {
        ...base,
        metrics: {
          ...base.metrics,
          gpuUtil: Math.max(4, Math.min(96, base.metrics.gpuUtil + wave * 4)),
          memoryUtil: Math.max(8, Math.min(94, base.metrics.memoryUtil + wave * 2.4)),
          temperature: base.metrics.temperature + wave * 1.8,
          powerWatts: Math.round(base.metrics.powerWatts + wave * 18),
          networkLoss: Math.max(0.01, 0.04 + wave * 0.02),
        },
      };

      if (fault?.nodeId !== node.id) return node;

      switch (fault.type) {
        case "node_offline":
          return { ...node, health: "offline" as const, metrics: { ...node.metrics, heartbeat: false, gpuUtil: 0, powerWatts: 28 } };
        case "power_failure":
          return { ...node, health: "offline" as const, metrics: { ...node.metrics, heartbeat: false, gpuUtil: 0, powerWatts: 0 } };
        case "thermal_runaway":
          return { ...node, health: "critical" as const, metrics: { ...node.metrics, temperature: 92 + tick % 3 } };
        case "ecc_spike":
          return {
            ...node,
            health: "critical" as const,
            metrics: {
              ...node.metrics,
              eccErrors: Math.min(12, 2 + Math.floor((now - fault.injectedAt) / 700) * 3),
            },
          };
        case "network_loss":
          return { ...node, health: "warning" as const, metrics: { ...node.metrics, networkLoss: 6.8 + (tick % 4) * 0.4 } };
      }
    });

    const history = { ...this.snapshot.history };
    nodes.forEach((node) => {
      const sample: MetricSample = { ts: now, nodeId: node.id, metrics: { ...node.metrics } };
      history[node.id] = [...(history[node.id] ?? []), sample].slice(-40);
    });

    const next = { ...this.snapshot, tick, lastUpdated: now, nodes, history };
    this.publish(next);

    if (fault && !this.snapshot.incident) {
      const affectedNode = nodes.find((node) => node.id === fault.nodeId);
      const detection = affectedNode ? evaluateNode(affectedNode) : null;
      this.breachCount = detection ? this.breachCount + 1 : 0;
      if (detection && this.breachCount >= 2) this.openIncident(fault, detection.title, detection.evidence);
    }
  };

  private openIncident(fault: ActiveFault, title: string, evidence: string) {
    const incident: ClientIncident = {
      id: `dc-${Date.now()}`,
      nodeId: fault.nodeId,
      faultType: fault.type,
      title,
      evidence,
      detectedAt: Date.now(),
      status: "detected",
    };
    const item = timelineItem("Detector", title, evidence, "critical", true);
    this.publish({
      ...this.snapshot,
      incident,
      timeline: [...this.snapshot.timeline, item],
    });

    void submitClientIncident(incident)
      .then(() => {
        const current = this.snapshot.incident;
        if (!current || current.id !== incident.id) return;
        this.publish({
          ...this.snapshot,
          incident: { ...current, status: "agent_reviewing" },
        });
      })
      .catch((error: unknown) => {
        const current = this.snapshot.incident;
        if (!current || current.id !== incident.id) return;
        this.publish({
          ...this.snapshot,
          timeline: [
            ...this.snapshot.timeline,
            timelineItem(
              "Continuum agent",
              "Control-plane handoff failed",
              error instanceof Error ? error.message : "The control plane did not accept the incident.",
              "critical",
            ),
          ],
        });
      });
  }

  injectFault = (nodeId: string, type: FaultType) => {
    if (this.snapshot.activeFault) return;
    this.breachCount = 0;
    const activeFault: ActiveFault = { nodeId, type, injectedAt: Date.now() };
    const optionName = type.replaceAll("_", " ");
    this.publish({
      ...this.snapshot,
      selectedNodeId: nodeId,
      activeFault,
      incident: null,
      timeline: [
        ...this.snapshot.timeline,
        timelineItem(
          "Operator",
          `Test fault injected on ${nodeId}`,
          `${optionName} is now altering the synthetic client telemetry stream. The detector must confirm the breach before the control-plane handoff.`,
          "warning",
          true,
        ),
      ],
    });
    this.tick();
  };

  restoreAsset = () => {
    const fault = this.snapshot.activeFault;
    if (!fault) return;
    this.breachCount = 0;
    this.publish({
      ...this.snapshot,
      activeFault: null,
      incident: this.snapshot.incident ? { ...this.snapshot.incident, status: "resolved" } : null,
      timeline: [
        ...this.snapshot.timeline,
        timelineItem(
          "Operator",
          `${fault.nodeId} restored`,
          "Synthetic telemetry has returned to its healthy baseline.",
          "success",
          true,
        ),
      ],
    });
    this.tick();
    void fetch("/api/control/api/demo/reset?clientId=meridian", { method: "POST" }).catch(() => undefined);
  };

  reset = () => {
    this.breachCount = 0;
    const next = initialSnapshot();
    this.publish({ ...next, connected: this.timer !== null });
    this.tick();
    void fetch("/api/control/api/demo/reset?clientId=meridian", { method: "POST" }).catch(() => undefined);
  };

  selectNode = (nodeId: string) => {
    this.publish({ ...this.snapshot, selectedNodeId: nodeId });
  };

  selectMetric = (metric: NumericMetricKey) => {
    this.publish({ ...this.snapshot, selectedMetric: metric });
  };
}

function controlTimelineItem(event: DecisionEvent): TimelineItem {
  const source = event.phase === "observed"
    ? "Detector"
    : event.phase === "ordered" || event.phase === "inbound_scheduled"
      ? "Action broker"
      : "Continuum agent";
  const tone = event.phase === "authorization_denied" || event.phase === "ineligible" || event.phase === "blacklisted" || event.phase === "failed"
    ? "critical"
    : event.phase === "replanned"
      ? "warning"
      : event.phase === "attested" || event.phase === "ordered" || event.phase === "inbound_scheduled"
        ? "success"
        : "info";
  return {
    id: `control-${event.id}`,
    ts: Date.parse(event.occurredAt),
    source,
    message: event.phase.replaceAll("_", " "),
    detail: event.detail,
    tone,
  };
}

function incidentFromControlPlane(incident: NonNullable<DemoState["clientIncident"]>): ClientIncident {
  const faultType = incident.faultType as FaultType;
  const title = `${incident.nodeId} ${faultType.replaceAll("_", " ")}`;
  return {
    id: `control-incident-${incident.detectedAt}`,
    nodeId: incident.nodeId,
    faultType,
    title,
    evidence: "Detector-confirmed client incident persisted by the Continuim control plane.",
    detectedAt: Date.parse(incident.detectedAt),
    status: "detected",
  };
}

export const datacenterRuntime = new DatacenterRuntime();
