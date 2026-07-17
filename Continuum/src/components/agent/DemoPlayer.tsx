"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { PipelineBoard } from "@/components/agent/PipelineBoard";
import { Transcript } from "@/components/agent/Transcript";
import { ConsoleControls } from "@/components/agent/ConsoleControls";
import {
  IncidentBanner,
  OutcomeMetrics,
  VendorCandidates,
} from "@/components/agent/ContinuumPanels";
import { formatCurrency, formatTs } from "@/lib/format";
import type { DecisionEvent, DemoState } from "@/lib/live/contracts";
import { useContinuum } from "@/lib/store";

export function AgentTheater({
  autoStart = false,
  compact = false,
}: {
  autoStart?: boolean;
  compact?: boolean;
}) {
  const { snapshot, workspace, trigger, live, liveState } = useContinuum();
  const startedScenario = useRef<string | null>(null);

  useEffect(() => {
    if (live || !autoStart || startedScenario.current === workspace.scenario.id) return;
    const scenarioId = workspace.scenario.id;
    const t = setTimeout(() => {
      startedScenario.current = scenarioId;
      if (!snapshot.running) trigger(scenarioId);
    }, 1_100);
    return () => clearTimeout(t);
  }, [autoStart, live, snapshot.running, trigger, workspace.scenario.id]);

  if (live && liveState) {
    return <LiveAgentTheater state={liveState} />;
  }

  return (
    <div>
      <IncidentBanner />
      <div className="mb-3">
        <ConsoleControls compact={compact} />
      </div>
      <PipelineBoard />
      <div className="mt-4 grid gap-4 xl:grid-cols-[1.05fr_.95fr]">
        <VendorCandidates />
        <Transcript />
      </div>
      <OutcomeMetrics />
    </div>
  );
}

const stages: Array<{ label: string; phases: string[] }> = [
  { label: "Observe", phases: ["observed"] },
  { label: "Plan", phases: ["planned", "recalled_history", "sourced", "replanned"] },
  { label: "Guard", phases: ["authorization_attempted", "authorization_denied"] },
  { label: "Verify", phases: ["verifying", "ineligible", "blacklisted", "attested"] },
  { label: "Procure", phases: ["ordered", "inbound_scheduled"] },
];

function stageStatus(state: DemoState, phases: readonly string[]) {
  const seen = state.events.some((event) => phases.includes(event.phase));
  const latest = state.events.at(-1);
  const active = state.runStatus === "running" && latest && phases.includes(latest.phase);
  if (active) return { label: "Working", classes: "border-brand bg-brand-soft text-brand" };
  if (seen) return { label: "Recorded", classes: "border-ok-line bg-ok-soft text-ok" };
  return { label: "Waiting", classes: "border-line bg-surface text-faint" };
}

function eventTone(event: DecisionEvent) {
  if (["authorization_denied", "ineligible", "blacklisted", "failed"].includes(event.phase)) return "text-bad";
  if (["attested", "ordered", "inbound_scheduled"].includes(event.phase)) return "text-ok";
  return "text-brand-ink";
}

