"use client";

import Link from "next/link";
import { useContinuum } from "@/lib/store";
import { formatCurrency, formatDate, formatLatency } from "@/lib/format";
import type { IncidentRecord } from "@/lib/types";

function Row({ incident }: { incident: IncidentRecord }) {
  return (
    <tr className="border-b border-line/70 transition hover:bg-ink-elevated/80">
      <td className="px-3 py-3 align-top">
        <p className="text-sm text-bone">{incident.title}</p>
        <p className="font-mono text-[10px] text-bone-dim">{incident.type}</p>
      </td>
      <td className="px-3 py-3 align-top text-sm text-bone-muted">{incident.site}</td>
      <td className="px-3 py-3 align-top text-sm text-bone">{incident.vendorName}</td>
      <td className="px-3 py-3 align-top font-mono text-sm text-bone-muted">
        {formatCurrency(incident.fee)}
      </td>
      <td className="px-3 py-3 align-top font-mono text-sm text-bone-muted">
        {formatLatency(incident.latencyMs)}
      </td>
      <td className="px-3 py-3 align-top">
        <span
          className={`font-mono text-[10px] uppercase tracking-[0.12em] ${
            incident.path === "warm" ? "text-teal" : "text-amber"
          }`}
        >
          {incident.path}
        </span>
      </td>
      <td className="px-3 py-3 align-top font-mono text-xs text-bone-dim">
        {formatDate(incident.completedAt)}
      </td>
    </tr>
  );
}

export function IncidentTable() {
  const { incidents } = useContinuum();

  if (incidents.length === 0) {
    return (
      <div className="border border-line bg-ink-elevated p-8 text-center">
        <p className="text-bone-muted">No remediations yet.</p>
        <Link href="/console" className="mt-3 inline-block text-sm text-teal hover:underline">
          Open console to trigger an incident
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border border-line">
      <table className="w-full min-w-[840px] text-left">
        <thead className="border-b border-line bg-ink-elevated">
          <tr className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-dim">
            <th className="px-3 py-3 font-normal">Incident</th>
            <th className="px-3 py-3 font-normal">Site</th>
            <th className="px-3 py-3 font-normal">Vendor</th>
            <th className="px-3 py-3 font-normal">Fee</th>
            <th className="px-3 py-3 font-normal">Latency</th>
            <th className="px-3 py-3 font-normal">Path</th>
            <th className="px-3 py-3 font-normal">Closed</th>
          </tr>
        </thead>
        <tbody>
          {incidents.map((inc) => (
            <Row key={inc.id} incident={inc} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
