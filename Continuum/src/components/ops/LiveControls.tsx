"use client";

import { useState } from "react";
import { useContinuum } from "@/lib/store";
import { demoConsume, demoReset, demoRun, demoScenario } from "@/lib/live/actions";

// Live control bar for the ops dashboard: drives the real control-plane /api/demo/*
// endpoints through the proxy. Honest states — the bar is disabled when the
// control-plane is unreachable, per-action buttons disable while a run is in flight
// (they would 409), and a non-2xx response surfaces verbatim rather than faking success.
// The 1 Hz /api/state poller reflects every result; there is no optimistic UI.
export function LiveControls() {
  const { live, liveState } = useContinuum();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!live || !liveState) {
    return (
      <div className="mb-4 rounded-xl border border-line bg-surface-2 p-3.5 text-[12.5px] text-muted">
        <span className="status-pill warn normal-case tracking-normal">Controls offline</span>{" "}
        Control-plane unreachable — the dashboard is read-only until it reconnects.
      </div>
    );
  }

  const running = liveState.runStatus === "running";
  const qty = liveState.inventory.currentQty;
  const scenarioId = liveState.scenario.id;
  const otherScenario = scenarioId === "apparel" ? "datacenter" : "apparel";
  const consumeLabel = scenarioId === "apparel" ? "Consume dye stock" : "Simulate node failure";

  async function act(key: string, fn: () => Promise<Response>) {
    setBusy(key);
    setError(null);
    try {
      const res = await fn();
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        setError(`${key} failed: ${res.status}${body ? ` · ${body.slice(0, 120)}` : ""}`);
      }
    } catch {
      setError(`${key} failed: request could not reach the control-plane`);
    } finally {
      setBusy(null);
    }
  }

  const disabled = busy !== null;

  return (
    <div className="mb-4 rounded-xl border border-brand-line bg-brand-soft p-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-[10px] font-bold uppercase tracking-[0.06em] text-brand-ink">
          Live controls
        </span>
        <button
          type="button"
          className="btn-primary"
          disabled={disabled || running || qty <= 0}
          onClick={() => void act(consumeLabel, demoConsume)}
          title={qty <= 0 ? "No stock left to consume" : running ? "A run is in progress" : ""}
        >
          {busy === consumeLabel ? "Working…" : consumeLabel}
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={disabled || running}
          onClick={() => void act("Run loop", demoRun)}
        >
          {busy === "Run loop" ? "Working…" : running ? "Running…" : "Run full loop"}
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={disabled || running}
          onClick={() => void act(`Switch to ${otherScenario}`, () => demoScenario(otherScenario))}
        >
          Switch to {otherScenario}
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={disabled}
          onClick={() => void act("Reset", () => demoReset(false))}
        >
          Reset
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={disabled}
          onClick={() => void act("Hard reset", () => demoReset(true))}
          title="Clears the incident/learning ledger"
        >
          Hard reset
        </button>
        <span className="ml-auto font-mono text-[11px] text-muted">
          {scenarioId} · {running ? "running" : liveState.runStatus} · on-hand {qty}
        </span>
      </div>
      {error && (
        <p className="mt-2 font-mono text-[11px] text-bad">{error}</p>
      )}
    </div>
  );
}
