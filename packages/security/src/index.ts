import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  Currency,
  PurchaseOrderRequest,
  VendorAttestation,
} from "@stockshield/contracts";

export interface DevelopmentCapabilityPayload {
  vendorId: string;
  attestationId: string;
  quoteId: string;
  evidenceHash: string;
  maxAmountCents: number;
  currency: Currency;
  nonce: string;
  exp: number;
}

const encode = (value: string) => Buffer.from(value).toString("base64url");
const decode = (value: string) => Buffer.from(value, "base64url").toString("utf8");

function sign(encodedPayload: string, secret: string): string {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

export function issueDevelopmentCapability(
  attestation: VendorAttestation,
  secret: string,
): string {
  const payload: DevelopmentCapabilityPayload = {
    vendorId: attestation.vendorId,
    attestationId: attestation.id,
    quoteId: attestation.quoteId,
    evidenceHash: attestation.evidenceHash,
    maxAmountCents: attestation.maxAmountCents,
    currency: attestation.currency,
    nonce: attestation.nonce,
    exp: Math.floor(new Date(attestation.expiresAt).getTime() / 1000),
  };
  const encodedPayload = encode(JSON.stringify(payload));
  return `${encodedPayload}.${sign(encodedPayload, secret)}`;
}

export function verifyDevelopmentCapability(
  token: string,
  secret: string,
): DevelopmentCapabilityPayload {
  const [encodedPayload, suppliedSignature] = token.split(".");
  if (!encodedPayload || !suppliedSignature) {
    throw new Error("Malformed development capability");
  }

  const expected = Buffer.from(sign(encodedPayload, secret));
  const supplied = Buffer.from(suppliedSignature);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
    throw new Error("Invalid development capability signature");
  }

  const payload = JSON.parse(decode(encodedPayload)) as DevelopmentCapabilityPayload;
  if (payload.exp <= Math.floor(Date.now() / 1000)) {
    throw new Error("Development capability expired");
  }
  return payload;
}

export function assertPurchaseBinding(
  payload: DevelopmentCapabilityPayload,
  request: PurchaseOrderRequest,
): void {
  const totalAmountCents = request.unitPriceCents * request.quantity;
  if (payload.vendorId !== request.vendorId) throw new Error("Vendor binding mismatch");
  if (payload.attestationId !== request.attestationId) {
    throw new Error("Attestation binding mismatch");
  }
  if (payload.quoteId !== request.quoteId) throw new Error("Quote binding mismatch");
  if (payload.evidenceHash !== request.evidenceHash) {
    throw new Error("Evidence binding mismatch");
  }
  if (payload.currency !== request.currency) throw new Error("Currency binding mismatch");
  if (totalAmountCents > payload.maxAmountCents) {
    throw new Error("Purchase exceeds authorized amount");
  }
}
