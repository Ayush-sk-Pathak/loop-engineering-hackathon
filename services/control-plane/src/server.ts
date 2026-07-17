import { createServer } from "node:http";
import { DemoStore } from "./store.ts";
import { runDemo } from "./runtime.ts";

const port = Number(process.env.CONTROL_PLANE_PORT ?? 4000);
const store = new DemoStore();

createServer(async (request, response) => {
  response.setHeader("access-control-allow-origin", "*");
  response.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
  response.setHeader("access-control-allow-headers", "content-type");
  response.setHeader("content-type", "application/json");
  if (request.method === "OPTIONS") {
    response.writeHead(204).end();
    return;
  }
  if (request.method === "GET" && request.url === "/health") {
    response.writeHead(200).end(JSON.stringify({ ok: true }));
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
  if (request.method === "POST" && request.url === "/api/demo/run") {
    if (store.read()?.runStatus === "running") {
      response.writeHead(409).end(JSON.stringify({ error: "Demo is already running" }));
      return;
    }
    response.writeHead(202).end(JSON.stringify({ accepted: true }));
    void runDemo(store).catch((error) => console.error("control-plane: demo failed", error));
    return;
  }
  response.writeHead(404).end(JSON.stringify({ error: "Not found" }));
}).listen(port, "127.0.0.1", () => {
  console.log(`control-plane: http://127.0.0.1:${port}`);
});
