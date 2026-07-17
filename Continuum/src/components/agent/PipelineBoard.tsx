"use client";

import { motion } from "framer-motion";
import { useContinuum } from "@/lib/store";
import type { PipelineStageState } from "@/lib/types";

function stageClass(status: PipelineStageState["status"]) {
  if (status === "active") return "border-brand bg-brand-soft shadow-[0_0_0_3px_rgba(75,71,201,.10)]";
  if (status === "done") return "border-ok-line bg-ok-soft/50";
  if (status === "skipped") return "border-brand-line bg-brand-soft/55";
  if (status === "denied") return "border-bad bg-bad-soft shadow-[0_0_0_3px_rgba(189,60,50,.08)]";
  return "border-line bg-surface";
}

function statusClass(status: PipelineStageState["status"]) {
  if (status === "active") return "text-brand";
  if (status === "done") return "text-ok";
  if (status === "skipped") return "text-brand-ink";
  if (status === "denied") return "text-bad";
  return "text-faint";
}

export function PipelineStage({ stage, index }: { stage: PipelineStageState; index: number }) {
  const labels = { idle: "Waiting", active: "Running", done: "Done", skipped: "Bypassed", denied: "Denied" };
  return (
    <motion.div
      layout
      initial={false}
      animate={{ opacity: stage.status === "idle" ? 0.62 : 1, scale: stage.status === "active" ? 1.01 : 1 }}
      transition={{ duration: 0.18 }}
      data-stage={stage.id}
      className={`relative min-h-[126px] rounded-[10px] border p-3 transition-colors ${stageClass(stage.status)}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[9.5px] text-faint">{String(index + 1).padStart(2, "0")}</span>
          <h3 className="text-[12.5px] font-bold text-ink">{stage.label}</h3>
        </div>
        <span className={`text-[9px] font-bold uppercase tracking-[0.05em] ${statusClass(stage.status)}`}>
          {labels[stage.status]}
        </span>
      </div>
      {stage.artifact && (
        <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="mt-3 space-y-1">
          <p className="text-[12px] font-semibold text-ink">{stage.artifact.headline}</p>
          <p className="text-[10.5px] leading-relaxed text-muted">{stage.artifact.detail}</p>
          {stage.artifact.meta && <p className="font-mono text-[9.5px] text-faint">{stage.artifact.meta}</p>}
        </motion.div>
      )}
    </motion.div>
  );
}

export function PipelineBoard() {
  const { snapshot } = useContinuum();
  return (
    <section className="panel">
      <div className="panel-header">
        Autonomous remediation pipeline
        <span className={`ml-auto normal-case tracking-normal ${snapshot.running ? "text-brand" : "text-faint"}`}>
          {snapshot.running ? "Agent working…" : snapshot.elapsedMs > 0 ? `Resolved in ${(snapshot.elapsedMs / 1000).toFixed(1)}s` : "Ready"}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 xl:grid-cols-3">
        {snapshot.stages.map((stage, index) => (
          <PipelineStage key={stage.id} stage={stage} index={index} />
        ))}
      </div>
    </section>
  );
}
