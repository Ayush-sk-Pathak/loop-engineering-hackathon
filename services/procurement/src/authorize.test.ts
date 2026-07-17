import assert from "node:assert/strict";
import test from "node:test";
import type { PurchaseOrderRequest, VendorAttestation } from "@stockshield/contracts";
import { issueDevelopmentCapability } from "@stockshield/security";
import { authorizePurchase } from "./authorize.ts";

const secret = "test-secret";
const attestation: VendorAttestation = {
  id: "att-1", vendorId: "vendor-a", verified: true, quoteId: "quote-1",
  evidenceHash: "evidence-1", policyVersion: "vendor-risk-v1", maxAmountCents: 240_000,
  currency: "USD", nonce: "nonce-1", issuedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 60_000).toISOString(), signature: "sig",
};
const request: PurchaseOrderRequest = {
  vendorId: "vendor-a", sku: "LAPTOP-14", quantity: 20, quoteId: "quote-1",
  unitPriceCents: 12_000, currency: "USD", attestationId: "att-1",
  evidenceHash: "evidence-1", idempotencyKey: "idempotency-1",
};

test("development authorization denies missing and cross-vendor capabilities", async () => {
  await assert.rejects(
    authorizePurchase({}, request, { mode: "development", developmentSecret: secret }),
    /Missing development capability/,
  );
  const token = issueDevelopmentCapability(attestation, secret);
  await assert.rejects(
    authorizePurchase(
      { "x-stockshield-dev-capability": token },
      { ...request, vendorId: "vendor-b" },
      { mode: "development", developmentSecret: secret },
    ),
    /Vendor binding mismatch/,
  );
});
