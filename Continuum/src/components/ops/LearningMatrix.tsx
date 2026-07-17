"use client";

import Link from "next/link";
import { useContinuum } from "@/lib/store";
import { formatCurrency, formatDate, formatLatency } from "@/lib/format";

export function LearningMatrix() {
  const { ledger } = useContinuum();

  if (ledger.length === 0) {
    return (
      <div className="border border-line bg-ink-elevated p-8">
        <p className="text-lg text-bone">Ledger empty</p>
        <p className="mt-2 max-w-lg text-sm text-bone-muted">
          When Continuum closes a remediation, it writes incident type, vendor, fee,
          and latency here. The next matching failure skips cold discovery and
          executes the warm path instantly.
        </p>
        <Link href="/console" className="mt-4 inline-block text-sm text-teal hover:underline">
          Run a remediation to seed the matrix
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border border-line">
      <table className="w-full min-w-[760px] text-left">
        <thead className="border-b border-line bg-ink-elevated">
          <tr className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-dim">
            <th className="px-3 py-3 font-normal">Incident type</th>
            <th className="px-3 py-3 font-normal">Vendor</th>
            <th className="px-3 py-3 font-normal">Fee</th>
            <th className="px-3 py-3 font-normal">Avg latency</th>
            <th className="px-3 py-3 font-normal">Confidence</th>
            <th className="px-3 py-3 font-normal">Hits</th>
            <th className="px-3 py-3 font-normal">Last used</th>
          </tr>
        </thead>
        <tbody>
          {ledger.map((row) => (
            <tr
              key={row.incidentType}
              className="border-b border-line/70 bg-teal-soft/10 transition hover:bg-ink-elevated/80"
            >
              <td className="px-3 py-3 font-mono text-sm text-bone">{row.incidentType}</td>
              <td className="px-3 py-3 text-sm text-bone">{row.vendorName}</td>
              <td className="px-3 py-3 font-mono text-sm text-bone-muted">
                {formatCurrency(row.fee)}
              </td>
              <td className="px-3 py-3 font-mono text-sm text-bone-muted">
                {formatLatency(row.latencyMs)}
              </td>
              <td className="px-3 py-3">
                <div className="flex items-center gap-2">
                  <div className="h-1 w-16 overflow-hidden bg-ink-soft">
                    <div
                      className="h-full bg-teal"
                      style={{ width: `${row.confidence}%` }}
                    />
                  </div>
                  <span className="font-mono text-xs text-teal">{row.confidence}%</span>
                </div>
              </td>
              <td className="px-3 py-3 font-mono text-sm text-bone-muted">{row.hits}</td>
              <td className="px-3 py-3 font-mono text-xs text-bone-dim">
                {formatDate(row.lastUsed)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
