"use client";

import { OpsShell } from "@/components/layout/OpsShell";
import { PageHeader, PurchaseTable } from "@/components/ops/Primitives";
import { useContinuum } from "@/lib/store";

export default function ProcurementPage() {
  const { workspace } = useContinuum();
  return (
    <OpsShell>
      <PageHeader
        eyebrow="Operations"
        title="Procurement"
        description={`Purchase decisions for ${workspace.name}. Every autonomous payment is evaluated by policy before settlement.`}
      />
      <div className="mb-4 rounded-xl border border-brand-line bg-brand-soft p-3.5 text-[12.5px] text-muted">
        <strong className="font-semibold text-brand-ink">Safety guarantee:</strong>{" "}
        blocked rows are payments Continuum attempted but the policy gate denied because the
        counterparty lacked a current verified claim.
      </div>
      <PurchaseTable />
    </OpsShell>
  );
}
