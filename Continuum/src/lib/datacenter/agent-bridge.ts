import type { ClientIncident } from "./types";

/**
 * Submit a detector-confirmed client incident to the control plane. The browser
 * receives only the acceptance response; every later agent decision is rendered
 * from persisted control-plane state, not from client-side timers.
 */
export async function submitClientIncident(incident: ClientIncident): Promise<void> {
  const response = await fetch("/api/control/api/demo/client-incident", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ nodeId: incident.nodeId, faultType: incident.faultType }),
  });
  if (!response.ok) throw new Error(`Control-plane handoff returned ${response.status}`);
}
