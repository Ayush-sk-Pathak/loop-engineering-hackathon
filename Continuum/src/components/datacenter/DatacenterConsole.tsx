"use client";

import { useMemo, useState } from "react";
import { DATACENTER, FAULT_OPTIONS, METRIC_OPTIONS } from "@/lib/datacenter/config";
import { useDatacenter } from "@/lib/datacenter/useDatacenter";
import type { FaultType, GpuNode, NodeHealth, NumericMetricKey, TimelineTone } from "@/lib/datacenter/types";
import { DatacenterShell } from "./DatacenterShell";

const healthStyle: Record<NodeHealth, string> = {
  healthy: "border-ok-line bg-ok-soft text-ok",
  warning: "border-warn-line bg-warn-soft text-warn",
  critical: "border-bad-line bg-bad-soft text-bad",
  offline: "border-line-strong bg-surface-2 text-muted",
};

const toneDot: Record<TimelineTone, string> = {
  neutral: "bg-faint",
  info: "bg-brand",
  warning: "bg-warn",
  critical: "bg-bad",
  success: "bg-ok",
};

function formatMetric(value: number, metric: NumericMetricKey) {
  const option = METRIC_OPTIONS.find((item) => item.id === metric);
  const digits = metric === "networkLoss" ? 2 : 0;
  return `${value.toFixed(digits)}${option?.unit ?? ""}`;
}

function MetricChart({
  node,
  values,
  metric,
}: {
  node: GpuNode;
  values: number[];
  metric: NumericMetricKey;
}) {
  const width = 700;
  const height = 190;
  const pad = 18;
  const range = values.length ? Math.max(...values) - Math.min(...values) : 1;
  const min = values.length ? Math.min(...values) - Math.max(range * 0.2, 1) : 0;
  const max = values.length ? Math.max(...values) + Math.max(range * 0.2, 1) : 100;
  const points = values.map((value, index) => {
    const x = pad + (index / Math.max(values.length - 1, 1)) * (width - pad * 2);
    const y = height - pad - ((value - min) / Math.max(max - min, 1)) * (height - pad * 2);
    return `${x},${y}`;
  }).join(" ");
  const area = points ? `${pad},${height - pad} ${points} ${width - pad},${height - pad}` : "";

  return (
    <div className="relative mt-4 overflow-hidden rounded-xl border border-line bg-[linear-gradient(180deg,#fbfcff,#f6f8fb)]">
      <div className="absolute left-4 top-3 z-10">
        <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-faint">{node.label}</p>
        <p className="mt-0.5 font-mono text-xl font-semibold text-ink">
          {formatMetric(node.metrics[metric], metric)}
        </p>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[210px] w-full" role="img" aria-label={`${node.label} ${METRIC_OPTIONS.find((item) => item.id === metric)?.label} rolling chart`}>
        <defs>
          <linearGradient id="metricFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#4b47c9" stopOpacity=".18" />
            <stop offset="1" stopColor="#4b47c9" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[48, 92, 136].map((y) => <line key={y} x1="18" x2="682" y1={y} y2={y} stroke="#dbe2eb" strokeWidth="1" />)}
        {area && <polygon points={area} fill="url(#metricFill)" />}
        {points && <polyline points={points} fill="none" stroke="#4b47c9" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />}
      </svg>
      <div className="absolute bottom-3 left-4 right-4 flex justify-between font-mono text-[9px] text-faint">
        <span>40 seconds ago</span>
        <span>Live</span>
      </div>
    </div>
  );
}

