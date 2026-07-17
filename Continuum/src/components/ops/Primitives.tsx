"use client";

import Link from "next/link";
import { useContinuum } from "@/lib/store";
import type { ActivityItem, AssetStatus, PurchaseAttempt } from "@/lib/types";
import { formatCurrency } from "@/lib/format";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start gap-4">
      <div>
        {eyebrow && (
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.08em] text-faint">
            {eyebrow}
          </p>
        )}
        <h1 className="text-xl font-bold tracking-[-0.02em] text-ink">{title}</h1>
        <p className="mt-1 max-w-2xl text-[12.5px] text-muted">{description}</p>
      </div>
      {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function KpiGrid() {
  const { workspace } = useContinuum();
  const items = [
    { label: "Active alerts", value: workspace.kpis.activeAlerts, detail: workspace.scenario.title, tone: "text-warn" },
    { label: "Risk blocked · YTD", value: workspace.kpis.blockedYtd, detail: workspace.kpis.blockedDetail, tone: "text-ok" },
    { label: "Verified vendors", value: workspace.kpis.verifiedVendors, detail: workspace.kpis.verifiedDetail, tone: "text-ink" },
    { label: workspace.kpis.protectedLabel, value: workspace.kpis.protectedValue, detail: workspace.kpis.protectedDetail, tone: "text-ink" },
  ];
  return (
    <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="panel p-3.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-muted">{item.label}</p>
          <p className={`mt-1.5 font-mono text-[22px] font-bold tracking-[-0.03em] ${item.tone}`}>{item.value}</p>
          <p className="mt-0.5 text-[11px] text-faint">{item.detail}</p>
        </div>
      ))}
    </div>
  );
}

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  const tone: Record<ActivityItem["tone"], string> = {
    bad: "bg-bad",
    warn: "bg-warn",
    ok: "bg-ok",
    info: "bg-brand",
    neutral: "bg-faint",
  };
  return (
    <div className="divide-y divide-line px-3.5">
      {items.map((item, index) => (
        <div key={`${item.time}-${index}`} className="grid grid-cols-[42px_8px_1fr] items-start gap-2.5 py-3 text-[12.5px]">
          <span className="font-mono text-[10.5px] text-faint">{item.time}</span>
          <span className={`mt-1 size-2 rounded-full ${tone[item.tone]}`} />
          <p className="text-muted"><strong className="font-semibold text-ink">{item.source}</strong> · {item.message}</p>
        </div>
      ))}
    </div>
  );
}

export function AssetStatusPill({ status }: { status: AssetStatus }) {
  const cls = status === "healthy" ? "ok" : status === "low" ? "warn" : "bad";
  return <span className={`status-pill ${cls}`}>{status}</span>;
}

export function PurchaseStatusPill({ status }: { status: PurchaseAttempt["status"] }) {
  const cls = status === "placed" || status === "delivered" ? "ok" : "bad";
  return <span className={`status-pill ${cls}`}>{status}</span>;
}

export function IncidentCallout() {
  const { workspace } = useContinuum();
  return (
    <div className="mb-4 flex flex-col gap-3 rounded-xl border border-warn-line bg-warn-soft p-3.5 sm:flex-row sm:items-center">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-warn text-white">
        <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
          <path d="M12 3 2 20h20L12 3Z" /><path d="M12 10v4M12 17h.01" />
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-warn">Active continuity incident</p>
        <p className="mt-0.5 text-[12.5px] text-muted">
          <strong className="font-semibold text-ink">{workspace.scenario.title}</strong> — {workspace.scenario.description} {workspace.scenario.impact}
        </p>
      </div>
      <Link href="/continuum" className="btn-secondary shrink-0 border-warn-line text-warn">
        Open Continuum
      </Link>
    </div>
  );
}

export function PurchaseTable() {
  const { workspace } = useContinuum();
  return (
    <div className="panel overflow-x-auto">
      <table className="data-table min-w-[760px]">
        <thead>
          <tr><th>Purchase order</th><th>Vendor</th><th>Item</th><th className="text-right">Amount</th><th>Status</th><th>Decision</th></tr>
        </thead>
        <tbody>
          {workspace.purchases.map((purchase) => (
            <tr key={purchase.id} className={purchase.status === "blocked" ? "bg-bad-soft/45" : ""}>
              <td className="font-mono font-semibold !text-ink">{purchase.id}</td>
              <td className="font-medium !text-ink">{purchase.vendorName}</td>
              <td>{purchase.item}</td>
              <td className="text-right font-mono">{formatCurrency(purchase.amount)}</td>
              <td><PurchaseStatusPill status={purchase.status} /></td>
              <td className={purchase.status === "blocked" ? "!text-bad" : ""}>{purchase.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
