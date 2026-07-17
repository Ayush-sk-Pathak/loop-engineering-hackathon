import { createHash, randomUUID } from "node:crypto";
import type { IncomingHttpHeaders } from "node:http";
import type {
  ProcurementResult,
  PurchaseOrder,
  PurchaseOrderRequest,
} from "@stockshield/contracts";
import { authorizePurchase, type AuthorizationConfig } from "./authorize.ts";

interface StoredOrder {
  order: PurchaseOrder;
  requestHash: string;
  nonce: string;
}

const orders = new Map<string, StoredOrder>();
const consumedNonces = new Map<string, string>();

export async function createPurchaseOrder(
  headers: IncomingHttpHeaders,
  request: PurchaseOrderRequest,
  config: AuthorizationConfig,
): Promise<ProcurementResult> {
  const requestId = randomUUID();

  try {
    const authorization = await authorizePurchase(headers, request, config);
    const requestHash = createHash("sha256").update(JSON.stringify(request)).digest("hex");
    const existing = orders.get(request.idempotencyKey);
    if (existing) {
      if (existing.requestHash !== requestHash) {
        return {
          status: 409,
          reason: "Idempotency key was already used for a different request",
          enforcementPoint: "origin",
          requestId,
        };
      }
      return {
        status: 201,
        order: existing.order,
        enforcementPoint: authorization.enforcementPoint,
        requestId,
      };
    }
    const nonceOwner = consumedNonces.get(authorization.nonce);
    if (nonceOwner && nonceOwner !== request.idempotencyKey) {
      return {
        status: 409,
        reason: "Authorization nonce has already been consumed",
        enforcementPoint: "origin",
        requestId,
      };
    }
    const order: PurchaseOrder = {
      id: `PO-${randomUUID().slice(0, 8).toUpperCase()}`,
      vendorId: request.vendorId,
      sku: request.sku,
      quantity: request.quantity,
      totalAmountCents: request.unitPriceCents * request.quantity,
      currency: request.currency,
      status: "accepted",
      inboundStatus: "scheduled",
      createdAt: new Date().toISOString(),
    };
    orders.set(request.idempotencyKey, { order, requestHash, nonce: authorization.nonce });
    consumedNonces.set(authorization.nonce, request.idempotencyKey);
    return { status: 201, order, enforcementPoint: authorization.enforcementPoint, requestId };
  } catch (error) {
    return {
      status: 403,
      reason: error instanceof Error ? error.message : "Authorization denied",
      enforcementPoint: config.mode,
      requestId,
    };
  }
}

export function isPurchaseOrderRequest(value: unknown): value is PurchaseOrderRequest {
  if (!value || typeof value !== "object") return false;
  const body = value as Record<string, unknown>;
  return (
    typeof body.vendorId === "string" &&
    typeof body.vendorDomain === "string" &&
    typeof body.sku === "string" &&
    Number.isSafeInteger(body.quantity) && Number(body.quantity) > 0 &&
    typeof body.quoteId === "string" &&
    typeof body.payeeName === "string" &&
    typeof body.payeeAccountRef === "string" &&
    Number.isSafeInteger(body.unitPriceCents) && Number(body.unitPriceCents) > 0 &&
    body.currency === "USD" &&
    typeof body.attestationId === "string" &&
    typeof body.evidenceHash === "string" &&
    typeof body.authorizationNonce === "string" &&
    typeof body.idempotencyKey === "string"
  );
}

export function resetProcurementStateForTests(): void {
  orders.clear();
  consumedNonces.clear();
}
