"use client";

import { useEffect, useRef, useState } from "react";
import type { DemoState } from "./contracts";

export interface LiveState {
  state: DemoState | null;
  connected: boolean;
}

const POLL_MS = 1000;

// Polls the control-plane /api/state through the same-origin proxy. When the
// control-plane is unreachable (connected=false), callers fall back to the local
// mock so the app still renders. Read-only: no commands are issued from here.
export function useLiveState(): LiveState {
  const [live, setLive] = useState<LiveState>({ state: null, connected: false });
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;

    async function poll() {
      try {
        const res = await fetch("/api/control/api/state", { cache: "no-store" });
        if (!res.ok) throw new Error(`state ${res.status}`);
        const state = (await res.json()) as DemoState;
        if (!cancelled.current) setLive({ state, connected: true });
      } catch {
        if (!cancelled.current) setLive((prev) => ({ state: prev.state, connected: false }));
      }
    }

    void poll();
    const id = window.setInterval(() => void poll(), POLL_MS);
    return () => {
      cancelled.current = true;
      window.clearInterval(id);
    };
  }, []);

  return live;
}
