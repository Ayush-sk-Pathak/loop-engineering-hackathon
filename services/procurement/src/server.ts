import { createServer, type IncomingMessage } from "node:http";
import { createPurchaseOrder, isPurchaseOrderRequest } from "./index.ts";
import type { AuthorizationConfig } from "./authorize.ts";

const port = Number(process.env.PROCUREMENT_PORT ?? 4001);
const host = process.env.PROCUREMENT_HOST ?? "127.0.0.1";
const config: AuthorizationConfig = {
  attestationSecret: process.env.ATTESTATION_SIGNING_SECRET ?? "local-attestation-only-change-me",
};

createServer(async (request, response) => {
  response.setHeader("content-type", "application/json");
  if (request.method === "GET" && request.url === "/health") {
    response.writeHead(200).end(JSON.stringify({ ok: true, enforcementPoint: "origin" }));
    return;
  }

  const match = request.url?.match(/^\/po\/([^/?]+)$/);
  if (request.method !== "POST" || !match) {
    response.writeHead(404).end(JSON.stringify({ error: "Not found" }));
    return;
  }

  try {
    const body = await readJson(request);
    if (!isPurchaseOrderRequest(body) || body.vendorId !== decodeURIComponent(match[1]!)) {
      response.writeHead(400).end(JSON.stringify({ error: "Invalid or mismatched PO request" }));
      return;
    }
    const result = await createPurchaseOrder(request.headers, body, config);
    response.setHeader("x-continuim-request-id", result.requestId);
    response.writeHead(result.status).end(JSON.stringify(result));
  } catch (error) {
    response.writeHead(400).end(JSON.stringify({
      error: error instanceof Error ? error.message : "Invalid request",
    }));
  }
}).listen(port, host, () => {
  console.log(`procurement: http://${host}:${port} (origin enforcement)`);
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
