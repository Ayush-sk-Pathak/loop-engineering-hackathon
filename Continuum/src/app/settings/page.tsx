"use client";

import { OpsShell } from "@/components/layout/OpsShell";
import { PageHeader } from "@/components/ops/Primitives";
import { useContinuum } from "@/lib/store";
import { formatCurrency } from "@/lib/format";

function SettingRow({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-line py-4 last:border-0 sm:flex-row sm:items-start">
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-ink">{title}</p>
        <p className="mt-0.5 text-xs text-muted">{description}</p>
      </div>
      <div className="sm:max-w-[55%]">{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const { workspace } = useContinuum();
  return (
    <OpsShell>
      <PageHeader
        eyebrow="Manage"
        title="Settings"
        description={`Guardrails and integrations for ${workspace.name}`}
      />
      <section className="panel">
        <div className="panel-header">Agent guardrails</div>
        <div className="px-4">
          <SettingRow
            title="Payment authorization policy"
            description="Machine-identity gate enforced outside the agent process."
          >
            <code className="rounded-md border border-brand-line bg-brand-soft px-2 py-1 font-mono text-[11px] text-brand-ink">
              allow if vendor.verified == true
            </code>
          </SettingRow>
          <SettingRow
            title="Autonomous spend ceiling"
            description="Orders above this amount require human approval."
          >
            <span className="font-mono text-sm font-semibold text-ink">{formatCurrency(workspace.spendCeiling)} / order</span>
          </SettingRow>
          <SettingRow
            title="Connected systems"
            description="Evidence, policy, observability, and delivery integrations."
          >
            <div className="flex flex-wrap justify-start gap-2 sm:justify-end">
              {workspace.integrations.map((integration) => (
                <span key={integration.name} className="status-pill ok normal-case tracking-normal">
                  {integration.name} · {integration.purpose}
                </span>
              ))}
            </div>
          </SettingRow>
        </div>
      </section>
    </OpsShell>
  );
}
