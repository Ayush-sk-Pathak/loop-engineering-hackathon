"use client";

import { AgentTheater } from "@/components/agent/DemoPlayer";
import { OpsShell } from "@/components/layout/OpsShell";
import { PageHeader } from "@/components/ops/Primitives";
import { useContinuum } from "@/lib/store";

export default function ContinuumPage() {
  const { workspace } = useContinuum();
  return (
    <OpsShell>
      <PageHeader
        eyebrow="Installed application"
        title="Continuum"
        description={`Autonomous procurement guardrail for ${workspace.name}. The payment policy is enforced outside the agent's judgment.`}
        actions={<span className="status-pill ok">Autonomous · active</span>}
      />
      <AgentTheater autoStart />
    </OpsShell>
  );
}
