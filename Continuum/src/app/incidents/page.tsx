"use client";

import { OpsShell } from "@/components/layout/OpsShell";
import { PageHeader } from "@/components/ops/Primitives";
import { useContinuum } from "@/lib/store";
import { formatCurrency, formatDate, formatLatency } from "@/lib/format";
import { currentIncident } from "@/lib/live/adapt";

const runStatusTone: Record<string, string> = {
  idle: "",
  running: "warn",
  complete: "ok",
  failed: "bad",
};

export default function IncidentsPage() {
  const { live, liveState, incidents } = useContinuum();

  if (live && liveState) {
    const inc = currentIncident(liveState);
    const { incidentCount, lastResolutionMs } = liveState.learning;
    const breached = inc.onHand <= inc.threshold;

    return (
      <OpsShell>
        <PageHeader
          eyebrow="Continuity"
          title="Incidents"
          description="The live incident held by the control-plane, plus the aggregate resolved to date."
          actions={<span className={`status-pill ${runStatusTone[inc.runStatus] ?? ""}`}>{inc.runStatus}</span>}
        />

        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <div className="panel p-3.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-muted">Incidents resolved</p>
            <p className="mt-1.5 font-mono text-[22px] font-bold text-ink">{incidentCount}</p>
            <p className="mt-0.5 text-[11px] text-faint">Recorded to the ledger</p>
          </div>
          <div className="panel p-3.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-muted">Last resolution</p>
            <p className="mt-1.5 font-mono text-[22px] font-bold text-ink">{lastResolutionMs == null ? "—" : formatLatency(lastResolutionMs)}</p>
            <p className="mt-0.5 text-[11px] text-faint">Detect → inbound scheduled</p>
          </div>
          <div className="panel p-3.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-muted">At-risk value prevented</p>
            <p className="mt-1.5 font-mono text-[22px] font-bold text-ok">{formatCurrency(inc.atRiskPreventedCents)}</p>
            <p className="mt-0.5 text-[11px] text-faint">Evidence spend {formatCurrency(inc.verificationSpendCents)}</p>
          </div>
        </div>

        <section className="panel mb-4">
          <div className="panel-header">
            Current incident
            <span className="ml-auto normal-case tracking-normal text-faint">{inc.scenarioId}</span>
          </div>
          <div className="p-3.5">
            <p className="font-semibold text-ink">{inc.title}</p>
            <p className="mt-0.5 text-[12.5px] text-muted">
              {inc.itemName} (<span className="font-mono">{inc.sku}</span>) — on-hand{" "}
              <span className={`font-mono font-semibold ${breached ? "text-bad" : "text-ink"}`}>{inc.onHand}</span>{" "}
              vs threshold <span className="font-mono">{inc.threshold}</span>
              {inc.inboundQty > 0 && <> · <span className="font-mono text-ok">{inc.inboundQty} inbound scheduled</span></>}
            </p>
            <div className="mt-3.5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-bad-line bg-bad-soft p-3.5">
                <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-bad">Authorization denied</p>
                {inc.deniedRequestId ? (
                  <>
                    <p className="mt-1.5 font-mono text-[13px] font-semibold text-bad">403 · {inc.deniedPoint ?? "policy"}</p>
                    <p className="mt-1 font-mono text-[11px] text-muted">req {inc.deniedRequestId}</p>
                  </>
                ) : (
                  <p className="mt-1.5 text-[12px] text-muted">No denial recorded yet.</p>
                )}
              </div>
              <div className="rounded-lg border border-ok-line bg-ok-soft p-3.5">
                <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-ok">Recovered order</p>
                {inc.orderId ? (
                  <>
                    <p className="mt-1.5 font-mono text-[13px] font-semibold text-ok">{inc.orderId}</p>
                    <p className="mt-1 text-[11px] text-muted">{inc.orderVendor} · inbound scheduled</p>
                  </>
                ) : (
                  <p className="mt-1.5 text-[12px] text-muted">No authorized order yet.</p>
                )}
              </div>
            </div>
            <p className="mt-3 text-[11px] text-faint">
              Per-incident history is not exposed by <span className="font-mono">/api/state</span> (only the live
              incident + aggregate count); a full history table would need a control-plane endpoint.
            </p>
          </div>
        </section>
      </OpsShell>
    );
  }

  // Control-plane unreachable — show the local simulation incidents, clearly labelled.
  return (
    <OpsShell>
      <PageHeader
        eyebrow="Continuity"
        title="Incidents"
        description="Simulated incident history — the control-plane is unreachable, so this is local demo data."
      />
      <section className="panel overflow-x-auto">
        <div className="panel-header">
          Remediation history
          <span className="ml-auto normal-case tracking-normal text-faint">Simulated · {incidents.length} records</span>
        </div>
        {incidents.length === 0 ? (
          <p className="p-4 text-[12.5px] text-muted">No remediations recorded yet.</p>
        ) : (
          <table className="data-table min-w-[800px]">
            <thead>
              <tr><th>Incident</th><th>Site</th><th>Vendor</th><th className="text-right">Fee</th><th className="text-right">Latency</th><th>Path</th><th>Closed</th></tr>
            </thead>
            <tbody>
              {incidents.map((inc) => (
                <tr key={inc.id}>
                  <td className="font-medium !text-ink">{inc.title}</td>
                  <td>{inc.site}</td>
                  <td>{inc.vendorName}</td>
                  <td className="text-right font-mono">{formatCurrency(inc.fee)}</td>
                  <td className="text-right font-mono">{formatLatency(inc.latencyMs)}</td>
                  <td><span className={`status-pill ${inc.path === "warm" ? "ok" : "warn"}`}>{inc.path}</span></td>
                  <td className="font-mono text-faint">{formatDate(inc.completedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </OpsShell>
  );
}
