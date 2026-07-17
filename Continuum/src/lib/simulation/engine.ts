import { getScenario, getSupplier, getWorkspace, WORKSPACE_LIST } from "../data/workspaces";
import { uid } from "../format";
import type {
  IncidentRecord,
  LedgerEntry,
  PathKind,
  PipelineStageId,
  PipelineStageState,
  Scenario,
  SimulationSnapshot,
  Supplier,
  TranscriptEntry,
  WorkspaceId,
} from "../types";
import {
  appendIncident,
  findWarmPath,
  loadIncidents,
  loadLedger,
  upsertLedgerEntry,
} from "./ledger";

const STAGE_ORDER: { id: PipelineStageId; label: string }[] = [
  { id: "detect", label: "Detect" },
  { id: "source", label: "Source" },
  { id: "verify", label: "Verify" },
  { id: "guard", label: "Guard" },
  { id: "procure", label: "Procure" },
  { id: "learn", label: "Learn" },
];

type Listener = () => void;

function idleStages(): PipelineStageState[] {
  return STAGE_ORDER.map((s) => ({ ...s, status: "idle" as const }));
}

function sparkFromBreach(scenario: Scenario): number[] {
  const start = Math.max(scenario.threshold * 1.4, scenario.breachValue);
  return Array.from({ length: 24 }, (_, index) => {
    const progress = index / 23;
    const value = start + (scenario.breachValue - start) * Math.pow(progress, 2.4);
    return Math.max(0, Math.round((value + Math.sin(index * 0.8) * start * 0.025) * 10) / 10);
  });
}

export class ContinuumEngine {
  private status: SimulationSnapshot["status"] = "MONITORING";
  private speed = 1;
  private activeScenario: Scenario | null = null;
  private stages: PipelineStageState[] = idleStages();
  private transcript: TranscriptEntry[] = [
    {
      id: "log_boot",
      ts: 0,
      source: "Continuum",
      message: "Continuum agent online — watching system boundaries.",
      tone: "info",
    },
  ];
  private path: PathKind | null = null;
  private selectedVendor: Supplier | null = null;
  private rejectedVendor: Supplier | null = null;
  private elapsedMs = 0;
  private running = false;
  private sparkline: number[] = Array.from({ length: 24 }, (_, i) => 2 + Math.sin(i) * 0.4);
  private startedAt = 0;
  private listeners = new Set<Listener>();
  private ledger: LedgerEntry[] = [];
  private incidents: IncidentRecord[] = [];
  private hydrated = false;
  private cachedSnapshot: SimulationSnapshot;
  private workspaceId: WorkspaceId = "northwind";
  private runToken = 0;