function LiveAgentTheater({ state }: { state: DemoState }) {
  const incident = state.clientIncident;
  const completed = state.runStatus === "complete";
  const statusLabel = state.runStatus === "running" ? "Agent working autonomously" : completed ? "Recovery complete" : state.runStatus === "failed" ? "Recovery failed" : "Waiting for client incident";

  return (
    <div>
      <section className="mb-4 rounded-xl border border-brand-line bg-brand-soft/45 p-3.5" aria-live="polite">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-brand-ink">Persisted control-plane run</p>
            <h2 className="mt-0.5 text-sm font-semibold text-ink">{statusLabel}</h2>
            <p className="mt-1 text-xs text-muted">
              {incident
                ? `${incident.nodeId} reported ${incident.faultType.replaceAll("_", " ")} at ${formatTs(Date.parse(incident.detectedAt))}. This trace is read from the control plane, not a local placeholder.`
                : "Create a GPU incident in Client board to begin a real persisted recovery run."}
            </p>
          </div>
          <Link href="/datacenter" className="btn-secondary shrink-0">Open Client board</Link>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          Autonomous remediation pipeline
          <span className={`ml-auto normal-case tracking-normal ${state.runStatus === "running" ? "text-brand" : completed ? "text-ok" : "text-faint"}`}>{statusLabel}</span>
        </div>
        <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 xl:grid-cols-5">
          {stages.map((stage, index) => {
            const status = stageStatus(state, stage.phases);
            const latest = [...state.events].reverse().find((event) => stage.phases.includes(event.phase));
            return (
              <div key={stage.label} className={`min-h-[118px] rounded-[10px] border p-3 ${status.classes}`}>
                <div className="flex items-baseline justify-between gap-2">
                  <div className="flex items-baseline gap-2"><span className="font-mono text-[9.5px] text-faint">{String(index + 1).padStart(2, "0")}</span><h3 className="text-[12.5px] font-bold text-ink">{stage.label}</h3></div>
                  <span className="text-[9px] font-bold uppercase tracking-[0.05em]">{status.label}</span>
                </div>
                <p className="mt-3 text-[10.5px] leading-relaxed text-muted">{latest?.detail ?? "No persisted action yet."}</p>
              </div>
            );
          })}
        </div>
      </section>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.05fr_.95fr]">
        <section className="panel">
          <div className="panel-header">Vendor decisions <span className="ml-auto normal-case tracking-normal text-faint">Persisted evidence</span></div>
          <div className="space-y-2 p-3">
            {state.vendors.map((vendor) => {
              const blocked = state.blacklistedVendorIds.includes(vendor.id);
              const selected = state.order?.vendorId === vendor.id;
              return <article key={vendor.id} className={`rounded-[10px] border p-3 ${blocked ? "border-bad-line bg-bad-soft" : selected ? "border-ok-line bg-ok-soft" : "border-line bg-surface"}`}>
                <div className="flex items-start justify-between gap-3"><div><p className="text-[12.5px] font-semibold text-ink">{vendor.legalName}</p><p className="mt-0.5 text-[10.5px] text-muted">{vendor.domain} · {vendor.quote.availableQty} available</p></div><span className={`status-pill ${blocked ? "bad" : selected ? "ok" : ""}`}>{blocked ? "Blacklisted" : selected ? "Ordered" : "Evaluated"}</span></div>
                <p className="mt-3 border-t border-line pt-2.5 font-mono text-sm font-bold text-ink">{formatCurrency(vendor.quote.unitPriceCents)} / unit</p>
              </article>;
            })}
          </div>
        </section>
        <aside className="panel flex min-h-[352px] flex-col">
          <div className="panel-header">Agent activity <span className="ml-auto normal-case tracking-normal text-faint">Live trace</span></div>
          <div role="log" aria-live="polite" aria-label="Persisted Continuum agent decisions" className="h-[314px] flex-1 overflow-y-auto bg-surface">
            <ul className="space-y-0 p-3 font-mono text-[10.5px] leading-relaxed">
              {state.events.length === 0 ? <li className="py-2 text-muted">No decision events recorded.</li> : state.events.map((event) => <li key={event.id} className="grid grid-cols-[54px_86px_1fr] gap-2 border-b border-line/70 py-2.5 last:border-0"><span className="text-faint">{formatTs(Date.parse(event.occurredAt))}</span><span className={`font-semibold ${eventTone(event)}`}>{event.phase.replaceAll("_", " ")}</span><span className="break-words text-muted">{event.detail}</span></li>)}
            </ul>
          </div>
        </aside>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Metric label="At-risk spend blocked" value={formatCurrency(state.metrics.atRiskPoValuePreventedCents)} tone="text-bad" detail="Policy-layer denial" />
        <Metric label="Inbound capacity" value={`${state.inventory.inboundQty} units`} tone="text-ok" detail={state.order ? `${state.order.id} scheduled` : "Awaiting order"} />
        <Metric label="Evidence spend" value={formatCurrency(state.metrics.verificationSpendCents)} tone="text-ink" detail={`${state.metrics.verificationMode} verification`} />
      </div>
    </div>
  );
}

function Metric({ label, value, tone, detail }: { label: string; value: string; tone: string; detail: string }) {
  return <div className="panel p-3.5"><p className="text-[10px] font-bold uppercase tracking-[0.06em] text-muted">{label}</p><p className={`mt-1.5 font-mono text-[22px] font-bold ${tone}`}>{value}</p><p className="mt-0.5 text-[10.5px] text-muted">{detail}</p></div>;
}
