import type { IncomingMessage, ServerResponse } from "node:http";
import type {
  EvidenceSignal,
  EvidenceSource,
  VendorCandidate,
} from "@continuim/contracts";
import type { ZeroServiceCall, ZeroTransport } from "./transport.ts";

export interface EvidenceResponse {
  vendorId: string;
  signals: EvidenceSignal[];
}

/**
 * Flatten settled Zero calls into normalized evidence signals. Each signal
 * inherits its parent call's receipt, provider, service id and cost, so several
 * signals backed by one paid call share a `receiptId` (the policy deduplicates
 * spend by receipt). Throws if a paid call (`costCents > 0`) carries no
 * `receiptId` — a paid signal without a receipt is a contract violation.
 */
export function buildEvidenceResponse(
  vendor: VendorCandidate,
  calls: ZeroServiceCall[],
): EvidenceResponse {
  const signals: EvidenceSignal[] = [];
  for (const call of calls) {
    if (call.costCents > 0 && !call.receiptId) {
      throw new Error(`Paid Zero call ${call.serviceId} is missing a receiptId`);
    }
    const source: EvidenceSource = {
      provider: call.provider,
      serviceId: call.serviceId,
      mode: "live",
      costCents: call.costCents,
      observedAt: call.observedAt,
      ...(call.receiptId ? { receiptId: call.receiptId } : {}),
    };
    for (const draft of call.signals) {
      signals.push({
        kind: draft.kind,
        value: draft.value,
        outcome: draft.outcome,
        detail: draft.detail,
        source,
      });
    }
  }
  return { vendorId: vendor.id, signals };
}

export function isEvidenceRequestBody(
  value: unknown,
): value is { vendor: VendorCandidate } {
  if (!value || typeof value !== "object") return false;
  const vendor = (value as { vendor?: unknown }).vendor;
  if (!vendor || typeof vendor !== "object") return false;
  const candidate = vendor as Partial<VendorCandidate>;
  return (
    typeof candidate.id === "string" && candidate.id.length > 0 &&
    typeof candidate.domain === "string" &&
    !!candidate.quote && typeof candidate.quote === "object"
  );
}

export interface EvidenceRequest {
  method: string;
  path: string;
  authorization?: string;
  body: unknown;
}

export interface AdapterDeps {
  transport: ZeroTransport | null;
  token?: string;
}

export interface AdapterReply {
  status: number;
  body: unknown;
}

/**
 * Pure request handler for the evidence adapter — no sockets, so it is exercised
 * directly in unit tests. `createEvidenceHandler` wraps it for `node:http`.
 */
export async function handleEvidenceRequest(
  request: EvidenceRequest,
  deps: AdapterDeps,
): Promise<AdapterReply> {
  if (request.method === "GET" && request.path === "/health") {
    return {
      status: 200,
      body: { ok: true, sessionConfigured: deps.transport !== null },
    };
  }

  if (request.method !== "POST" || request.path !== "/v1/evidence") {
    return { status: 404, body: { error: "Not found" } };
  }

  if (deps.token && request.authorization !== `Bearer ${deps.token}`) {
    return { status: 401, body: { error: "Unauthorized" } };
  }

  // No live Zero session ⇒ refuse, never fabricate live data (decision 0010).
  if (deps.transport === null) {
    return { status: 503, body: { error: "Zero session not configured" } };
  }

  if (!isEvidenceRequestBody(request.body)) {
    return { status: 400, body: { error: "Invalid vendor payload" } };
  }

  try {
    const calls = await deps.transport.gather(request.body.vendor);
    return { status: 200, body: buildEvidenceResponse(request.body.vendor, calls) };
  } catch (error) {
    return {
      status: 502,
      body: {
        error: error instanceof Error ? error.message : "Zero evidence gathering failed",
      },
    };
  }
}

/** Adapt the pure handler onto a `node:http` request/response pair. */
export function createEvidenceHandler(deps: AdapterDeps) {
  return async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    response.setHeader("content-type", "application/json");
    const path = new URL(request.url ?? "/", "http://localhost").pathname;
    let body: unknown;
    if (request.method === "POST") {
      try {
        body = await readJson(request);
      } catch {
        response.writeHead(400).end(JSON.stringify({ error: "Invalid JSON body" }));
        return;
      }
    }
    const reply = await handleEvidenceRequest(
      {
        method: request.method ?? "GET",
        path,
        authorization: request.headers.authorization,
        body,
      },
      deps,
    );
    response.writeHead(reply.status).end(JSON.stringify(reply.body));
  };
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
