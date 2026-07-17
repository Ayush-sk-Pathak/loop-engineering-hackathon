"use client";

import { useEffect, useRef } from "react";
import { PipelineBoard } from "@/components/agent/PipelineBoard";
import { Transcript } from "@/components/agent/Transcript";
import { ConsoleControls } from "@/components/agent/ConsoleControls";
import {
  IncidentBanner,
  OutcomeMetrics,
  VendorCandidates,
} from "@/components/agent/ContinuumPanels";
import { useContinuum } from "@/lib/store";

export function AgentTheater({
  autoStart = false,
  compact = false,
}: {
  autoStart?: boolean;
  compact?: boolean;
}) {
  const { snapshot, workspace, trigger } = useContinuum();
  const startedScenario = useRef<string | null>(null);

  useEffect(() => {
    if (!autoStart || startedScenario.current === workspace.scenario.id) return;
    const scenarioId = workspace.scenario.id;
    const t = setTimeout(() => {
      startedScenario.current = scenarioId;
      if (!snapshot.running) trigger(scenarioId);
    }, 1_100);
    return () => clearTimeout(t);
  }, [autoStart, snapshot.running, trigger, workspace.scenario.id]);

  return (
    <div>
      <IncidentBanner />
      <div className="mb-3">
        <ConsoleControls compact={compact} />
      </div>
      <PipelineBoard />
      <div className="mt-4 grid gap-4 xl:grid-cols-[1.05fr_.95fr]">
        <VendorCandidates />
        <Transcript />
      </div>
      <OutcomeMetrics />
    </div>
  );
}
