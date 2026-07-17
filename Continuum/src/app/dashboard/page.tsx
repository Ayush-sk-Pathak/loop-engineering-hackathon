"use client";

import { OpsShell } from "@/components/layout/OpsShell";
import {
  ActivityFeed,
  IncidentCallout,
  KpiGrid,
  PageHeader,
} from "@/components/ops/Primitives";
import { useContinuum } from "@/lib/store";
import { formatCurrency } from "@/lib/format";

export default function DashboardPage() {
  const { workspace } = useContinuum();

  return (
    <OpsShell>
      <PageHeader
        eyebrow="Operations"
        title="Dashboard"
        description={`Live continuity overview for ${workspace.name} · ${workspace.industry}`}
        actions={<span className="status-pill ok">Interceptor active</span>}
      />
      <KpiGrid />
      <IncidentCallout />
      <div className="grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
        <section className="panel">
          <div className="panel-header">
            Recent activity
            <span className="ml-auto normal-case tracking-normal text-faint">Live operational feed</span>
          </div>
          <ActivityFeed items={workspace.activity} />
        </section>
        <section className="panel">
          <div className="panel-header">Current incident outcome</div>
          <div className="grid gap-3 p-3.5 sm:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-lg border border-bad-line bg-bad-soft p-3.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-bad">At-risk payment blocked</p>
              <p className="mt-1.5 font-mono text-2xl font-bold text-bad">{formatCurrency(workspace.scenario.blockedAmount)}</p>
              <p className="mt-1 text-[11px] text-muted">Denied by payment policy before settlement</p>
            </div>
            <div className="rounded-lg border border-ok-line bg-ok-soft p-3.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-ok">{workspace.scenario.protectedLabel}</p>
              <p className="mt-1.5 font-mono text-2xl font-bold text-ok">{workspace.scenario.protectedValue}</p>
              <p className="mt-1 text-[11px] text-muted">{workspace.scenario.protectedDetail}</p>
            </div>
          </div>
        </section>
      </div>
    </OpsShell>
  );
}