  constructor() {
    this.cachedSnapshot = this.buildSnapshot();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private buildSnapshot(): SimulationSnapshot {
    return {
      status: this.status,
      speed: this.speed,
      activeScenario: this.activeScenario,
      stages: this.stages,
      transcript: this.transcript,
      path: this.path,
      selectedVendor: this.selectedVendor,
      rejectedVendor: this.rejectedVendor,
      elapsedMs: this.elapsedMs,
      running: this.running,
      sparkline: this.sparkline,
    };
  }

  private emit() {
    this.cachedSnapshot = this.buildSnapshot();
    this.listeners.forEach((l) => l());
  }

  getCachedSnapshot(): SimulationSnapshot {
    return this.cachedSnapshot;
  }

  getSnapshot(): SimulationSnapshot {
    return this.cachedSnapshot;
  }

  getLedger(): LedgerEntry[] {
    return this.ledger;
  }

  getIncidents(): IncidentRecord[] {
    return this.incidents;
  }

  hydrate() {
    if (this.hydrated || typeof window === "undefined") return;
    this.ledger = loadLedger();
    this.incidents = loadIncidents();
    this.hydrated = true;
    this.emit();
  }

  setSpeed(speed: number) {
    this.speed = speed;
    this.emit();
  }

  setWorkspace(workspaceId: WorkspaceId) {
    if (this.workspaceId === workspaceId) return;
    this.workspaceId = workspaceId;
    this.transcript = [
      {
        id: `log_boot_${workspaceId}`,
        ts: 0,
        source: "Continuum",
        message: "Continuum agent online — watching system boundaries.",
        tone: "info",
      },
    ];
    this.reset(`Workspace changed to ${getWorkspace(workspaceId).name}.`);
  }

  private log(source: string, message: string, tone: TranscriptEntry["tone"] = "neutral") {
    this.transcript = [
      ...this.transcript,
      { id: uid("log"), ts: Date.now(), source, message, tone },
    ].slice(-80);
  }

  private async wait(ms: number, token: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms / this.speed));
    if (token !== this.runToken) throw new Error("Simulation cancelled");
  }

  private setStage(
    id: PipelineStageId,
    status: PipelineStageState["status"],
    artifact?: PipelineStageState["artifact"],
  ) {
    this.stages = this.stages.map((s) =>
      s.id === id ? { ...s, status, artifact: artifact ?? s.artifact } : s,
    );
  }

  private markPriorDone(upTo: PipelineStageId) {
    const idx = STAGE_ORDER.findIndex((s) => s.id === upTo);
    this.stages = this.stages.map((s, i) => {
      if (i < idx && s.status !== "skipped") return { ...s, status: "done" };
      return s;
    });
  }

  reset(message = "Loop reset — resuming boundary monitoring.") {
    this.runToken += 1;
    this.running = false;
    this.status = "MONITORING";
    this.activeScenario = null;
    this.stages = idleStages();
    this.path = null;
    this.selectedVendor = null;
    this.rejectedVendor = null;
    this.elapsedMs = 0;
    this.sparkline = Array.from({ length: 24 }, (_, i) => 2 + Math.sin(i) * 0.4);
    this.log("System", message, "info");
    this.emit();
  }

  async trigger(scenarioId?: string) {
    if (this.running) return;
    this.hydrate();

    const scenario =
      (scenarioId ? getScenario(scenarioId) : undefined) ??
      getWorkspace(this.workspaceId).scenario ??
      WORKSPACE_LIST[0].scenario;
    this.workspaceId = scenario.workspaceId;
    const token = ++this.runToken;

    this.running = true;
    this.status = "REMEDIATING";
    this.activeScenario = scenario;
    this.stages = idleStages();
    this.elapsedMs = 0;
    this.startedAt = Date.now();
    this.sparkline = sparkFromBreach(scenario);
    this.selectedVendor = null;
    this.rejectedVendor = null;

    const candidateIds = new Set(scenario.candidateVendorIds);
    const stored = findWarmPath(scenario.type);
    const warm = stored && candidateIds.has(stored.vendorId) ? stored : null;
    this.path = warm ? "warm" : "cold";

    this.log(
      "Nexla",
      `Incident detected: ${scenario.title} @ ${scenario.site}`,
      "warn",
    );
    this.emit();

    try {
      await this.runDetect(scenario, token);
      await this.runSource(scenario, token, warm);
      await this.runVerify(scenario, token, warm);
      if (this.path === "warm" && warm) {
        await this.runWarmGuard(scenario, warm, token);
      } else {
        await this.runColdGuard(scenario, token);
      }
      await this.runProcure(scenario, token);
      await this.runLearn(scenario, token);
      this.finish(scenario);
    } catch {
      // cancelled via reset
    }
  }

  private async runDetect(scenario: Scenario, token: number) {
    this.setStage("detect", "active", {
      headline: `${scenario.metricLabel}: ${scenario.breachValue} ${scenario.unit}`,
      detail: `Continuity threshold: ${scenario.threshold} ${scenario.unit}`,
      meta: scenario.site,
    });
    this.log("Nexla", `${scenario.metricLabel} breached its continuity threshold.`, "warn");
    this.emit();
    await this.wait(900, token);
    this.markPriorDone("source");
    this.setStage("detect", "done");
    this.emit();
  }

  private candidates(scenario: Scenario) {
    return scenario.candidateVendorIds
      .map((id) => getSupplier(id))
      .filter((supplier): supplier is Supplier => Boolean(supplier));
  }

  private async runSource(scenario: Scenario, token: number, warm: LedgerEntry | null) {
    if (warm) {
      this.setStage("source", "skipped", {
        headline: "Known resolution found",
        detail: `${warm.vendorName} selected from the learning ledger`,
        meta: `${warm.hits} prior resolution${warm.hits === 1 ? "" : "s"}`,
      });
      this.log("Continuum", `Warm-path match found for ${scenario.type}.`, "ok");
      this.emit();
      await this.wait(350, token);
      return;
    }

    const candidates = this.candidates(scenario);
    this.setStage("source", "active", {
      headline: `${candidates.length} backup vendors found`,
      detail: "Ranking availability, quote, SLA, and registry evidence",
      meta: candidates.map((candidate) => candidate.name).join(" · "),
    });
    this.log("Continuum", `Sourced ${candidates.length} candidates for ${scenario.item}.`, "info");
    this.emit();
    await this.wait(1_050, token);
    this.setStage("source", "done", {
      headline: `${candidates.length} candidates shortlisted`,
      detail: "Quotes received; identity verification required",
    });
    this.emit();
  }

  private async runVerify(scenario: Scenario, token: number, warm: LedgerEntry | null) {
    const candidates = this.candidates(scenario);
    this.setStage("verify", "active", {
      headline: warm ? "Re-validating known vendor" : "Purchasing identity evidence",
      detail: warm ? `${warm.vendorName} · current registry check` : `${candidates.length} candidates · entity, bank, and provenance`,
      meta: "Zero evidence registry",
    });
    this.log("Zero", `Verification evidence requested for ${warm ? 1 : candidates.length} vendor${warm ? "" : "s"}.`, "info");
    this.emit();
    await this.wait(warm ? 450 : 1_150, token);

    this.setStage("verify", "done", {
      headline: warm ? "Known vendor remains verified" : "Evidence returned",
      detail: warm ? "Entity, settlement account, and provenance match" : "One verified candidate · one ineligible candidate",
      meta: "Evidence cost: $0.04",
    });
    this.log("Zero", warm ? `${warm.vendorName} remains VERIFIED.` : "Evidence complete — policy claims updated.", "ok");
    this.emit();
    await this.wait(300, token);
  }

  private async runColdGuard(scenario: Scenario, token: number) {
    const candidates = this.candidates(scenario);
    const rejected = candidates.find((candidate) => candidate.status === "ineligible");
    const verified = candidates.find((candidate) => candidate.status === "verified");
    if (!rejected || !verified) throw new Error("Scenario requires verified and ineligible candidates");
    this.rejectedVendor = rejected;
    this.selectedVendor = verified;

    this.setStage("guard", "active", {
      headline: `Authorizing ${rejected.name}`,
      detail: `$${(rejected.baseFee / 100).toLocaleString("en-US")} · lowest quote`,
      meta: "POST /pay · Pomerium policy",
    });
    this.log("Continuum", `${rejected.name} has the lowest quote; requesting payment authorization.`, "warn");
    this.emit();
    await this.wait(850, token);

    this.setStage("guard", "denied", {
      headline: "403 · Payment denied",
      detail: "Policy requires vendor.verified = true",
      meta: `${rejected.name} blacklisted · rerouting`,
    });
    this.log("Pomerium", `403 DENIED — ${rejected.name} failed vendor.verified policy.`, "bad");
    this.log("Continuum", `Denial observed; rerouting to ${verified.name}.`, "info");
    this.emit();
    await this.wait(650, token);
  }

  private async runWarmGuard(scenario: Scenario, warm: LedgerEntry, token: number) {
    const vendor = getSupplier(warm.vendorId);
    if (!vendor) throw new Error("Learned vendor no longer exists");
    this.selectedVendor = vendor;

    this.setStage("guard", "active", {
      headline: `Authorizing ${vendor.name}`,
      detail: "Known resolution · current verified claim",
      meta: "Pomerium policy",
    });
    this.log("Pomerium", `Evaluating vendor.verified claim for ${vendor.name}.`, "info");
    this.emit();
    await this.wait(400, token);
    this.setStage("guard", "done", {
      headline: "Policy passed",
      detail: "vendor.verified = true · spend within ceiling",
      meta: `Confidence ${warm.confidence}%`,
    });
    this.log("Pomerium", "200 OK — verified vendor and spend policy satisfied.", "ok");
    this.emit();
  }

  private async runProcure(scenario: Scenario, token: number) {
    const vendor = this.selectedVendor;
    if (!vendor) throw new Error("No selected vendor");
    const po = `PO-${Math.floor(1000 + Math.random() * 8999)}`;

    this.setStage("procure", "active", {
      headline: `Placing ${po}`,
      detail: `${scenario.item} · $${(vendor.baseFee / 100).toLocaleString("en-US")}`,
      meta: `${vendor.settlementRail} · ${vendor.name}`,
    });
    this.log("Continuum", `Payment approved; placing ${po} with ${vendor.name}.`, "info");
    this.emit();
    await this.wait(this.path === "warm" ? 550 : 1_000, token);
    this.setStage("procure", "done", {
      headline: `${po} confirmed`,
      detail: scenario.protectedValue,
      meta: scenario.protectedDetail,
    });
    this.log("StableEmail", `${po} delivered and acknowledged by ${vendor.name}.`, "ok");
    this.emit();
  }

  private async runLearn(scenario: Scenario, token: number) {
    if (!this.selectedVendor) return;
    const latencyMs = Date.now() - this.startedAt;
    this.elapsedMs = latencyMs;

    this.setStage("learn", "active", {
      headline: "Writing resolution to ledger",
      detail: `${scenario.type} → ${this.selectedVendor.name}`,
    });
    this.log("Continuum", "Writing incident, policy decision, vendor, fee, and latency to the ledger.", "info");
    this.emit();
    await this.wait(550, token);

    this.ledger = upsertLedgerEntry({
      incidentType: scenario.type,
      vendorId: this.selectedVendor.id,
      vendorName: this.selectedVendor.name,
      fee: this.selectedVendor.baseFee,
      latencyMs,
    });

    this.setStage("learn", "done", {
      headline: "Warm path available next run",
      detail: `${scenario.type} → ${this.selectedVendor.name}`,
      meta: `Ledger updated · ${Math.round(latencyMs)}ms`,
    });
    this.log(
      "Continuum",
      `Learn: matrix updated. Subsequent ${scenario.type} remediations will bypass cold discovery.`,
      "ok",
    );
    this.emit();
  }

  private finish(scenario: Scenario) {
    if (!this.selectedVendor) return;
    const completedAt = Date.now();
    const latencyMs = completedAt - this.startedAt;
    this.elapsedMs = latencyMs;

    const record: IncidentRecord = {
      id: uid("inc"),
      workspaceId: scenario.workspaceId,
      scenarioId: scenario.id,
      type: scenario.type,
      site: scenario.site,
      title: scenario.title,
      severity: scenario.severity,
      vendorId: this.selectedVendor.id,
      vendorName: this.selectedVendor.name,
      fee: this.selectedVendor.baseFee,
      blockedAmount: scenario.blockedAmount,
      latencyMs,
      path: this.path ?? "cold",
      startedAt: this.startedAt,
      completedAt,
    };

    this.incidents = appendIncident(record);
    this.running = false;
    this.status = "MONITORING";
    this.log(
      "Continuum",
      `Remediation closed in ${Math.round(latencyMs)}ms via ${this.path} path.`,
      "ok",
    );
    this.emit();
  }
}

export const continuumEngine = new ContinuumEngine();
