"use client";

// Write-path demo actions — POST through the same-origin proxy to the control-plane
// /api/demo/* endpoints. Real endpoints only: callers inspect the returned Response
// (status/ok) and never fake success; the 1 Hz /api/state poller reflects the result.
// Kept standalone (no store coupling) so it composes additively with the external
// datacenter bridge.

async function post(path: string, body?: unknown): Promise<Response> {
  return fetch(`/api/control${path}`, {
    method: "POST",
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
}

export const demoRun = (): Promise<Response> => post("/api/demo/run");
export const demoConsume = (): Promise<Response> => post("/api/demo/consume");
export const demoReset = (hard = false): Promise<Response> => post("/api/demo/reset", { hard });
export const demoScenario = (id: "datacenter" | "apparel"): Promise<Response> =>
  post("/api/demo/scenario", { id });
