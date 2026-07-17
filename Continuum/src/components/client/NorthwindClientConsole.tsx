"use client";

import Link from "next/link";
import { useState } from "react";
import { useLiveState } from "@/lib/live/useLiveState";

const INCIDENTS = [
  { id: "supplier_delay", label: "Supplier shipment delay", detail: "Expected navy dye shipment missed its delivery window." },
  { id: "inventory_stockout", label: "Navy dye reserve exhausted", detail: "Line 04 reserve is at or below its continuity threshold." },
  { id: "quality_hold", label: "Incoming lot quality hold", detail: "The available dye lot is quarantined pending quality review." },
  { id: "line_outage", label: "Line 04 production outage", detail: "The production line is stopped while material availability is recovered." },
] as const;

export function NorthwindClientConsole() {
  const { state, connected } = useLiveState("northwind");
  const [incidentType, setIncidentType] = useState<(typeof INCIDENTS)[number]["id"]>("supplier_delay");
  const [status, setStatus] = useState<string | null>(null);
  const active = state?.runStatus === "running";
  const northwindRun = state?.clientIncident?.clientId === "northwind";

  async function submitIncident() {
    setStatus(null);
    const response = await fetch("/api/control/api/demo/client-incident", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ clientId: "northwind", nodeId: "navy-dye-line-04", faultType: incidentType }),
    });
    const result = await response.json().catch(() => ({}));
    setStatus(response.ok ? "Incident accepted. The Continuum agent is evaluating recovery options." : result.error ?? "The control plane did not accept the incident.");
  }

  async function reset() {
    await fetch("/api/control/api/demo/reset?clientId=northwind", { method: "POST" });
    setStatus("Client demo reset.");
  }

  const current = INCIDENTS.find((incident) => incident.id === incidentType)!;
  const completed = northwindRun && state?.runStatus === "complete";

  return (
    <main className="min-h-screen bg-ground px-4 py-6 text-ink sm:px-6 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-wrap items-center gap-3 border-b border-line pb-5">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-ink">Client console · Northwind Textiles</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-[-0.04em]">Plant 2 · Line 04</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted">Synthetic WMS and supplier telemetry is isolated to Northwind. A confirmed material incident is sent to the persisted Continuim control plane.</p>
          </div>
          <div className="flex gap-2">
            <span className={`status-pill ${connected ? "ok" : "warn"}`}>{connected ? "Control plane live" : "Control plane unavailable"}</span>
            <Link href="/continuum" className="btn-secondary">Open agent</Link>
            <Link href="/datacenter" className="btn-secondary">Meridian client</Link>
          </div>
        </header>

        <div className="mt-6 grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
          <section className="panel p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.07em] text-faint">Client telemetry</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Metric label="Navy dye reserve" value={northwindRun ? `${state?.inventory.currentQty ?? 0} drums` : "5 drums"} detail="Continuity threshold · 2" tone={northwindRun ? "text-bad" : "text-ok"} />
              <Metric label="Line 04 status" value={completed ? "Protected" : active ? "At risk" : "Running"} detail={completed ? `${state?.inventory.inboundQty ?? 0} drums inbound` : "Navy product schedule"} tone={completed ? "text-ok" : active ? "text-warn" : "text-ink"} />
              <Metric label="Supplier signal" value={northwindRun ? "Incident" : "Nominal"} detail="Synthetic WMS / ASN feed" tone={northwindRun ? "text-warn" : "text-ok"} />
            </div>
            {northwindRun && state?.clientIncident && (
              <div className={`mt-5 rounded-xl border p-4 ${completed ? "border-ok-line bg-ok-soft" : state.runStatus === "failed" ? "border-bad-line bg-bad-soft" : "border-warn-line bg-warn-soft"}`} role="status" aria-live="polite">
                <p className="text-[10px] font-bold uppercase tracking-[0.07em] text-muted">{state.runStatus === "complete" ? "Recovery complete" : state.runStatus === "running" ? "Agent working" : "Recovery status"}</p>
                <p className="mt-1 text-sm font-semibold">{state.clientIncident.faultType.replaceAll("_", " ")} · {state.clientIncident.nodeId}</p>
                <p className="mt-1 text-xs text-muted">{completed ? `Authorized PO ${state.order?.id ?? "created"}; ${state.inventory.inboundQty} drums scheduled inbound.` : "This client event is persisted and visible in the agent trace."}</p>
              </div>
            )}
          </section>

          <section className="panel p-5">
            <div className="flex items-center justify-between gap-3"><p className="text-[10px] font-bold uppercase tracking-[0.07em] text-faint">Test controls</p><span className="rounded-full border border-warn-line bg-warn-soft px-1.5 py-0.5 text-[8px] font-bold uppercase text-warn">Synthetic client data</span></div>
            <p className="mt-3 text-xs leading-relaxed text-muted">Create a material continuity incident for this client. The button submits Northwind-specific data; the agent trace below is never fabricated locally.</p>
            <label className="mt-4 grid gap-1.5 text-[10px] font-bold uppercase tracking-[0.06em] text-faint">Incident type
              <select value={incidentType} disabled={active} onChange={(event) => setIncidentType(event.target.value as typeof incidentType)} className="rounded-lg border border-line bg-surface px-3 py-2.5 text-xs font-semibold normal-case tracking-normal text-ink disabled:opacity-60">
                {INCIDENTS.map((incident) => <option key={incident.id} value={incident.id}>{incident.label}</option>)}
              </select>
            </label>
            <div className="mt-3 rounded-lg border border-line bg-surface-2 p-3"><p className="text-xs font-semibold">{current.label}</p><p className="mt-1 text-[10px] leading-relaxed text-muted">{current.detail}</p></div>
            <button type="button" disabled={!connected || active} onClick={() => void submitIncident()} className="btn-primary mt-4 w-full justify-center py-2.5 disabled:cursor-not-allowed disabled:opacity-45">{active ? "Agent recovery in progress" : "Create client incident"}</button>
            <button type="button" onClick={() => void reset()} className="btn-secondary mt-2 w-full justify-center">Reset client demo</button>
            {status && <p className="mt-3 text-xs text-muted" role="status">{status}</p>}
          </section>
        </div>

        <section className="panel mt-5">
          <div className="panel-header">Persisted agent trace <span className="ml-auto normal-case tracking-normal text-faint">{northwindRun ? "Northwind incident" : "Waiting for Northwind incident"}</span></div>
          <div className="divide-y divide-line p-3">
            {northwindRun && state ? state.events.map((event) => <div key={event.id} className="grid gap-1 py-2.5 sm:grid-cols-[130px_1fr]"><span className="font-mono text-[10px] font-semibold text-brand-ink">{event.phase.replaceAll("_", " ")}</span><span className="text-xs text-muted">{event.detail}</span></div>) : <p className="py-2 text-xs text-muted">No Northwind decision events yet.</p>}
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: string }) {
  return <div className="rounded-xl border border-line bg-surface p-3.5"><p className="text-[10px] font-bold uppercase tracking-[0.06em] text-faint">{label}</p><p className={`mt-2 font-mono text-xl font-semibold ${tone}`}>{value}</p><p className="mt-1 text-[10px] text-muted">{detail}</p></div>;
}
