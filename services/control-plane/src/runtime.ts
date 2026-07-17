import { randomUUID } from "node:crypto";
import type {
  ProcurementCredential,
  ProcurementResult,
  PurchaseOrderRequest,
  StockoutRiskEvent,
  VendorAttestation,
} from "@continuim/contracts";
import { SCHEMA_VERSION } from "@continuim/contracts";
import { runProcurementLoop } from "@continuim/agent";
import { encodeVendorAttestation } from "@continuim/security";
import { createEvidenceCollector, evaluateEvidence } from "@continuim/verification";
import { explainVerdict } from "./explainer.ts";
import { DemoStore } from "./store.ts";

export async function runDemo(store: DemoStore): Promise<void> {
  const state = store.read() ?? store.reset();
  const stockout: StockoutRiskEvent = {
    schemaVersion: SCHEMA_VERSION,
    type: "stockout_risk",
    eventId: randomUUID(),
    sku: state.inventory.sku,
    currentQty: 0,
    threshold: state.inventory.threshold,
    requestedQty: 20,
    occurredAt: new Date().toISOString(),
    source: "local",
  };
  return runStockout(store, stockout);
}

export async function runStockout(
  store: DemoStore,
  stockout: StockoutRiskEvent,
): Promise<void> {
  const state = store.start(stockout.currentQty, stockout.sku);
  let acceptedOrder: ProcurementResult["order"];
  const evidenceCollector = createEvidenceCollector();

  try {
    const result = await runProcurementLoop(stockout, state.vendors, {
      verification: {
        async verify(vendor) {
          const signals = await evidenceCollector.collect(vendor);
          const result = evaluateEvidence(
            vendor,
            signals,
            process.env.ATTESTATION_SIGNING_SECRET ?? "local-attestation-only-change-me",
          );
          try {
            const explanation = await explainVerdict(vendor, result.verdict);
            if (explanation) {
              store.appendEvent({
                schemaVersion: SCHEMA_VERSION,
                id: randomUUID(),
                correlationId: stockout.eventId,
                phase: "explained",
                vendorId: vendor.id,
                vendorName: vendor.tradingName,
                detail: explanation.text,
                occurredAt: new Date().toISOString(),
                metadata: {
                  provider: explanation.provider,
                  modelId: explanation.modelId,
                  region: explanation.region,
                  authoritative: false,
                  ...(explanation.fallbackFor ? { fallbackFor: explanation.fallbackFor } : {}),
                },
              });
            }
          } catch (error) {
            store.appendEvent({
              schemaVersion: SCHEMA_VERSION,
              id: randomUUID(),
              correlationId: stockout.eventId,
              phase: "explained",
              vendorId: vendor.id,
              vendorName: vendor.tradingName,
              detail: `LLM explainer unavailable; deterministic policy verdict remains authoritative.`,
              occurredAt: new Date().toISOString(),
              metadata: {
                provider: "configured-explainer-chain",
                authoritative: false,
                error: error instanceof Error ? error.message : "unknown",
              },
            });
          }
          return result;
        },
      },
      credentials: {
        async forAttestation(attestation) {
          return resolveCredential(attestation);
        },
      },
      procurement: {
        async submit(request, credential) {
          const response = await submitPurchaseOrder(request, credential);
          if (response.order) acceptedOrder = response.order;
          return response;
        },
      },
      decisions: {
        async emit(event) {
          store.appendEvent(event);
        },
      },
    }, Number(process.env.DEMO_STEP_DELAY_MS ?? 350), store.history());

    store.complete({ ...result, order: acceptedOrder });
  } catch (error) {
    store.appendEvent({
      schemaVersion: SCHEMA_VERSION,
      id: randomUUID(),
      correlationId: stockout.eventId,
      phase: "failed",
      detail: error instanceof Error ? error.message : "Recovery stopped because the control plane returned an unknown error.",
      occurredAt: new Date().toISOString(),
      metadata: { authoritative: true },
    });
    store.fail();
    throw error;
  }
}

function resolveCredential(attestation: VendorAttestation): ProcurementCredential {
  if (process.env.AUTH_MODE === "pomerium") {
    const key = `POMERIUM_VENDOR_TOKEN_${attestation.vendorId.toUpperCase().replaceAll("-", "_")}`;
    const token = process.env[key];
    if (!token) throw new Error(`Missing vendor-scoped credential ${key}`);
    return { kind: "pomerium", serviceAccountToken: token, attestation };
  }
  return { kind: "development", attestation };
}

async function submitPurchaseOrder(
  request: PurchaseOrderRequest,
  credential?: ProcurementCredential,
): Promise<ProcurementResult> {
  const baseUrl = process.env.AUTH_MODE === "pomerium"
    ? process.env.POMERIUM_ROUTE_URL
    : process.env.PROCUREMENT_URL ?? "http://127.0.0.1:4001";
  if (!baseUrl) throw new Error("Missing procurement route URL");

  const headers: Record<string, string> = {
    accept: "application/json",
    "content-type": "application/json",
  };
  if (credential) {
    headers["x-continuim-vendor-attestation"] = encodeVendorAttestation(
      credential.attestation,
    );
  }
  if (credential?.kind === "pomerium") {
    headers.authorization = `Bearer Pomerium-${credential.serviceAccountToken}`;
  } else if (!credential && process.env.AUTH_MODE === "pomerium") {
    const agentToken = process.env.POMERIUM_AGENT_TOKEN;
    if (!agentToken) throw new Error("Missing POMERIUM_AGENT_TOKEN for the denied policy attempt");
    headers.authorization = `Bearer Pomerium-${agentToken}`;
  }
  const response = await fetch(`${baseUrl}/po/${encodeURIComponent(request.vendorId)}`, {
    method: "POST",
    headers,
    body: JSON.stringify(request),
  });
  const body = await readProcurementResponse(response);
  return {
    status: response.status,
    order: body.order,
    reason: body.reason,
    enforcementPoint: process.env.AUTH_MODE === "pomerium" ? "pomerium" : body.enforcementPoint ?? "development",
    requestId: response.headers.get("x-request-id") ??
      response.headers.get("x-continuim-request-id") ?? body.requestId ?? randomUUID(),
  };
}

async function readProcurementResponse(response: Response): Promise<Partial<ProcurementResult>> {
  const text = await response.text();
  if (!text) return { reason: response.statusText };
  try {
    return JSON.parse(text) as Partial<ProcurementResult>;
  } catch {
    return { reason: `${response.status} ${response.statusText}: ${text.slice(0, 160)}` };
  }
}
