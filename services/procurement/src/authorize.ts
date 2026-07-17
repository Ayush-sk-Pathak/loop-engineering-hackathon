import type { IncomingHttpHeaders } from "node:http";
import type { PurchaseOrderRequest } from "@stockshield/contracts";
import { assertPurchaseBinding, verifyDevelopmentCapability } from "@stockshield/security";
import { createRemoteJWKSet, jwtVerify } from "jose";

export type AuthMode = "development" | "pomerium";

export interface AuthorizationConfig {
  mode: AuthMode;
  developmentSecret?: string;
  pomeriumJwksUrl?: string;
  pomeriumIssuer?: string;
  pomeriumAudience?: string;
  pomeriumSubjectPrefix?: string;
}

export interface AuthorizationResult {
  subject: string;
  enforcementPoint: "development" | "pomerium";
}

export async function authorizePurchase(
  headers: IncomingHttpHeaders,
  request: PurchaseOrderRequest,
  config: AuthorizationConfig,
): Promise<AuthorizationResult> {
  if (config.mode === "development") {
    const token = singleHeader(headers["x-stockshield-dev-capability"]);
    if (!token || !config.developmentSecret) throw new Error("Missing development capability");
    const payload = verifyDevelopmentCapability(token, config.developmentSecret);
    assertPurchaseBinding(payload, request);
    return { subject: payload.vendorId, enforcementPoint: "development" };
  }

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
  const expected = `${config.pomeriumSubjectPrefix ?? "vendor:"}${request.vendorId}`;
  if (payload.sub !== expected) throw new Error("Pomerium subject does not match vendor path");
  return { subject: payload.sub, enforcementPoint: "pomerium" };
}

function singleHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
