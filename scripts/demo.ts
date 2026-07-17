const controlPlane = process.env.CONTROL_PLANE_URL ?? "http://127.0.0.1:4000";

const run = await fetch(`${controlPlane}/api/demo/run`, { method: "POST" });
if (!run.ok) throw new Error(`Unable to start demo: ${run.status}`);
console.log("Stockout event accepted. Watching autonomous loop...");

let previousCount = 0;
while (true) {
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
