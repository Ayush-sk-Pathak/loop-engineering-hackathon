"use client";

import { SupplierGrid } from "@/components/ops/SupplierGrid";
import { OpsShell } from "@/components/layout/OpsShell";
import { PageHeader } from "@/components/ops/Primitives";
import { useContinuum } from "@/lib/store";

export default function SuppliersPage() {
  const { workspace } = useContinuum();
  return (
    <OpsShell>
      <PageHeader
        eyebrow="Operations"
        title="Vendor registry"
        description={`Identity evidence and commercial status for ${workspace.name} counterparties`}
      />
      <SupplierGrid />
    </OpsShell>
  );
}
