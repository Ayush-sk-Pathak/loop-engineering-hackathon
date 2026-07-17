import assert from "node:assert/strict";
import test from "node:test";
import type { PurchaseOrderRequest, VendorAttestation } from "@continuim/contracts";
import { encodeVendorAttestation, signVendorAttestation } from "@continuim/security";
import { authorizePurchase } from "./authorize.ts";

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
  idempotencyKey: "idempotency-1",
};

const headers = (value: VendorAttestation = attestation) => ({
  "x-continuim-vendor-attestation": encodeVendorAttestation(value),
});

test("development authorization requires a valid request-bound attestation", async () => {
  await assert.rejects(
    authorizePurchase({}, request, { mode: "development", attestationSecret: secret }),
    /Missing signed vendor attestation/,
  );
  await assert.rejects(
    authorizePurchase(headers(), { ...request, vendorId: "vendor-b" }, {
      mode: "development",
      attestationSecret: secret,
    }),
    /Vendor binding mismatch/,
  );
  await assert.rejects(
    authorizePurchase(headers(), { ...request, unitPriceCents: 13_000 }, {
      mode: "development",
      attestationSecret: secret,
    }),
    /Unit price binding mismatch/,
  );
  await assert.doesNotReject(
    authorizePurchase(headers(), request, {
      mode: "development",
      attestationSecret: secret,
    }),
  );
});
