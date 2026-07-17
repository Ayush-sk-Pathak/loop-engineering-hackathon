import type { ClientIncident } from "./types";

export interface ClientIncidentPayload {
  clientId: "meridian" | "northwind";
  nodeId: string;
  faultType: string;
}

/**
 * Submit a detector-confirmed client incident to the control plane. The browser
 * receives only the acceptance response; every later agent decision is rendered
 * from persisted control-plane state, not from client-side timers.
 */
export async function submitClientIncident(incident: Pick<ClientIncident, "nodeId" | "faultType"> | ClientIncidentPayload): Promise<void> {
  const clientId = "clientId" in incident ? incident.clientId : "meridian";
  const response = await fetch("/api/control/api/demo/client-incident", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ clientId, nodeId: incident.nodeId, faultType: incident.faultType }),
  });
  if (!response.ok) throw new Error(`Control-plane handoff returned ${response.status}`);
}
