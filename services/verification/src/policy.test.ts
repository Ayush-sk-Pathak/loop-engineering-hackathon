import assert from "node:assert/strict";
import test from "node:test";
import { DEMO_VENDORS, fixtureEvidence } from "./fixtures.ts";
import { evaluateEvidence } from "./policy.ts";

test("lookalike vendor is ineligible and receives no attestation", () => {
  const vendor = DEMO_VENDORS[0]!;
  const result = evaluateEvidence(vendor, fixtureEvidence(vendor), "secret");
  assert.equal(result.verdict.status, "ineligible");
  assert.equal(result.verdict.riskScore, 100);
  assert.equal(result.attestation, undefined);
});

test("hard failure is decisive even when required signals are missing", () => {
  const vendor = DEMO_VENDORS[0]!;
  const signals = fixtureEvidence(vendor).filter(
    (signal) => signal.kind === "payee_identity_match" || signal.kind === "typosquat_detected",
  );
  const result = evaluateEvidence(vendor, signals, "secret");
  assert.equal(result.verdict.status, "ineligible");
  assert.equal(result.attestation, undefined);
});

test("consistent vendor receives a quote-bound attestation", () => {
  const vendor = DEMO_VENDORS[1]!;
  const result = evaluateEvidence(vendor, fixtureEvidence(vendor), "secret");
  assert.equal(result.verdict.status, "eligible");
  assert.equal(result.attestation?.vendorId, vendor.id);
  assert.equal(result.attestation?.quoteId, vendor.quote.id);
  assert.equal(result.attestation?.payeeAccountRef, vendor.quote.payeeAccountRef);
});
