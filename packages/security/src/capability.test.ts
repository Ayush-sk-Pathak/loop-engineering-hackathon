import assert from "node:assert/strict";
import test from "node:test";
import type { PurchaseOrderRequest, VendorAttestation } from "@stockshield/contracts";
import {
  assertPurchaseBinding,
  issueDevelopmentCapability,
  verifyDevelopmentCapability,
} from "./index.ts";

const secret = "test-secret";
const attestation: VendorAttestation = {
  id: "att-1",
  vendorId: "vendor-a",
  verified: true,
  quoteId: "quote-a",
  evidenceHash: "hash-a",
  policyVersion: "vendor-risk-v1",
  maxAmountCents: 240_000,
  currency: "USD",
  nonce: "nonce-a",
  issuedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  signature: "test-signature",
};

const request: PurchaseOrderRequest = {
  vendorId: "vendor-a",
  sku: "LAPTOP-14",
  quantity: 20,
  quoteId: "quote-a",
  unitPriceCents: 12_000,
  currency: "USD",
  attestationId: "att-1",
  evidenceHash: "hash-a",
  idempotencyKey: "po-1",
};

test("capability authorizes only its bound vendor, quote, evidence, and amount", () => {
  const token = issueDevelopmentCapability(attestation, secret);
  const payload = verifyDevelopmentCapability(token, secret);
  assert.doesNotThrow(() => assertPurchaseBinding(payload, request));
  assert.throws(
    () => assertPurchaseBinding(payload, { ...request, vendorId: "vendor-b" }),
    /Vendor binding mismatch/,
  );
  assert.throws(
    () => assertPurchaseBinding(payload, { ...request, quantity: 21 }),
    /exceeds authorized amount/,
  );
});
