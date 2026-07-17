import { createServer } from "node:http";
import { createEvidenceHandler } from "./adapter.ts";
import { createZeroTransport } from "./transport.ts";

const port = Number(process.env.ZERO_EVIDENCE_ADAPTER_PORT ?? 4100);
const host = process.env.ZERO_EVIDENCE_ADAPTER_HOST ?? "127.0.0.1";
const transport = createZeroTransport(process.env);
const token = process.env.ZERO_EVIDENCE_ADAPTER_TOKEN;

createServer(createEvidenceHandler({ transport, token })).listen(port, host, () => {
  const session = transport ? "configured" : "NOT configured — requests answer 503";
  console.log(`zero-adapter: http://${host}:${port}/v1/evidence (Zero session ${session})`);
});
