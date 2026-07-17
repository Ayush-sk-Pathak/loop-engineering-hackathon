import { createServer, type IncomingMessage } from "node:http";
import type { StockoutRiskEvent } from "@stockshield/contracts";
import { SCHEMA_VERSION } from "@stockshield/contracts";
import { DemoStore } from "./store.ts";
import { runDemo, runStockout } from "./runtime.ts";
import { startInventoryMonitor } from "./monitor.ts";

const port = Number(process.env.CONTROL_PLANE_PORT ?? 4000);
const host = process.env.CONTROL_PLANE_HOST ?? "127.0.0.1";
const store = new DemoStore();

if (process.env.MONITOR_ENABLED !== "0") {
  startInventoryMonitor(
    store,
    (event) => runStockout(store, event),
    {
      intervalMs: Number(process.env.MONITOR_INTERVAL_MS ?? 2_000),
      requestedQty: Number(process.env.MONITOR_REQUESTED_QTY ?? 20),
    },
  );
}

createServer(async (request, response) => {
  response.setHeader("access-control-allow-origin", "*");
  response.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
  response.setHeader("access-control-allow-headers", "content-type, x-stockshield-webhook-secret");
  response.setHeader("content-type", "application/json");
  if (request.method === "OPTIONS") {
    response.writeHead(204).end();
    return;
  }
  if (request.method === "GET" && request.url === "/health") {
    response.writeHead(200).end(JSON.stringify({
      ok: true,
      verificationMode: process.env.VERIFICATION_MODE ?? "fixture",
      authorizationMode: process.env.AUTH_MODE ?? "development",
      monitorEnabled: store.read()?.monitor.active ?? false,
    }));
    return;
  }
  if (request.method === "GET" && request.url === "/api/state") {
    response.writeHead(200).end(JSON.stringify(store.read()));
    return;
  }
  if (request.method === "POST" && request.url === "/api/demo/reset") {
    response.writeHead(200).end(JSON.stringify(store.reset()));
    return;
  }
  if (request.method === "POST" && request.url === "/api/demo/scenario") {
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
  if (request.method === "POST" && request.url === "/api/demo/run") {
    if (store.read()?.runStatus === "running") {
      response.writeHead(409).end(JSON.stringify({ error: "Demo is already running" }));
      return;
    }
    response.writeHead(202).end(JSON.stringify({ accepted: true }));
    void runDemo(store).catch((error) => console.error("control-plane: demo failed", error));
    return;
  }
  if (request.method === "POST" && request.url === "/api/demo/consume") {
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
  if (request.method === "POST" && request.url === "/api/events/stockout") {
    if (store.read()?.runStatus === "running") {
      response.writeHead(409).end(JSON.stringify({ error: "A procurement run is already active" }));
      return;
    }
    const expectedSecret = process.env.NEXLA_WEBHOOK_SECRET;
    if (expectedSecret && request.headers["x-stockshield-webhook-secret"] !== expectedSecret) {
      response.writeHead(401).end(JSON.stringify({ error: "Invalid Nexla webhook secret" }));
      return;
    }
    try {
      const event = await readJson(request);
      if (!isStockoutRiskEvent(event) || event.source !== "nexla") {
        response.writeHead(400).end(JSON.stringify({ error: "Invalid Nexla stockout event" }));
        return;
      }
      response.writeHead(202).end(JSON.stringify({ accepted: true, eventId: event.eventId }));
      void runStockout(store, event).catch((error) => {
        console.error("control-plane: Nexla-triggered run failed", error);
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
    Number.isSafeInteger(event.requestedQty) && Number(event.requestedQty) > 0 &&
    typeof event.occurredAt === "string" && !Number.isNaN(Date.parse(event.occurredAt)) &&
    (event.source === "nexla" || event.source === "local" || event.source === "monitor")
  );
}
