import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage } from "node:http";
import type { StockoutRiskEvent } from "@continuim/contracts";
import { SCHEMA_VERSION } from "@continuim/contracts";
import { SCENARIOS } from "@continuim/verification";
import { DemoStore } from "./store.ts";
import { runDemo, runStockout } from "./runtime.ts";
import { startInventoryMonitor } from "./monitor.ts";

const port = Number(process.env.CONTROL_PLANE_PORT ?? 4000);
const host = process.env.CONTROL_PLANE_HOST ?? "127.0.0.1";
type ClientId = "meridian" | "northwind";
const clientIncidentRoutes = {
  meridian: {
    scenario: "datacenter",
    faultTypes: new Set(["node_offline", "thermal_runaway", "ecc_spike", "network_loss", "power_failure"]),
  },
  northwind: {
    scenario: "apparel",
    faultTypes: new Set(["supplier_delay", "inventory_stockout", "quality_hold", "line_outage"]),
  },
} as const;
const stores: Record<ClientId, DemoStore> = {
  meridian: new DemoStore(process.env.SQLITE_PATH, "meridian"),
  northwind: new DemoStore(process.env.SQLITE_PATH, "northwind"),
};
if (stores.meridian.read()?.scenario.id !== "datacenter") stores.meridian.reset("datacenter");
if (stores.northwind.read()?.scenario.id !== "apparel") stores.northwind.reset("apparel");

if (process.env.MONITOR_ENABLED !== "0") {
  for (const [clientId, store] of Object.entries(stores) as [ClientId, DemoStore][]) {
    startInventoryMonitor(store, (event) => runStockout(store, event), {
      intervalMs: Number(process.env.MONITOR_INTERVAL_MS ?? 2_000),
      requestedQty: Number(process.env.MONITOR_REQUESTED_QTY ?? 20),
      onError: (error) => console.error(`control-plane: ${clientId} monitor failed`, error),
    });
  }
}

createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${host}:${port}`);
  response.setHeader("access-control-allow-origin", "*");
  response.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
  response.setHeader("access-control-allow-headers", "content-type, x-continuim-webhook-secret");
  response.setHeader("content-type", "application/json");
  if (request.method === "OPTIONS") {
    response.writeHead(204).end();
    return;
  }
  if (request.method === "GET" && url.pathname === "/health") {
    response.writeHead(200).end(JSON.stringify({
      ok: true,
      verificationMode: process.env.VERIFICATION_MODE ?? "fixture",
      authorizationMode: "origin",
      clients: Object.fromEntries(Object.entries(stores).map(([clientId, store]) => [clientId, {
        scenario: store.read()?.scenario.id,
        monitorEnabled: store.read()?.monitor.active ?? false,
      }])),
    }));
    return;
  }
  if (request.method === "GET" && url.pathname === "/api/state") {
    response.writeHead(200).end(JSON.stringify(stores[clientIdFromUrl(url)].read()));
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/demo/reset") {
    const store = stores[clientIdFromUrl(url)];
    const body = await readJson(request).catch(() => undefined);
    const hard = (body as { hard?: unknown } | undefined)?.hard === true;
    response.writeHead(200).end(JSON.stringify(store.reset(undefined, hard)));
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/demo/scenario") {
    const store = stores[clientIdFromUrl(url)];
    if (store.read()?.runStatus === "running") {
      response.writeHead(409).end(JSON.stringify({ error: "A procurement run is already active" }));
      return;
    }
    try {
      const body = await readJson(request);
      const id = (body as { id?: unknown })?.id;
      if (id !== "datacenter" && id !== "apparel") {
        response.writeHead(400).end(JSON.stringify({ error: "Unknown scenario id" }));
        return;
      }
      response.writeHead(200).end(JSON.stringify(store.reset(id)));
    } catch (error) {
      response.writeHead(400).end(JSON.stringify({
        error: error instanceof Error ? error.message : "Invalid request",
      }));
    }
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/demo/run") {
    const store = stores[clientIdFromUrl(url)];
    if (store.read()?.runStatus === "running") {
      response.writeHead(409).end(JSON.stringify({ error: "Demo is already running" }));
      return;
    }
    response.writeHead(202).end(JSON.stringify({ accepted: true }));
    void runDemo(store).catch((error) => console.error("control-plane: demo failed", error));
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/demo/consume") {
    const store = stores[clientIdFromUrl(url)];
    const state = store.read();
    if (state?.runStatus === "running") {
      response.writeHead(409).end(JSON.stringify({ error: "Procurement is already running" }));
      return;
    }
    if ((state?.inventory.currentQty ?? 0) <= 0) {
      response.writeHead(409).end(JSON.stringify({ error: "No spare inventory remains" }));
      return;
    }
    response.writeHead(200).end(JSON.stringify(store.consumeUnit()));
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/demo/client-incident") {
    try {
      const body = await readJson(request) as { clientId?: unknown; nodeId?: unknown; faultType?: unknown };
      const clientId = body.clientId === undefined ? "meridian" : body.clientId;
      if (clientId !== "meridian" && clientId !== "northwind") {
        response.writeHead(400).end(JSON.stringify({ error: "A supported clientId is required" }));
        return;
      }
      const store = stores[clientId];
      const state = store.read();
      if (!state) {
        response.writeHead(503).end(JSON.stringify({ error: "Control-plane state is unavailable" }));
        return;
      }
      if (state.runStatus === "running") {
        response.writeHead(409).end(JSON.stringify({ error: "A recovery is already active for this client" }));
        return;
      }
      if (state.inventory.inboundQty > 0) {
        response.writeHead(409).end(JSON.stringify({ error: "Recovery is already scheduled for this client; reset it before starting another incident" }));
        return;
      }
      const route = clientIncidentRoutes[clientId];
      if (
        typeof body.nodeId !== "string" ||
        typeof body.faultType !== "string" ||
        !(route.faultTypes as Set<string>).has(body.faultType)
      ) {
        response.writeHead(400).end(JSON.stringify({ error: "An asset id and supported fault type are required for this client" }));
        return;
      }
      if (state.scenario.id !== route.scenario) store.reset(route.scenario);
      store.setClientIncident(clientId, body.nodeId, body.faultType);
      let next = store.read();
      while (next && next.inventory.currentQty > next.inventory.threshold) {
        next = store.consumeUnit();
      }
      response.writeHead(202).end(JSON.stringify({
        accepted: true,
        clientId,
        nodeId: body.nodeId,
        faultType: body.faultType,
        inventory: next?.inventory,
      }));
      if (next) {
        const event: StockoutRiskEvent = {
          schemaVersion: SCHEMA_VERSION,
          type: "stockout_risk",
          eventId: randomUUID(),
          sku: next.inventory.sku,
          currentQty: next.inventory.currentQty,
          threshold: next.inventory.threshold,
          requestedQty: Number(process.env.MONITOR_REQUESTED_QTY ?? 20),
          occurredAt: new Date().toISOString(),
          source: "monitor",
        };
        void runStockout(store, event).catch((error) => {
          console.error(`control-plane: ${clientId} client-incident recovery failed`, error);
        });
      }
    } catch (error) {
      response.writeHead(400).end(JSON.stringify({
        error: error instanceof Error ? error.message : "Invalid request",
      }));
    }
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/events/stockout") {
    const expectedSecret = process.env.STOCKOUT_WEBHOOK_SECRET;
    if (expectedSecret && request.headers["x-continuim-webhook-secret"] !== expectedSecret) {
      response.writeHead(401).end(JSON.stringify({ error: "Invalid stockout webhook secret" }));
      return;
    }
    try {
      const event = await readJson(request);
      if (!isStockoutRiskEvent(event) || event.source !== "webhook") {
        response.writeHead(400).end(JSON.stringify({ error: "Invalid stockout event" }));
        return;
      }
      const scenario = Object.values(SCENARIOS).find(
        (candidate) => candidate.item.sku === event.sku,
      );
      if (!scenario) {
        response.writeHead(400).end(JSON.stringify({ error: "No scenario is configured for this SKU" }));
        return;
      }
      const clientId: ClientId = scenario.id === "datacenter" ? "meridian" : "northwind";
      const store = stores[clientId];
      if (store.read()?.runStatus === "running") {
        response.writeHead(409).end(JSON.stringify({ error: "A recovery is already active for this client" }));
        return;
      }
      if (store.read()?.scenario.id !== scenario.id) store.reset(scenario.id);
      response.writeHead(202).end(JSON.stringify({ accepted: true, eventId: event.eventId }));
      void runStockout(store, event).catch((error) => {
        console.error("control-plane: webhook-triggered run failed", error);
      });
    } catch (error) {
      response.writeHead(400).end(JSON.stringify({
        error: error instanceof Error ? error.message : "Invalid request",
      }));
    }
    return;
  }
  response.writeHead(404).end(JSON.stringify({ error: "Not found" }));
}).listen(port, host, () => {
  console.log(`control-plane: http://${host}:${port}`);
});

function clientIdFromUrl(url: URL): ClientId {
  return url.searchParams.get("clientId") === "northwind" ? "northwind" : "meridian";
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > 64 * 1024) throw new Error("Request body exceeds 64 KiB");
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function isStockoutRiskEvent(value: unknown): value is StockoutRiskEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Record<string, unknown>;
  return (
    event.schemaVersion === SCHEMA_VERSION &&
    event.type === "stockout_risk" &&
    typeof event.eventId === "string" && event.eventId.length > 0 &&
    typeof event.sku === "string" && event.sku.length > 0 &&
    Number.isSafeInteger(event.currentQty) && Number(event.currentQty) >= 0 &&
    Number.isSafeInteger(event.threshold) && Number(event.threshold) >= 0 &&
    Number(event.currentQty) <= Number(event.threshold) &&
    Number.isSafeInteger(event.requestedQty) && Number(event.requestedQty) > 0 &&
    typeof event.occurredAt === "string" && !Number.isNaN(Date.parse(event.occurredAt)) &&
    (event.source === "webhook" || event.source === "local" || event.source === "monitor")
  );
}
