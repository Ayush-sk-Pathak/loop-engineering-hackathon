import { existsSync, readFileSync } from "node:fs";

type Check = { label: string; ok: boolean; detail: string; required: boolean };

const prizeRequired = process.env.CONTINUIM_REQUIRE_PRIZE === "1";
const verificationMode = process.env.VERIFICATION_MODE ?? "fixture";
const authorizationMode = process.env.AUTH_MODE ?? "development";
const checks: Check[] = [];

const add = (label: string, ok: boolean, detail: string, required = true) => {
  checks.push({ label, ok, detail, required });
};

add("Node", Number(process.versions.node.split(".")[0]) >= 22, process.versions.node);
add("Dependencies", existsSync("node_modules"), "node_modules");
add("Local environment", existsSync(".env.local"), ".env.local");
add("Package lock", existsSync("package-lock.json"), "package-lock.json");
add(
  "Verification mode",
  !prizeRequired || verificationMode === "live_zero",
  verificationMode,
  prizeRequired,
);
add(
  "Authorization mode",
  !prizeRequired || authorizationMode === "pomerium",
  authorizationMode,
  prizeRequired,
);
add(
  "Autonomous monitor",
  process.env.MONITOR_ENABLED !== "0",
  process.env.MONITOR_ENABLED === "0" ? "disabled" : "enabled",
  true,
);

let serviceLock: { verifiedAt?: string | null; services?: unknown[] } = {};
try {
  serviceLock = JSON.parse(readFileSync("config/zero-services.json", "utf8"));
} catch {}
add(
  "Zero service lock",
  !prizeRequired || (!!serviceLock.verifiedAt && (serviceLock.services?.length ?? 0) >= 3),
  serviceLock.verifiedAt ? `verified ${serviceLock.verifiedAt}` : "not live-verified",
  prizeRequired,
);

const prizeVariables = [
  "ZERO_EVIDENCE_ADAPTER_URL",
  "POMERIUM_ROUTE_URL",
  "POMERIUM_JWKS_URL",
  "POMERIUM_ISSUER",
  "POMERIUM_AUDIENCE",
  "POMERIUM_AGENT_TOKEN",
  "POMERIUM_VENDOR_TOKEN_VENDOR_NORTHSTAR",
];
for (const variable of prizeVariables) {
  add(variable, !prizeRequired || Boolean(process.env[variable]), process.env[variable] ? "set" : "missing", prizeRequired);
}

for (const check of checks) {
  const mark = check.required ? (check.ok ? "PASS" : "FAIL") : "INFO";
  console.log(`${mark.padEnd(4)}  ${check.label.padEnd(36)} ${check.detail}`);
}

const failures = checks.filter((check) => check.required && !check.ok);
if (failures.length) {
  console.error(`\ndoctor: ${failures.length} required check(s) failed`);
  process.exitCode = 1;
} else {
  console.log(`\ndoctor: ${prizeRequired ? "prize" : "local"} configuration is ready`);
}