function NodeCard({
  node,
  selected,
  onSelect,
}: {
  node: GpuNode;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`min-w-0 rounded-xl border p-3 text-left transition ${
        selected ? "border-brand bg-brand-soft shadow-[0_0_0_1px_rgba(75,71,201,.12)]" : "border-line bg-surface hover:border-line-strong"
      }`}
    >
      <div className="flex items-start gap-2">
        <div>
          <p className="font-mono text-xs font-semibold text-ink">{node.label}</p>
          <p className="mt-0.5 text-[10px] text-faint">{node.rack}</p>
        </div>
        <span className={`ml-auto rounded-full border px-1.5 py-0.5 text-[8px] font-bold uppercase ${healthStyle[node.health]}`}>
          {node.health}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <div><p className="text-[9px] text-faint">GPU</p><p className="mt-0.5 font-mono text-xs font-semibold">{Math.round(node.metrics.gpuUtil)}%</p></div>
        <div><p className="text-[9px] text-faint">Temp</p><p className="mt-0.5 font-mono text-xs font-semibold">{Math.round(node.metrics.temperature)}°</p></div>
        <div><p className="text-[9px] text-faint">Power</p><p className="mt-0.5 font-mono text-xs font-semibold">{node.metrics.powerWatts}W</p></div>
      </div>
      <p className="mt-3 truncate border-t border-line pt-2 text-[10px] text-muted">{node.workload}</p>
    </button>
  );
}

