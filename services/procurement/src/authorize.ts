import type { IncomingHttpHeaders } from "node:http";
import type { PurchaseOrderRequest } from "@continuim/contracts";
import {
  assertPurchaseBinding,
  decodeVendorAttestation,
  verifyVendorAttestation,
} from "@continuim/security";

export interface AuthorizationConfig {
  attestationSecret?: string;
}

export interface AuthorizationResult {
  subject: string;
  enforcementPoint: "origin";
  attestationId: string;
  nonce: string;
}

export async function authorizePurchase(
  headers: IncomingHttpHeaders,
  request: PurchaseOrderRequest,
  config: AuthorizationConfig,
): Promise<AuthorizationResult> {
  if (!config.attestationSecret) throw new Error("Missing attestation verification secret");

  const encodedAttestation = singleHeader(headers["x-continuim-vendor-attestation"]);
  if (!encodedAttestation) throw new Error("Missing signed vendor attestation");
  const attestation = decodeVendorAttestation(encodedAttestation);
  verifyVendorAttestation(attestation, config.attestationSecret);
  assertPurchaseBinding(attestation, request);

  return {
    subject: attestation.vendorId,
    enforcementPoint: "origin",
    attestationId: attestation.id,
    nonce: attestation.nonce,
  };
}

function singleHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
