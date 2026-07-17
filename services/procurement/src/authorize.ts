import type { IncomingHttpHeaders } from "node:http";
import type { PurchaseOrderRequest } from "@continuim/contracts";
import {
  assertPurchaseBinding,
  decodeVendorAttestation,
  verifyVendorAttestation,
} from "@continuim/security";
import { createRemoteJWKSet, jwtVerify } from "jose";

export type AuthMode = "development" | "pomerium";

export interface AuthorizationConfig {
  mode: AuthMode;
  attestationSecret?: string;
  pomeriumJwksUrl?: string;
  pomeriumIssuer?: string;
  pomeriumAudience?: string;
  pomeriumSubjectPrefix?: string;
  pomeriumVendorSubjectAliases?: string;
}

export interface AuthorizationResult {
  subject: string;
  enforcementPoint: "development" | "pomerium";
  attestationId: string;
  nonce: string;
}

export async function authorizePurchase(
  headers: IncomingHttpHeaders,
  request: PurchaseOrderRequest,
  config: AuthorizationConfig,
): Promise<AuthorizationResult> {
  if (!config.attestationSecret) throw new Error("Missing attestation verification secret");

  if (config.mode === "pomerium") await verifyPomeriumIdentity(headers, request, config);

  const encodedAttestation = singleHeader(headers["x-continuim-vendor-attestation"]);
  if (!encodedAttestation) throw new Error("Missing signed vendor attestation");
  const attestation = decodeVendorAttestation(encodedAttestation);
  verifyVendorAttestation(attestation, config.attestationSecret);
  assertPurchaseBinding(attestation, request);

  return {
    subject: config.mode === "pomerium"
      ? `${config.pomeriumSubjectPrefix ?? "vendor:"}${request.vendorId}`
      : attestation.vendorId,
    enforcementPoint: config.mode,
    attestationId: attestation.id,
    nonce: attestation.nonce,
  };
}

async function verifyPomeriumIdentity(
  headers: IncomingHttpHeaders,
  request: PurchaseOrderRequest,
  config: AuthorizationConfig,
): Promise<void> {
  const assertion = singleHeader(headers["x-pomerium-jwt-assertion"]);
  if (!assertion) throw new Error("Missing Pomerium signed assertion");
  if (!config.pomeriumJwksUrl || !config.pomeriumIssuer || !config.pomeriumAudience) {
    throw new Error("Incomplete Pomerium verification configuration");
  }
  const { payload } = await jwtVerify(
    assertion,
    createRemoteJWKSet(new URL(config.pomeriumJwksUrl)),
    { issuer: config.pomeriumIssuer, audience: config.pomeriumAudience },
  );
  if (!payload.sub) throw new Error("Pomerium assertion has no subject");
  const allowedSubjects = pomeriumSubjectsForVendor(request.vendorId, config);
  if (!allowedSubjects.includes(payload.sub)) throw new Error("Pomerium subject does not match vendor path");
}

export function pomeriumSubjectsForVendor(
  vendorId: string,
  config: Pick<AuthorizationConfig, "pomeriumSubjectPrefix" | "pomeriumVendorSubjectAliases">,
): string[] {
  const canonical = `${config.pomeriumSubjectPrefix ?? "vendor:"}${vendorId}`;
  const aliases = parseVendorSubjectAliases(config.pomeriumVendorSubjectAliases)[vendorId] ?? [];
  return [canonical, ...aliases];
}

function parseVendorSubjectAliases(value: string | undefined): Record<string, string[]> {
  if (!value) return {};
  return value.split(",").reduce<Record<string, string[]>>((aliases, pair) => {
    const separator = pair.indexOf("=");
    if (separator === -1) return aliases;
    const vendorId = pair.slice(0, separator).trim();
    const subject = pair.slice(separator + 1).trim();
    if (!vendorId || !subject) return aliases;
    aliases[vendorId] = [...(aliases[vendorId] ?? []), subject];
    return aliases;
  }, {});
}

function singleHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
