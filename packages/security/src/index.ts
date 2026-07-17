import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  PurchaseOrderRequest,
  VendorAttestation,
} from "@stockshield/contracts";

export type UnsignedVendorAttestation = Omit<VendorAttestation, "signature">;

function canonicalAttestation(attestation: UnsignedVendorAttestation): string {
  return JSON.stringify({
    id: attestation.id,
    vendorId: attestation.vendorId,
    vendorDomain: attestation.vendorDomain,
    verified: attestation.verified,
    quoteId: attestation.quoteId,
    sku: attestation.sku,
    payeeName: attestation.payeeName,
    payeeAccountRef: attestation.payeeAccountRef,
    evidenceHash: attestation.evidenceHash,
    policyVersion: attestation.policyVersion,
    unitPriceCents: attestation.unitPriceCents,
    maxQuantity: attestation.maxQuantity,
    maxAmountCents: attestation.maxAmountCents,
    currency: attestation.currency,
    nonce: attestation.nonce,
    issuedAt: attestation.issuedAt,
    expiresAt: attestation.expiresAt,
  });
}

function signatureFor(attestation: UnsignedVendorAttestation, secret: string): Buffer {
  return createHmac("sha256", secret).update(canonicalAttestation(attestation)).digest();
}

export function signVendorAttestation(
  unsigned: UnsignedVendorAttestation,
  secret: string,
): VendorAttestation {
  if (!secret) throw new Error("Attestation signing secret is required");
  return {
    ...unsigned,
    signature: signatureFor(unsigned, secret).toString("base64url"),
  };
}

export function verifyVendorAttestation(
  attestation: VendorAttestation,
  secret: string,
  now = new Date(),
): void {
  if (!secret) throw new Error("Attestation verification secret is required");
  const { signature, ...unsigned } = attestation;
  const expected = signatureFor(unsigned, secret);
  const supplied = Buffer.from(signature, "base64url");
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
    throw new Error("Invalid vendor attestation signature");
  }
  if (attestation.verified !== true) throw new Error("Vendor attestation is not verified");
  if (new Date(attestation.expiresAt).getTime() <= now.getTime()) {
    throw new Error("Vendor attestation expired");
  }
  if (new Date(attestation.issuedAt).getTime() > now.getTime() + 30_000) {
    throw new Error("Vendor attestation was issued in the future");
  }
}

export function encodeVendorAttestation(attestation: VendorAttestation): string {
  return Buffer.from(JSON.stringify(attestation)).toString("base64url");
}

export function decodeVendorAttestation(encoded: string): VendorAttestation {
  try {
    return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as VendorAttestation;
  } catch {
    throw new Error("Malformed vendor attestation");
  }
}

export function assertPurchaseBinding(
  attestation: VendorAttestation,
  request: PurchaseOrderRequest,
): void {
  const totalAmountCents = request.unitPriceCents * request.quantity;
  if (!Number.isSafeInteger(totalAmountCents)) throw new Error("Purchase amount is invalid");
  if (attestation.vendorId !== request.vendorId) throw new Error("Vendor binding mismatch");
  if (attestation.vendorDomain !== request.vendorDomain) {
    throw new Error("Vendor domain binding mismatch");
  }
  if (attestation.id !== request.attestationId) throw new Error("Attestation binding mismatch");
  if (attestation.quoteId !== request.quoteId) throw new Error("Quote binding mismatch");
  if (attestation.sku !== request.sku) throw new Error("SKU binding mismatch");
  if (attestation.payeeName !== request.payeeName) throw new Error("Payee binding mismatch");
  if (attestation.payeeAccountRef !== request.payeeAccountRef) {
    throw new Error("Payee account binding mismatch");
  }
  if (attestation.evidenceHash !== request.evidenceHash) {
    throw new Error("Evidence binding mismatch");
  }
  if (attestation.nonce !== request.authorizationNonce) {
    throw new Error("Authorization nonce binding mismatch");
  }
  if (attestation.currency !== request.currency) throw new Error("Currency binding mismatch");
  if (attestation.unitPriceCents !== request.unitPriceCents) {
    throw new Error("Unit price binding mismatch");
  }
  if (request.quantity > attestation.maxQuantity) {
    throw new Error("Purchase exceeds authorized quantity");
  }
  if (totalAmountCents > attestation.maxAmountCents) {
    throw new Error("Purchase exceeds authorized amount");
  }
}
