const controlPlane = process.env.CONTROL_PLANE_URL ?? "http://127.0.0.1:4000";

const reset = await fetch(`${controlPlane}/api/demo/reset`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ hard: true }),
});
if (!reset.ok) throw new Error(`Unable to reset demo: ${reset.status}`);

for (let failure = 1; failure <= 3; failure += 1) {
  const consume = await fetch(`${controlPlane}/api/demo/consume`, { method: "POST" });
  if (!consume.ok) throw new Error(`Unable to consume spare ${failure}: ${consume.status}`);
  console.log(`node_failure ${failure} consumed one critical spare`);
  await new Promise((resolve) => setTimeout(resolve, 150));
}
console.log("Threshold reached. Waiting for the autonomous inventory monitor...");

let previousCount = 0;
const deadline = Date.now() + 30_000;
while (true) {
  if (Date.now() > deadline) throw new Error("Demo timed out; confirm MONITOR_ENABLED=1");
  await new Promise((resolve) => setTimeout(resolve, 250));
  const state = await fetch(`${controlPlane}/api/state`).then((response) => response.json()) as {
    runStatus: string;
    events: Array<{ phase: string; detail: string }>;
  };
  for (const event of state.events.slice(previousCount)) {
    console.log(`${event.phase.padEnd(22)} ${event.detail}`);
  }
  previousCount = state.events.length;
  if (state.runStatus === "complete") break;
  if (state.runStatus === "failed") process.exitCode = 1;
  if (state.runStatus === "failed") break;
}
