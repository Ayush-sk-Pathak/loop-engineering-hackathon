"use client";

import { useContinuum } from "@/lib/store";

export function ConsoleControls({ compact = false }: { compact?: boolean }) {
  const { snapshot, workspace, trigger, reset, setSpeed } = useContinuum();

  return (
    <div
      className={`flex flex-wrap items-center gap-2 ${compact ? "" : ""}`}
    >
      <button
        type="button"
        disabled={snapshot.running}
        onClick={() => trigger(workspace.scenario.id)}
        className="btn-primary disabled:cursor-not-allowed disabled:opacity-45"
      >
        {snapshot.elapsedMs > 0 ? "Run again" : "Start remediation"}
      </button>
      <button
        type="button"
        onClick={reset}
        className="btn-secondary"
      >
        Reset
      </button>
      <div className="ml-auto flex items-center gap-1 rounded-lg border border-line bg-surface-2 p-1">
        <span className="px-1.5 text-[10px] font-semibold text-faint">
          Speed
        </span>
        {[1, 2, 4].map((s) => (
          <button
            key={s}
            type="button"
            aria-label={`Set playback speed to ${s}x`}
            aria-pressed={snapshot.speed === s}
            onClick={() => setSpeed(s)}
            className={`rounded-md px-2 py-1 font-mono text-[10px] font-semibold ${
              snapshot.speed === s
                ? "bg-surface text-brand-ink shadow-sm"
                : "text-faint hover:text-ink"
            }`}
          >
            {s}x
          </button>
        ))}
      </div>
      {!compact && <p className="w-full text-[11px] text-faint">Replay after completion to see the learned warm path. Guard policy is enforced on every run.</p>}
    </div>
  );
}
