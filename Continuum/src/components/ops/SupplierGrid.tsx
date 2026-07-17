"use client";

import { useState } from "react";
import { useContinuum } from "@/lib/store";
import { formatCurrency, formatLatency } from "@/lib/format";
import type { VendorStatus } from "@/lib/types";

export function SupplierGrid() {
  const { workspace, live } = useContinuum();
  const [filter, setFilter] = useState<"all" | VendorStatus>("all");
  const suppliers = workspace.suppliers.filter(
    (supplier) => filter === "all" || supplier.status === filter,
  );

  return (
    <>
      <div className="mb-3 flex flex-wrap gap-1 rounded-lg border border-line bg-surface-2 p-1">
        {(["all", "verified", "ineligible", "unchecked"] as const).map((status) => (
          <button
            key={status}
            type="button"
            aria-pressed={filter === status}
            onClick={() => setFilter(status)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize ${
              filter === status ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
            }`}
          >
            {status}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {suppliers.map((supplier) => (
          <article
            key={supplier.id}
            className={`panel p-4 ${
              supplier.status === "ineligible"
                ? "border-bad-line bg-bad-soft/35"
                : supplier.status === "verified"
                  ? "border-ok-line"
                  : ""
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-ink">{supplier.name}</h3>
                <p className="mt-0.5 text-[11px] text-muted">{supplier.note}</p>
              </div>
              <span className={`status-pill ${supplier.status === "verified" ? "ok" : supplier.status === "ineligible" ? "bad" : ""}`}>
                {supplier.status}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-2 border-y border-line py-3 sm:grid-cols-4">
              {supplier.evidence.map((evidence) => (
                <div key={evidence.label}>
                  <p className="text-[10px] text-faint">{evidence.label}</p>
                  <p className={`mt-0.5 font-mono text-[11px] font-semibold ${
                    evidence.state === "good" ? "text-ok" : evidence.state === "bad" ? "text-bad" : "text-muted"
                  }`}>
                    {evidence.value}
                  </p>
                </div>
              ))}
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-[11px] sm:grid-cols-4">
              <div><dt className="text-faint">{live ? "Domain" : "Region"}</dt><dd className="mt-0.5 text-muted">{supplier.region}</dd></div>
              <div><dt className="text-faint">{live ? "Payee" : "Settlement"}</dt><dd className="mt-0.5 text-muted">{supplier.settlementRail}</dd></div>
              <div><dt className="text-faint">{live ? "Unit quote" : "Quote"}</dt><dd className="mt-0.5 font-mono font-semibold text-ink">{formatCurrency(supplier.baseFee)}</dd></div>
              <div><dt className="text-faint">{live ? "Lead time" : "Response SLA"}</dt><dd className="mt-0.5 font-mono text-muted">{live ? `${supplier.slaMs}d` : formatLatency(supplier.slaMs)}</dd></div>
            </dl>
          </article>
        ))}
      </div>
      {suppliers.length === 0 && (
        <div className="panel p-8 text-center text-sm text-muted">
          No vendors match this filter.
        </div>
      )}
    </>
  );
}
