import { existsSync } from "node:fs";

type Check = { label: string; ok: boolean; detail: string; required: boolean };

const verificationMode = process.env.VERIFICATION_MODE ?? "fixture";
const checks: Check[] = [];

const add = (label: string, ok: boolean, detail: string, required = true) => {
  checks.push({ label, ok, detail, required });
};

add("Node", Number(process.versions.node.split(".")[0]) >= 22, process.versions.node);
add("Dependencies", existsSync("node_modules"), "node_modules");
add("Local environment", existsSync(".env"), ".env");
add("Package lock", existsSync("package-lock.json"), "package-lock.json");
add("Verification mode", ["fixture", "live"].includes(verificationMode), verificationMode);
add(
  "Live evidence key",
  verificationMode !== "live" || Boolean(process.env.FIRECRAWL_API_KEY),
  verificationMode === "live"
    ? (process.env.FIRECRAWL_API_KEY ? "FIRECRAWL_API_KEY set" : "FIRECRAWL_API_KEY missing")
    : "not required in fixture mode",
  verificationMode === "live",
);
add(
  "Autonomous monitor",
  process.env.MONITOR_ENABLED !== "0",
  process.env.MONITOR_ENABLED === "0" ? "disabled" : "enabled",
  true,
);

for (const check of checks) {
  const mark = check.required ? (check.ok ? "PASS" : "FAIL") : "INFO";
  console.log(`${mark.padEnd(4)}  ${check.label.padEnd(36)} ${check.detail}`);
}

const failures = checks.filter((check) => check.required && !check.ok);
if (failures.length) {
  console.error(`\ndoctor: ${failures.length} required check(s) failed`);
  process.exitCode = 1;
} else {
  console.log("\ndoctor: configuration is ready");
}
