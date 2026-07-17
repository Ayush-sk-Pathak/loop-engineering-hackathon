import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

const host = "127.0.0.1";
const basePort = 20_000 + (process.pid % 10_000);
const controlPort = basePort;
const procurementPort = basePort + 1;
const webPort = basePort + 2;
const root = process.cwd();
const databaseDir = mkdtempSync(join(tmpdir(), "continuim-demo-verify-"));
const databasePath = join(databaseDir, "control-plane.db");
const signingSecret = "fixture-demo-verify-secret";
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const children: Array<{ name: string; process: ChildProcess; output: string[] }> = [];

type ClientId = "meridian" | "northwind";
type RunSummary = {
  clientId: ClientId;
  scenario: string;
  runStatus: string;
  eventCount: number;
  orderId?: string;
  blacklistedVendorIds: string[];
  inboundQuantity: number;
};

function log(message: string) {
  console.log(`[demo:verify] ${message}`);
}

function start(name: string, args: string[], env: Record<string, string>): ChildProcess {
  const child = spawn(npm, args, {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
    detached: process.platform !== "win32",
  });
  const output: string[] = [];
  const record = (chunk: Buffer) => output.push(chunk.toString());
  child.stdout?.on("data", record);
  child.stderr?.on("data", record);
  children.push({ name, process: child, output });
  return child;
}

async function runNpm(args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(npm, args, { cwd: root, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`${npm} ${args.join(" ")} exited ${code}`)));
  });
}

async function waitFor(url: string, label: string): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await delay(150);
  }
  const service = children.find((child) => child.name === label);
  throw new Error(`${label} did not become healthy\n${service?.output.join("").slice(-4_000) ?? ""}`);
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const diagnostics = children.map(({ name, output }) => `${name}: ${output.join("").slice(-1_200)}`).join("\n");
    throw new Error(`${init?.method ?? "GET"} ${url} returned ${response.status}: ${JSON.stringify(body)}\n${diagnostics}`);
  }
  return body as T;
}

async function waitForCompletion(clientId: ClientId): Promise<RunSummary> {
  const deadline = Date.now() + 30_000;
  const endpoint = `http://${host}:${webPort}/api/control/api/state?clientId=${clientId}`;
  while (Date.now() < deadline) {
    const state = await requestJson<{
      scenario: { id: string };
      runStatus: string;
      events: unknown[];
      order?: { id: string };
      blacklistedVendorIds: string[];
      inventory: { inboundQty: number };
    }>(endpoint);
    if (state.runStatus === "complete" || state.runStatus === "failed") {
      return {
        clientId,
        scenario: state.scenario.id,
        runStatus: state.runStatus,
        eventCount: state.events.length,
        orderId: state.order?.id,
        blacklistedVendorIds: state.blacklistedVendorIds,
        inboundQuantity: state.inventory.inboundQty,
      };
    }
    await delay(125);
  }
  throw new Error(`${clientId} recovery did not reach a terminal state`);
}

function verifyDatabase() {
  const database = new DatabaseSync(databasePath);
  const integrity = database.prepare("PRAGMA integrity_check").get() as { integrity_check: string };
  const count = (table: string) => (database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }).count;
  const result = {
    integrity: integrity.integrity_check,
    meridianEvents: count("decision_events_meridian"),
    northwindEvents: count("decision_events_northwind"),
    meridianIncidents: count("incidents_meridian"),
    northwindIncidents: count("incidents_northwind"),
  };
  database.close();
  return result;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function stopChildren() {
  for (const child of children) {
    if (child.process.pid && process.platform !== "win32") process.kill(-child.process.pid, "SIGTERM");
    else child.process.kill("SIGTERM");
  }
  await Promise.all(children.map(({ process: child }) => new Promise<void>((resolve) => {
    if (child.exitCode !== null) return resolve();
    const timer = setTimeout(() => {
      if (child.pid && process.platform !== "win32") process.kill(-child.pid, "SIGKILL");
      else child.kill("SIGKILL");
      resolve();
    }, 2_000);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  })));
}

async function main() {
  log("building the production web app");
  await runNpm(["--prefix", "Continuum", "run", "build"]);

  log("starting isolated fixture services");
  start("procurement", ["run", "start:procurement"], {
    AUTH_MODE: "development",
    VERIFICATION_MODE: "fixture",
    PROCUREMENT_HOST: host,
    PROCUREMENT_PORT: String(procurementPort),
    ATTESTATION_SIGNING_SECRET: signingSecret,
    EMAIL_MODE: "off",
  });
  await waitFor(`http://${host}:${procurementPort}/health`, "procurement");

  start("control plane", ["run", "start:control"], {
    AUTH_MODE: "development",
    VERIFICATION_MODE: "fixture",
    CONTROL_PLANE_HOST: host,
    CONTROL_PLANE_PORT: String(controlPort),
    PROCUREMENT_URL: `http://${host}:${procurementPort}`,
    ATTESTATION_SIGNING_SECRET: signingSecret,
    MONITOR_ENABLED: "1",
    MONITOR_INTERVAL_MS: "100",
    DEMO_STEP_DELAY_MS: "20",
    SQLITE_PATH: databasePath,
    BEDROCK_EXPLAINER_ENABLED: "0",
    CODEX_EXPLAINER_ENABLED: "0",
    CLAUDE_EXPLAINER_ENABLED: "0",
  });
  await waitFor(`http://${host}:${controlPort}/health`, "control plane");

  start("web", ["--prefix", "Continuum", "run", "start", "--", "--hostname", host, "--port", String(webPort)], {
    CONTROL_PLANE_INTERNAL_URL: `http://${host}:${controlPort}`,
  });
  await waitFor(`http://${host}:${webPort}/api/control/health`, "web");

  const clientEndpoint = `http://${host}:${webPort}/api/control/api/demo/client-incident`;
  log("submitting Meridian and Northwind incidents concurrently through the web proxy");
  const accepted = await Promise.all([
    requestJson<{ accepted: boolean }>(clientEndpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ clientId: "meridian", nodeId: "gpu-04", faultType: "network_loss" }),
    }),
    requestJson<{ accepted: boolean }>(clientEndpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ clientId: "northwind", nodeId: "navy-dye-line-04", faultType: "quality_hold" }),
    }),
  ]);
  if (!accepted.every((result) => result.accepted)) throw new Error("A client incident was not accepted");

  const [meridian, northwind] = await Promise.all([
    waitForCompletion("meridian"),
    waitForCompletion("northwind"),
  ]);
  const database = verifyDatabase();
  const completed = [meridian, northwind].every((run) =>
    run.runStatus === "complete" && run.eventCount >= 14 && Boolean(run.orderId) && run.inboundQuantity === 20,
  );
  const validDatabase = database.integrity === "ok" && database.meridianEvents >= 14 && database.northwindEvents >= 14;
  if (!completed || !validDatabase) throw new Error(`Verification failed: ${JSON.stringify({ meridian, northwind, database })}`);

  log("PASS");
  console.table([meridian, northwind]);
  console.table([database]);
}

try {
  await main();
} catch (error) {
  console.error(`[demo:verify] FAIL: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  await stopChildren();
  rmSync(databaseDir, { recursive: true, force: true });
}
