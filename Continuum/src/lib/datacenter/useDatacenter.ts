"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useLiveState } from "@/lib/live/useLiveState";
import { datacenterRuntime } from "./runtime";

export function useDatacenter() {
  const { state: controlPlaneState, connected } = useLiveState();
  const snapshot = useSyncExternalStore(
    datacenterRuntime.subscribe,
    datacenterRuntime.getSnapshot,
    datacenterRuntime.getSnapshot,
  );

  useEffect(() => {
    datacenterRuntime.start();
    return () => datacenterRuntime.stop();
  }, []);

  useEffect(() => {
    datacenterRuntime.syncControlPlane(controlPlaneState, connected);
  }, [controlPlaneState, connected]);

  return {
    snapshot,
    injectFault: datacenterRuntime.injectFault,
    restoreAsset: datacenterRuntime.restoreAsset,
    reset: datacenterRuntime.reset,
    selectNode: datacenterRuntime.selectNode,
    selectMetric: datacenterRuntime.selectMetric,
  };
}
