"use client";

import { motion } from "framer-motion";
import { useContinuum } from "@/lib/store";
import { formatCurrency } from "@/lib/format";
import type { Supplier } from "@/lib/types";

function MiniSparkline({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  const points = values
    .map((value, index) => `${(index / (values.length - 1)) * 200},${48 - (value / max) * 42}`)
    .join(" ");
  return (
    <svg viewBox="0 0 200 52" className="h-12 w-full text-bad" aria-hidden>
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function IncidentBanner() {
  const { workspace, snapshot } = useContinuum();
  const scenario = snapshot.activeScenario ?? workspace.scenario;
  return (
    <div className="mb-4 grid gap-3 rounded-xl border border-warn-line bg-warn-soft p-3.5 lg:grid-cols-[1fr_260px] lg:items-center">
      <div className="flex gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-warn text-white">
          <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
            <path d="M12 3 2 20h20L12 3Z" /><path d="M12 10v4M12 17h.01" />
          </svg>
        </span>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-warn">
            {snapshot.running ? "Incident in remediation" : "Continuity incident ready"}
          </p>
          <h2 className="mt-0.5 text-sm font-semibold text-ink">{scenario.title} · {scenario.site}</h2>
          <p className="mt-1 text-xs text-muted">{scenario.description} {scenario.impact}</p>
        </div>
      </div>
      <div className="rounded-lg border border-warn-line/80 bg-surface/70 px-3 py-2">
        <MiniSparkline values={snapshot.activeScenario ? snapshot.sparkline : Array.from({ length: 24 }, (_, index) => Math.max(0, scenario.threshold * (1.4 - index / 16)))} />
        <div className="flex justify-between text-[9.5px] text-muted">
          <span>{scenario.metricLabel}</span>
          <span className="font-mono">{scenario.breachValue} {scenario.unit} · threshold {scenario.threshold}</span>
        </div>
      </div>
    </div>
  );
}

function VendorCard({ vendor }: { vendor: Supplier }) {
  const { snapshot } = useContinuum();
  const verify = snapshot.stages.find((stage) => stage.id === "verify");
  const guard = snapshot.stages.find((stage) => stage.id === "guard");
  const procure = snapshot.stages.find((stage) => stage.id === "procure");
  const revealed = verify?.status === "done" || guard?.status === "active" || guard?.status === "denied" || snapshot.selectedVendor?.id === vendor.id;
  const rejected =
    snapshot.rejectedVendor?.id === vendor.id &&
    (guard?.status === "denied" || procure?.status === "active" || procure?.status === "done");
  const selected = snapshot.selectedVendor?.id === vendor.id && procure?.status !== "idle";

  return (
    <motion.article
      layout
      className={`rounded-[10px] border p-3 ${
        rejected ? "border-bad-line bg-bad-soft" : selected ? "border-ok-line bg-ok-soft" : "border-line bg-surface"
      }`}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] font-semibold text-ink">{vendor.name}</p>
          <p className="mt-0.5 text-[10.5px] text-muted">{vendor.note}</p>
        </div>
        <span className={`status-pill ${revealed ? vendor.status === "verified" ? "ok" : "bad" : ""}`}>
          {revealed ? vendor.status === "verified" ? "Verified" : "Ineligible" : "Unchecked"}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-line pt-3">
        {vendor.evidence.map((evidence) => (
          <div key={evidence.label}>
            <p className="text-[9.5px] text-faint">{evidence.label}</p>
            <p className={`font-mono text-[10px] font-semibold ${
              revealed && evidence.state === "good" ? "text-ok" : revealed && evidence.state === "bad" ? "text-bad" : "text-muted"
            }`}>
              {evidence.value}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-baseline border-t border-dashed border-line pt-2.5">
        <span className="text-[9.5px] font-bold uppercase tracking-[0.05em] text-faint">Quote</span>
        <span className="ml-2 font-mono text-sm font-bold text-ink">{formatCurrency(vendor.baseFee)}</span>
        {rejected && <span className="ml-auto text-[10px] font-bold text-bad">Payment denied</span>}
        {selected && <span className="ml-auto text-[10px] font-bold text-ok">Order placed</span>}
      </div>
    </motion.article>
  );
}

export function VendorCandidates() {
  const { workspace } = useContinuum();
  const candidates = workspace.scenario.candidateVendorIds
    .map((id) => workspace.suppliers.find((supplier) => supplier.id === id))
    .filter((supplier): supplier is Supplier => Boolean(supplier));
  return (
    <section className="panel">
      <div className="panel-header">
        Backup vendors
        <span className="ml-auto normal-case tracking-normal text-faint">{workspace.scenario.item}</span>
      </div>
      <div className="space-y-2 p-3">
        {candidates.map((vendor) => <VendorCard key={vendor.id} vendor={vendor} />)}
      </div>
    </section>
  );
}

export function OutcomeMetrics() {
  const { workspace, snapshot } = useContinuum();
  const completed = snapshot.elapsedMs > 0 && !snapshot.running;
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-3">
      <div className="rounded-xl border border-bad-line bg-bad-soft p-3.5">
        <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-bad">At-risk spend blocked</p>
        <p className="mt-1.5 font-mono text-[22px] font-bold text-bad">{completed ? formatCurrency(workspace.scenario.blockedAmount) : "$0"}</p>
        <p className="mt-0.5 text-[10.5px] text-muted">Policy-layer denial</p>
      </div>
      <div className="rounded-xl border border-ok-line bg-ok-soft p-3.5">
        <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-ok">{workspace.scenario.protectedLabel}</p>
        <p className="mt-1.5 font-mono text-[22px] font-bold text-ok">{completed ? workspace.scenario.protectedValue : "—"}</p>
        <p className="mt-0.5 text-[10.5px] text-muted">{workspace.scenario.protectedDetail}</p>
      </div>
      <div className="panel p-3.5">
        <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-muted">Time to resolve</p>
        <p className="mt-1.5 font-mono text-[22px] font-bold text-ink">{completed ? `${(snapshot.elapsedMs / 1000).toFixed(1)}s` : "—"}</p>
        <p className="mt-0.5 text-[10.5px] text-muted">{completed ? `${snapshot.path} path · no human step` : "Awaiting run"}</p>
      </div>
    </div>
  );
}
