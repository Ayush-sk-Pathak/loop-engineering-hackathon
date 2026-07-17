"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { continuumEngine } from "@/lib/simulation/engine";
import { getWorkspace } from "@/lib/data/workspaces";
import type {
  IncidentRecord,
  LedgerEntry,
  SimulationSnapshot,
  Workspace,
  WorkspaceId,
} from "@/lib/types";

function subscribe(cb: () => void) {
  return continuumEngine.subscribe(cb);
}

function getSnapshot(): SimulationSnapshot {
  return continuumEngine.getCachedSnapshot();
}

function getServerSnapshot(): SimulationSnapshot {
  return continuumEngine.getCachedSnapshot();
}

interface ContinuumStore {
  snapshot: SimulationSnapshot;
  ledger: LedgerEntry[];
  incidents: IncidentRecord[];
  workspace: Workspace;
  workspaceId: WorkspaceId;
  setWorkspace: (workspaceId: WorkspaceId) => void;
  trigger: (scenarioId?: string) => void;
  reset: () => void;
  setSpeed: (speed: number) => void;
}

const Ctx = createContext<ContinuumStore | null>(null);

export function ContinuumProvider({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [workspaceId, setWorkspaceId] = useState<WorkspaceId>("northwind");

  useEffect(() => {
    continuumEngine.hydrate();
    const saved = localStorage.getItem("continuum.workspace");
    if (saved === "northwind" || saved === "meridian") {
      setWorkspaceId(saved);
      continuumEngine.setWorkspace(saved);
    }
    const sync = () => {
      setLedger([...continuumEngine.getLedger()]);
      setIncidents([...continuumEngine.getIncidents()]);
    };
    sync();
    return continuumEngine.subscribe(sync);
  }, []);

  const trigger = useCallback((scenarioId?: string) => {
    void continuumEngine.trigger(scenarioId);
  }, []);

  const reset = useCallback(() => {
    continuumEngine.reset();
  }, []);

  const setSpeed = useCallback((speed: number) => {
    continuumEngine.setSpeed(speed);
  }, []);

  const setWorkspace = useCallback((nextWorkspaceId: WorkspaceId) => {
    localStorage.setItem("continuum.workspace", nextWorkspaceId);
    setWorkspaceId(nextWorkspaceId);
    continuumEngine.setWorkspace(nextWorkspaceId);
  }, []);

  const workspace = getWorkspace(workspaceId);

  const value = useMemo(
    () => ({
      snapshot,
      ledger,
      incidents,
      workspace,
      workspaceId,
      setWorkspace,
      trigger,
      reset,
      setSpeed,
    }),
    [
      snapshot,
      ledger,
      incidents,
      workspace,
      workspaceId,
      setWorkspace,
      trigger,
      reset,
      setSpeed,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useContinuum() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useContinuum must be used within ContinuumProvider");
  return ctx;
}
