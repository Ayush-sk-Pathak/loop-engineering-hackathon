import { randomUUID } from "node:crypto";
import type {
  ProcurementCredential,
  ProcurementResult,
  PurchaseOrderRequest,
  StockoutRiskEvent,
  VendorAttestation,
} from "@stockshield/contracts";
import { SCHEMA_VERSION } from "@stockshield/contracts";
import { runProcurementLoop } from "@stockshield/agent";
import { issueDevelopmentCapability } from "@stockshield/security";
import { DEMO_VENDORS, evaluateEvidence, fixtureEvidence } from "@stockshield/verification";
import { DemoStore } from "./store.ts";

export async function runDemo(store: DemoStore): Promise<void> {
  const state = store.start();
  const stockout: StockoutRiskEvent = {
    schemaVersion: SCHEMA_VERSION,
    type: "stockout_risk",
    eventId: randomUUID(),
    sku: state.inventory.sku,
    currentQty: 0,
    threshold: state.inventory.threshold,
    requestedQty: 20,
    occurredAt: new Date().toISOString(),
    source: process.env.NEXLA_LIVE === "1" ? "nexla" : "local",
  };
  let acceptedOrder: ProcurementResult["order"];

  try {
    const result = await runProcurementLoop(stockout, DEMO_VENDORS, {
      verification: {
        async verify(vendor) {
          return evaluateEvidence(
            vendor,
            fixtureEvidence(vendor),
            process.env.ATTESTATION_SIGNING_SECRET ?? "local-attestation-only-change-me",
          );
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
    }, Number(process.env.DEMO_STEP_DELAY_MS ?? 350));

    store.complete({ ...result, order: acceptedOrder });
  } catch (error) {
    store.fail();
    throw error;
  }
}

function resolveCredential(attestation: VendorAttestation): ProcurementCredential {
  if (process.env.AUTH_MODE === "pomerium") {
    const key = `POMERIUM_VENDOR_TOKEN_${attestation.vendorId.toUpperCase().replaceAll("-", "_")}`;
    const token = process.env[key];
    if (!token) throw new Error(`Missing vendor-scoped credential ${key}`);
    return { kind: "pomerium", serviceAccountToken: token };
  }
  return {
    kind: "development",
    token: issueDevelopmentCapability(
      attestation,
      process.env.DEV_CAPABILITY_SECRET ?? "local-development-only-change-me",
    ),
  };
}

async function submitPurchaseOrder(
  request: PurchaseOrderRequest,
  credential?: ProcurementCredential,
): Promise<ProcurementResult> {
  const baseUrl = process.env.AUTH_MODE === "pomerium"
    ? process.env.POMERIUM_ROUTE_URL
    : process.env.PROCUREMENT_URL ?? "http://127.0.0.1:4001";
  if (!baseUrl) throw new Error("Missing procurement route URL");

  const headers: Record<string, string> = { "content-type": "application/json" };
  if (credential?.kind === "development") {
    headers["x-stockshield-dev-capability"] = credential.token;
  }
  if (credential?.kind === "pomerium") {
    headers.authorization = `Bearer Pomerium-${credential.serviceAccountToken}`;
  }
  const response = await fetch(`${baseUrl}/po/${encodeURIComponent(request.vendorId)}`, {
    method: "POST",
    headers,
    body: JSON.stringify(request),
  });
  const body = (await response.json()) as Partial<ProcurementResult>;
  return {
    status: response.status,
    order: body.order,
    reason: body.reason,
    enforcementPoint: process.env.AUTH_MODE === "pomerium" ? "pomerium" : body.enforcementPoint ?? "development",
    requestId: response.headers.get("x-stockshield-request-id") ?? body.requestId ?? randomUUID(),
  };
}
