import assert from "node:assert/strict";
import test from "node:test";
import type { PurchaseOrderRequest, VendorAttestation } from "@stockshield/contracts";
import {
  assertPurchaseBinding,
  decodeVendorAttestation,
  encodeVendorAttestation,
  signVendorAttestation,
  verifyVendorAttestation,
} from "./index.ts";

const secret = "test-secret";
const unsigned: Omit<VendorAttestation, "signature"> = {
  id: "att-1",
  vendorId: "vendor-a",
  vendorDomain: "vendor-a.example",
  verified: true,
  quoteId: "quote-a",
  sku: "DDR5-ECC-64GB",
  payeeName: "Vendor A LLC",
  payeeAccountRef: "acct-vendor-a",
  evidenceHash: "hash-a",
  policyVersion: "vendor-risk-v1",
  unitPriceCents: 12_000,
  maxQuantity: 20,
  maxAmountCents: 240_000,
  currency: "USD",
  nonce: "nonce-a",
  issuedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
};
const attestation = signVendorAttestation(unsigned, secret);

const request: PurchaseOrderRequest = {
  vendorId: "vendor-a",
  vendorDomain: "vendor-a.example",
  sku: "DDR5-ECC-64GB",
  quantity: 20,
  quoteId: "quote-a",
  payeeName: "Vendor A LLC",
  payeeAccountRef: "acct-vendor-a",
  unitPriceCents: 12_000,
  currency: "USD",
  attestationId: "att-1",
  evidenceHash: "hash-a",
  authorizationNonce: "nonce-a",
  idempotencyKey: "po-1",
};

test("signed attestation round-trips and authorizes only its bound purchase", () => {
  const decoded = decodeVendorAttestation(encodeVendorAttestation(attestation));
  assert.doesNotThrow(() => verifyVendorAttestation(decoded, secret));
  assert.doesNotThrow(() => assertPurchaseBinding(decoded, request));
  assert.throws(
    () => assertPurchaseBinding(decoded, { ...request, vendorId: "vendor-b" }),
    /Vendor binding mismatch/,
  );
  assert.throws(
    () => assertPurchaseBinding(decoded, { ...request, quantity: 21 }),
    /authorized quantity/,
  );
  assert.throws(
    () => assertPurchaseBinding(decoded, { ...request, payeeAccountRef: "acct-attacker" }),
    /Payee account binding mismatch/,
  );
});

test("tampered and expired attestations are rejected", () => {
  assert.throws(
    () => verifyVendorAttestation({ ...attestation, unitPriceCents: 1 }, secret),
    /Invalid vendor attestation signature/,
  );
  const expired = signVendorAttestation(
    { ...unsigned, expiresAt: new Date(Date.now() - 1_000).toISOString() },
    secret,
  );
  assert.throws(() => verifyVendorAttestation(expired, secret), /expired/);
});
