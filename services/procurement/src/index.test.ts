import assert from "node:assert/strict";
import test from "node:test";
import type { PurchaseOrderRequest } from "@stockshield/contracts";
import { encodeVendorAttestation, signVendorAttestation } from "@stockshield/security";
import { createPurchaseOrder, resetProcurementStateForTests } from "./index.ts";

const secret = "test-secret";
const attestation = signVendorAttestation({
  id: "att-1",
  vendorId: "vendor-a",
  vendorDomain: "vendor-a.example",
  verified: true,
  quoteId: "quote-1",
  sku: "DDR5-ECC-64GB",
  payeeName: "Vendor A LLC",
  payeeAccountRef: "acct-a",
  evidenceHash: "evidence-1",
  policyVersion: "vendor-risk-v1",
  unitPriceCents: 12_000,
  maxQuantity: 20,
  maxAmountCents: 240_000,
  currency: "USD",
  nonce: "nonce-1",
  issuedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
}, secret);
const request: PurchaseOrderRequest = {
  vendorId: "vendor-a",
  vendorDomain: "vendor-a.example",
  sku: "DDR5-ECC-64GB",
  quantity: 20,
  quoteId: "quote-1",
  payeeName: "Vendor A LLC",
  payeeAccountRef: "acct-a",
  unitPriceCents: 12_000,
  currency: "USD",
  attestationId: "att-1",
  evidenceHash: "evidence-1",
  authorizationNonce: "nonce-1",
  idempotencyKey: "po-1",
};
const config = { mode: "development" as const, attestationSecret: secret };
const headers = { "x-stockshield-vendor-attestation": encodeVendorAttestation(attestation) };

test("authorization precedes idempotency and nonces cannot authorize a second order", async () => {
  resetProcurementStateForTests();

  const denied = await createPurchaseOrder({}, request, config);
  assert.equal(denied.status, 403);

  const created = await createPurchaseOrder(headers, request, config);
  assert.equal(created.status, 201);
  assert.ok(created.order);

  const unauthorizedReplay = await createPurchaseOrder({}, request, config);
  assert.equal(unauthorizedReplay.status, 403);

  const idempotentReplay = await createPurchaseOrder(headers, request, config);
  assert.equal(idempotentReplay.status, 201);
  assert.equal(idempotentReplay.order?.id, created.order?.id);

  const changedRequest = await createPurchaseOrder(
    headers,
    { ...request, quantity: 19 },
    config,
  );
  assert.equal(changedRequest.status, 409);
  assert.match(changedRequest.reason ?? "", /different request/);

  const replayedNonce = await createPurchaseOrder(
    headers,
    { ...request, idempotencyKey: "po-2" },
    config,
  );
  assert.equal(replayedNonce.status, 409);
  assert.match(replayedNonce.reason ?? "", /nonce/);
});
