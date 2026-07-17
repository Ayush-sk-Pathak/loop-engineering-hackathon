import { randomUUID } from "node:crypto";
import type { IncomingHttpHeaders } from "node:http";
import type {
  ProcurementResult,
  PurchaseOrder,
  PurchaseOrderRequest,
} from "@stockshield/contracts";
import { authorizePurchase, type AuthorizationConfig } from "./authorize.ts";

const orders = new Map<string, PurchaseOrder>();

export async function createPurchaseOrder(
  headers: IncomingHttpHeaders,
  request: PurchaseOrderRequest,
  config: AuthorizationConfig,
): Promise<ProcurementResult> {
  const requestId = randomUUID();
  const existing = orders.get(request.idempotencyKey);
  if (existing) {
    return { status: 201, order: existing, enforcementPoint: config.mode, requestId };
  }

  try {
    const authorization = await authorizePurchase(headers, request, config);
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
    orders.set(request.idempotencyKey, order);
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
    typeof body.sku === "string" &&
    typeof body.quantity === "number" && body.quantity > 0 &&
    typeof body.quoteId === "string" &&
    typeof body.unitPriceCents === "number" && body.unitPriceCents > 0 &&
    body.currency === "USD" &&
    typeof body.attestationId === "string" &&
    typeof body.evidenceHash === "string" &&
    typeof body.idempotencyKey === "string"
  );
}