export function DatacenterConsole() {
  const {
    snapshot,
    injectFault,
    restoreAsset,
    reset,
    selectNode,
    selectMetric,
  } = useDatacenter();
  const [faultNode, setFaultNode] = useState("gpu-07");
  const [faultType, setFaultType] = useState<FaultType>("node_offline");

  const selectedNode = snapshot.nodes.find((node) => node.id === snapshot.selectedNodeId) ?? snapshot.nodes[0];
  const samples = snapshot.history[selectedNode.id] ?? [];
  const chartValues = samples.map((sample) => sample.metrics[snapshot.selectedMetric] as number);
  const healthyNodes = snapshot.nodes.filter((node) => node.health === "healthy").length;
  const activeJobs = snapshot.nodes.filter((node) => node.metrics.gpuUtil > 20 && node.metrics.heartbeat).length;
  const nodesWithHeadroom = Math.max(0, snapshot.nodes.length - activeJobs);
  const totalPower = snapshot.nodes.reduce((sum, node) => sum + node.metrics.powerWatts, 0);
  const avgUtil = snapshot.nodes.reduce((sum, node) => sum + node.metrics.gpuUtil, 0) / snapshot.nodes.length;
  const timeline = useMemo(() => [...snapshot.timeline].reverse(), [snapshot.timeline]);

  return (
    <DatacenterShell connected={snapshot.connected} lastUpdated={snapshot.lastUpdated}>
      <section id="overview" className="scroll-mt-24">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-full border border-brand-line bg-brand-soft px-2 py-1 text-[9px] font-bold uppercase tracking-[0.07em] text-brand-ink">Client console</span>
              <span className="rounded-full border border-warn-line bg-warn-soft px-2 py-1 text-[9px] font-bold uppercase tracking-[0.07em] text-warn">Synthetic client telemetry</span>
            </div>
            <h1 className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">{DATACENTER.cluster}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
              Synthetic client telemetry drives a detector; the persisted Continuim control plane owns the recovery, decision trace, and order state.
            </p>
          </div>
          <div className="lg:ml-auto lg:text-right">
            <p className="text-[10px] font-bold uppercase tracking-[0.07em] text-faint">Data source</p>
            <p className="mt-1 text-xs font-semibold text-muted">{DATACENTER.provider}</p>
          </div>
        </div>

        {snapshot.incident && (
          <div
            className={`mt-5 flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center ${
              snapshot.incident.status === "resolved" ? "border-ok-line bg-ok-soft" : "border-bad-line bg-bad-soft"
            }`}
            role="status"
            aria-live="polite"
          >
            <span className={`grid size-9 shrink-0 place-items-center rounded-full ${
              snapshot.incident.status === "resolved" ? "bg-ok text-white" : "bg-bad text-white"
            }`}>
              {snapshot.incident.status === "resolved" ? "✓" : "!"}
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.07em] text-muted">
                {snapshot.incident.status.replaceAll("_", " ")}
              </p>
              <p className="mt-0.5 text-sm font-semibold text-ink">{snapshot.incident.title}</p>
              <p className="mt-1 text-xs text-muted">{snapshot.incident.evidence}</p>
            </div>
            <a href="#incidents" className="btn-secondary sm:ml-auto">View agent trace</a>
          </div>
        )}

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            ["Fleet health", `${healthyNodes} / ${snapshot.nodes.length}`, healthyNodes === snapshot.nodes.length ? "All nodes reporting" : "Capacity degraded", healthyNodes === snapshot.nodes.length ? "ok" : "bad"],
            ["GPU utilization", `${Math.round(avgUtil)}%`, "Across risk cluster", "brand"],
            ["Active workloads", `${activeJobs}`, `${nodesWithHeadroom} node${nodesWithHeadroom === 1 ? "" : "s"} with headroom`, "brand"],
            ["Cluster power", `${(totalPower / 1000).toFixed(1)} kW`, "7.2 kW operating envelope", "brand"],
            ["Availability SLA", DATACENTER.sla, snapshot.activeFault ? "At risk" : "On target", snapshot.activeFault ? "warn" : "ok"],
          ].map(([label, value, detail, tone]) => (
            <article key={label} className="panel p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-faint">{label}</p>
              <div className="mt-3 flex items-end gap-2">
                <p className="font-mono text-2xl font-semibold tracking-[-0.03em]">{value}</p>
                <span className={`mb-1 size-2 rounded-full ${tone === "ok" ? "bg-ok" : tone === "bad" ? "bg-bad" : tone === "warn" ? "bg-warn" : "bg-brand"}`} />
              </div>
              <p className="mt-1 text-[10px] text-muted">{detail}</p>
            </article>
          ))}
        </div>
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          <section id="fleet" className="panel scroll-mt-24">
            <div className="panel-header">
              GPU fleet topology
              <span className="ml-auto normal-case tracking-normal text-faint">Select a node to inspect</span>
            </div>
            <div className="p-3.5">
              {["Rack A", "Rack B"].map((rack) => (
                <div key={rack} className="mb-4 last:mb-0">
                  <div className="mb-2.5 flex items-center gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.07em] text-muted">{rack}</p>
                    <span className="h-px flex-1 bg-line" />
                    <span className="font-mono text-[9px] text-faint">48 kW · Cooling nominal</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
                    {snapshot.nodes.filter((node) => node.rack === rack).map((node) => (
                      <NodeCard key={node.id} node={node} selected={node.id === selectedNode.id} onSelect={() => selectNode(node.id)} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section id="telemetry" className="panel scroll-mt-24">
            <div className="panel-header">
              Live telemetry
              <div className="ml-auto flex items-center gap-2 normal-case tracking-normal">
                <label htmlFor="metric-select" className="sr-only">Chart metric</label>
                <select
                  id="metric-select"
                  value={snapshot.selectedMetric}
                  onChange={(event) => selectMetric(event.target.value as NumericMetricKey)}
                  className="rounded-md border border-line bg-surface px-2 py-1 text-[10px] font-semibold text-muted"
                >
                  {METRIC_OPTIONS.map((metric) => <option key={metric.id} value={metric.id}>{metric.label}</option>)}
                </select>
              </div>
            </div>
            <div className="p-3.5">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <div>
                  <p className="text-sm font-semibold">{selectedNode.label}</p>
                  <p className="mt-0.5 text-[10px] text-faint">{selectedNode.model} · {selectedNode.workload}</p>
                </div>
                <span className={`rounded-full border px-2 py-1 text-[9px] font-bold uppercase ${healthStyle[selectedNode.health]}`}>{selectedNode.health}</span>
                <div className="ml-auto hidden gap-5 sm:flex">
                  <div><p className="text-[9px] text-faint">Heartbeat</p><p className="mt-0.5 text-xs font-semibold">{selectedNode.metrics.heartbeat ? "Reporting" : "Missing"}</p></div>
                  <div><p className="text-[9px] text-faint">ECC errors</p><p className="mt-0.5 font-mono text-xs font-semibold">{selectedNode.metrics.eccErrors}</p></div>
                  <div><p className="text-[9px] text-faint">Fabric loss</p><p className="mt-0.5 font-mono text-xs font-semibold">{selectedNode.metrics.networkLoss.toFixed(2)}%</p></div>
                </div>
              </div>
              <MetricChart node={selectedNode} values={chartValues} metric={snapshot.selectedMetric} />
            </div>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="panel">
            <div className="panel-header">
              Test controls
              <span className="ml-auto rounded-full border border-warn-line bg-warn-soft px-1.5 py-0.5 text-[8px] text-warn">Simulated</span>
            </div>
            <div className="p-4">
              <p className="text-xs leading-relaxed text-muted">
                Inject a fault into the synthetic client telemetry stream. The detector—not this button—must observe the breach before the live control plane receives an incident.
              </p>
              <div className="mt-4 grid gap-3">
                <label className="grid gap-1.5 text-[10px] font-bold uppercase tracking-[0.06em] text-faint">
                  Component
                  <select value={faultNode} onChange={(event) => setFaultNode(event.target.value)} disabled={Boolean(snapshot.activeFault)} className="rounded-lg border border-line bg-surface px-3 py-2.5 text-xs font-semibold normal-case tracking-normal text-ink disabled:opacity-60">
                    {snapshot.nodes.map((node) => <option key={node.id} value={node.id}>{node.label} · {node.workload}</option>)}
                  </select>
                </label>
                <label className="grid gap-1.5 text-[10px] font-bold uppercase tracking-[0.06em] text-faint">
                  Fault type
                  <select value={faultType} onChange={(event) => setFaultType(event.target.value as FaultType)} disabled={Boolean(snapshot.activeFault)} className="rounded-lg border border-line bg-surface px-3 py-2.5 text-xs font-semibold normal-case tracking-normal text-ink disabled:opacity-60">
                    {FAULT_OPTIONS.map((fault) => <option key={fault.id} value={fault.id}>{fault.label}</option>)}
                  </select>
                </label>
              </div>
              <div className="mt-4 rounded-lg border border-line bg-surface-2 p-3">
                <p className="text-[10px] font-bold text-ink">{FAULT_OPTIONS.find((fault) => fault.id === faultType)?.label}</p>
                <p className="mt-1 text-[10px] leading-relaxed text-muted">{FAULT_OPTIONS.find((fault) => fault.id === faultType)?.description}</p>
              </div>
              <button
                type="button"
                disabled={Boolean(snapshot.activeFault)}
                onClick={() => injectFault(faultNode, faultType)}
                className="btn-primary mt-4 w-full justify-center py-2.5 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {snapshot.activeFault ? "Test fault active" : "Inject test fault"}
              </button>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button type="button" onClick={restoreAsset} disabled={!snapshot.activeFault} className="btn-secondary justify-center disabled:opacity-45">Restore component</button>
                <button type="button" onClick={reset} className="btn-secondary justify-center">Reset demo</button>
              </div>
              <p className="mt-3 text-[9px] leading-relaxed text-faint">
                GPU telemetry is synthetic. The continuity decision trace below is read from the live local control plane.
              </p>
            </div>
          </section>

          <section id="incidents" className="panel scroll-mt-24">
            <div className="panel-header">
              Incident & agent trace
              <span className="live-dot ml-auto size-2 rounded-full bg-brand" />
            </div>
            <div className="max-h-[520px] overflow-y-auto p-4" role="log" aria-live="polite" aria-label="Client incident and agent activity">
              <ol className="space-y-0">
                {timeline.map((item, index) => (
                  <li key={item.id} className="relative grid grid-cols-[14px_1fr] gap-3 pb-5 last:pb-0">
                    {index < timeline.length - 1 && <span className="absolute left-[5px] top-3 h-full w-px bg-line" />}
                    <span className={`relative mt-1 size-2.5 rounded-full border-2 border-surface ${toneDot[item.tone]}`} />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-[9px] font-bold uppercase tracking-[0.05em] text-faint">{item.source}</p>
                        {item.simulated && <span className="rounded border border-warn-line bg-warn-soft px-1 py-0.5 text-[7px] font-bold uppercase text-warn">Client simulation</span>}
                        <span className="ml-auto font-mono text-[8px] text-faint">{item.ts ? new Date(item.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "BOOT"}</span>
                      </div>
                      <p className="mt-1 text-xs font-semibold leading-snug text-ink">{item.message}</p>
                      {item.detail && <p className="mt-1 text-[10px] leading-relaxed text-muted">{item.detail}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        </aside>
      </div>
    </DatacenterShell>
  );
}
