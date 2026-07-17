"use client";

import { OpsShell } from "@/components/layout/OpsShell";
import { AssetStatusPill, IncidentCallout, PageHeader } from "@/components/ops/Primitives";
import { useContinuum } from "@/lib/store";

export default function InventoryPage() {
  const { workspace } = useContinuum();
  const unhealthy = workspace.assets.filter((asset) => asset.status !== "healthy").length;

  return (
    <OpsShell>
      <PageHeader
        eyebrow="Operations"
        title="Inventory & assets"
        description={`Live monitored boundaries for ${workspace.name}`}
        actions={<span className="status-pill bad">{unhealthy} require attention</span>}
      />
      <IncidentCallout />
      <div className="panel overflow-x-auto">
        <div className="panel-header">
          Monitored boundaries
          <span className="ml-auto normal-case tracking-normal text-faint">{workspace.assets.length} assets</span>
        </div>
        <table className="data-table min-w-[680px]">
          <thead>
            <tr><th>Asset or item</th><th>Current state</th><th>Continuity threshold</th><th>Signal source</th><th>Status</th></tr>
          </thead>
          <tbody>
            {workspace.assets.map((asset) => (
              <tr key={asset.id} className={asset.status === "critical" || asset.status === "failed" ? "bg-bad-soft/45" : ""}>
                <td className="font-semibold !text-ink">{asset.name}</td>
                <td className="font-mono !text-ink">{asset.current}</td>
                <td className="font-mono">{asset.threshold}</td>
                <td>{asset.source}</td>
                <td><AssetStatusPill status={asset.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </OpsShell>
  );
}
