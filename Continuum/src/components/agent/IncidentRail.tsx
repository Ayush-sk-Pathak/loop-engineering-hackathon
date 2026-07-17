"use client";

import { motion } from "framer-motion";
import { useContinuum } from "@/lib/store";
import { SCENARIOS } from "@/lib/data/scenarios";

function Sparkline({ values, breach }: { values: number[]; breach?: number }) {
  const max = Math.max(...values, breach ?? 0, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const w = 220;
  const h = 56;
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-14 w-full text-amber" aria-hidden>
      {breach !== undefined && (
        <line
          x1="0"
          x2={w}
          y1={h - ((breach - min) / range) * (h - 4) - 2}
          y2={h - ((breach - min) / range) * (h - 4) - 2}
          stroke="currentColor"
          strokeOpacity="0.25"
          strokeDasharray="3 3"
        />
      )}
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        points={points}
      />
    </svg>
  );
}

export function IncidentRail() {
  const { snapshot } = useContinuum();
  const active = snapshot.activeScenario;

  return (
    <aside className="flex flex-col gap-4 border-line lg:border-r lg:pr-5">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-bone-dim">
          Incident stream
        </p>
        <h2 className="mt-1 text-lg text-bone">Boundaries</h2>
      </div>

      {active ? (
        <motion.div
          layout
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="border border-amber/40 bg-amber-soft p-4"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-amber">
              Active · {active.severity}
            </span>
            {snapshot.path && (
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-muted">
                {snapshot.path} path
              </span>
            )}
          </div>
          <p className="mt-3 text-base text-bone">{active.title}</p>
          <p className="mt-1 text-sm text-bone-muted">{active.site}</p>
          <p className="mt-3 text-sm text-bone-muted">{active.description}</p>
          <div className="mt-4">
            <Sparkline
              values={snapshot.sparkline}
              breach={active.threshold}
            />
            <div className="mt-1 flex justify-between font-mono text-[10px] text-bone-dim">
              <span>{active.metricLabel}</span>
              <span>
                {active.breachValue}
                {active.id === "inventory-zero" ? " units" : "%"} / thr {active.threshold}
              </span>
            </div>
          </div>
        </motion.div>
      ) : (
        <div className="border border-line bg-ink-elevated p-4">
          <p className="text-sm text-bone-muted">
            No active breach. Continuum is monitoring system boundaries.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-bone-dim">
          Queued signals
        </p>
        {SCENARIOS.filter((s) => s.id !== active?.id).map((s) => (
          <div
            key={s.id}
            className="border border-line/70 bg-ink-elevated/60 px-3 py-2.5 opacity-55"
          >
            <p className="text-sm text-bone-muted">{s.title}</p>
            <p className="font-mono text-[10px] text-bone-dim">{s.site}</p>
          </div>
        ))}
      </div>
    </aside>
  );
}
