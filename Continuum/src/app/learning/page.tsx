"use client";

import { OpsShell } from "@/components/layout/OpsShell";
import { PageHeader } from "@/components/ops/Primitives";
import { useContinuum } from "@/lib/store";
import { formatCurrency, formatDate, formatLatency } from "@/lib/format";
import { learningFeed, provenVendorList } from "@/lib/live/adapt";

const toneDot: Record<string, string> = {
  bad: "bg-bad",
  warn: "bg-warn",
  ok: "bg-ok",
  info: "bg-brand",
  neutral: "bg-faint",
};

export default function LearningPage() {
  const { live, liveState, ledger } = useContinuum();

  if (live && liveState) {
    const { incidentCount, lastResolutionMs } = liveState.learning;
    const proven = provenVendorList(liveState);
    const feed = learningFeed(liveState);

    return (
      <OpsShell>
        <PageHeader
          eyebrow="Learning"
          title="Warm-path memory"
          description="Proven-vendor history and recalled decisions, read live from the control-plane learning ledger."
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
            <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-muted">Proven vendors</p>
            <p className="mt-1.5 font-mono text-[22px] font-bold text-ok">{proven.length}</p>
            <p className="mt-0.5 text-[11px] text-faint">Ranked first on recurrence</p>
          </div>
        </div>

        <section className="panel mb-4">
          <div className="panel-header">Proven-vendor history</div>
          {proven.length === 0 ? (
            <p className="p-4 text-[12.5px] text-muted">
              No proven vendors yet — the agent marks a vendor proven after it closes an incident.
              Run the loop again to see the warm path rank it first.
            </p>
          ) : (
            <div className="grid gap-3 p-3.5 sm:grid-cols-2">
              {proven.map((v) => (
                <div key={v.id} className="rounded-lg border border-ok-line bg-ok-soft p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-ink">{v.name}</h3>
                    <span className="status-pill ok">Proven</span>
                  </div>
                  <p className="mt-1 font-mono text-[11px] text-muted">{v.domain}</p>
                  <p className="mt-1 text-[11px] text-faint">Closed a prior incident · recalled ahead of cold candidates</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-header">
            Recall &amp; reasoning
            <span className="ml-auto normal-case tracking-normal text-faint">recalled_history · explained · attested · ordered</span>
          </div>
          {feed.length === 0 ? (
            <p className="p-4 text-[12.5px] text-muted">
              No recall or reasoning events in the current run. Warm-path recall appears once a prior
              incident exists; explanations appear when the reasoning model is configured.
            </p>
          ) : (
            <div className="divide-y divide-line px-3.5">
              {feed.map((e) => (
                <div key={e.id} className="grid grid-cols-[48px_8px_1fr] items-start gap-2.5 py-3 text-[12.5px]">
                  <span className="font-mono text-[10.5px] text-faint">{e.time}</span>
                  <span className={`mt-1 size-2 rounded-full ${toneDot[e.tone] ?? "bg-faint"}`} />
                  <p className="text-muted"><strong className="font-semibold text-ink">{e.label}</strong> · {e.detail}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </OpsShell>
    );
  }

  // Control-plane unreachable — show the local simulation ledger, clearly labelled.
  return (
    <OpsShell>
      <PageHeader
        eyebrow="Learning"
        title="Warm-path memory"
        description="Simulated learning ledger — the control-plane is unreachable, so this is local demo data."
      />
      <section className="panel overflow-x-auto">
        <div className="panel-header">
          Warm-path ledger
          <span className="ml-auto normal-case tracking-normal text-faint">Simulated · {ledger.length} entries</span>
        </div>
        {ledger.length === 0 ? (
          <p className="p-4 text-[12.5px] text-muted">Ledger empty — run a remediation to seed the warm path.</p>
        ) : (
          <table className="data-table min-w-[720px]">
            <thead>
              <tr><th>Incident type</th><th>Vendor</th><th className="text-right">Fee</th><th className="text-right">Latency</th><th className="text-right">Hits</th><th>Last used</th></tr>
            </thead>
            <tbody>
              {ledger.map((row) => (
                <tr key={row.incidentType}>
                  <td className="font-mono !text-ink">{row.incidentType}</td>
                  <td className="font-medium !text-ink">{row.vendorName}</td>
                  <td className="text-right font-mono">{formatCurrency(row.fee)}</td>
                  <td className="text-right font-mono">{formatLatency(row.latencyMs)}</td>
                  <td className="text-right font-mono">{row.hits}</td>
                  <td className="font-mono text-faint">{formatDate(row.lastUsed)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </OpsShell>
  );
}
