import assert from "node:assert/strict";
import test from "node:test";
import { fixtureEvidence } from "./fixtures.ts";
import { evaluateEvidence } from "./policy.ts";
import { SCENARIOS } from "./scenarios.ts";

test("apparel typosquat vendor is ineligible and receives no attestation", () => {
  const vendor = SCENARIOS.apparel.vendors.find((candidate) => candidate.id === "vendor-pacificdye")!;
  const result = evaluateEvidence(vendor, fixtureEvidence(vendor), "secret");
  assert.equal(result.verdict.status, "ineligible");
  assert.equal(result.verdict.riskScore, 100);
  assert.equal(result.attestation, undefined);
});

test("apparel consistent vendor receives a quote-bound attestation", () => {
  const vendor = SCENARIOS.apparel.vendors.find((candidate) => candidate.id === "vendor-meridian")!;
  const result = evaluateEvidence(vendor, fixtureEvidence(vendor), "secret");
  assert.equal(result.verdict.status, "eligible");
  assert.equal(result.attestation?.vendorId, vendor.id);
  assert.equal(result.attestation?.quoteId, vendor.quote.id);
  assert.equal(result.attestation?.payeeAccountRef, vendor.quote.payeeAccountRef);
});
