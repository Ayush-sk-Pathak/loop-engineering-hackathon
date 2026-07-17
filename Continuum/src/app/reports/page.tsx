"use client";

import { OpsShell } from "@/components/layout/OpsShell";
import { PageHeader } from "@/components/ops/Primitives";
import { useContinuum } from "@/lib/store";
import { formatCurrency } from "@/lib/format";

export default function ReportsPage() {
  const { workspace, incidents } = useContinuum();
  const max = Math.max(...workspace.reportRows.map((row) => row.amount));
  const workspaceIncidents = incidents.filter(
    (incident) => !incident.workspaceId || incident.workspaceId === workspace.id,
  );

  return (
    <OpsShell>
      <PageHeader
        eyebrow="Governance"
        title="Continuity reports"
        description={`Protected value and policy outcomes for ${workspace.name}`}
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        {[
          { label: "Risk blocked · YTD", value: workspace.kpis.blockedYtd, detail: workspace.kpis.blockedDetail, tone: "text-ok" },
          { label: "Average verification cost", value: "$0.04", detail: "Per candidate via Zero", tone: "text-ink" },
          { label: "Autonomous resolution", value: "100%", detail: `${workspaceIncidents.length || 2} recorded incidents`, tone: "text-brand-ink" },
        ].map((metric) => (
          <div className="panel p-4" key={metric.label}>
            <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-muted">{metric.label}</p>
            <p className={`mt-2 font-mono text-2xl font-bold ${metric.tone}`}>{metric.value}</p>
            <p className="mt-1 text-[11px] text-faint">{metric.detail}</p>
          </div>
        ))}
      </div>
      <section className="panel">
        <div className="panel-header">Blocked payments by category</div>
        <div className="space-y-4 p-4">
          {workspace.reportRows.map((row) => (
            <div key={row.label} className="grid grid-cols-[110px_1fr_72px] items-center gap-3 text-xs sm:grid-cols-[160px_1fr_84px]">
              <span className="text-muted">{row.label}</span>
              <div className="h-2.5 overflow-hidden rounded-full bg-surface-3">
                <div className="h-full rounded-full bg-bad" style={{ width: `${Math.round((row.amount / max) * 100)}%` }} />
              </div>
              <span className="text-right font-mono font-semibold text-ink">{formatCurrency(row.amount * 100)}</span>
            </div>
          ))}
        </div>
      </section>
    </OpsShell>
  );
}
