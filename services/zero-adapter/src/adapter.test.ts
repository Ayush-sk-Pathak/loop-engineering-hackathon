import assert from "node:assert/strict";
import test from "node:test";
import type { VendorCandidate } from "@stockshield/contracts";
import {
  buildEvidenceResponse,
  handleEvidenceRequest,
  isEvidenceRequestBody,
} from "./adapter.ts";
import { createZeroTransport, type ZeroServiceCall, type ZeroTransport } from "./transport.ts";

const vendor: VendorCandidate = {
  id: "vendor-northstar",
  legalName: "Northstar Supply Cooperative",
  tradingName: "Northstar Supply",
  domain: "northstar-supply.example",
  phone: "+1-555-010-0140",
  synthetic: false,
  quote: {
    id: "quote-northstar-1",
    sku: "DDR5-ECC-64GB",
    payeeName: "Northstar Supply Cooperative",
    payeeAccountRef: "payee-northstar",
    unitPriceCents: 127_50,
    currency: "USD",
    availableQty: 20,
    leadTimeDays: 2,
  },
};

// One paid enrichment call backing TWO signals (receipt reuse) plus a second
// paid call — no real network, wallet, or Zero session.
const enrichmentCall: ZeroServiceCall = {
  provider: "FakeEnrich",
  serviceId: "fake.company.enrich",
  costCents: 10,
  observedAt: "2026-07-17T19:30:00.000Z",
  receiptId: "rcpt-enrich-1",
  signals: [
    { kind: "company_identity_match", value: true, outcome: "pass", detail: "Name and domain agree" },
    { kind: "payee_identity_match", value: true, outcome: "pass", detail: "Payee matches legal entity" },
  ],
};
const rdapCall: ZeroServiceCall = {
  provider: "FakeRDAP",
  serviceId: "fake.rdap.age",
  costCents: 5,
  observedAt: "2026-07-17T19:30:01.000Z",
  receiptId: "rcpt-rdap-1",
  signals: [
    { kind: "domain_age_days", value: 1840, outcome: "pass", detail: "Established domain" },
  ],
};

const fakeTransport = (calls: ZeroServiceCall[]): ZeroTransport => ({
  async gather() {
    return calls;
  },
});

test("buildEvidenceResponse reuses one receipt across signals from the same call", () => {
  const response = buildEvidenceResponse(vendor, [enrichmentCall, rdapCall]);
  assert.equal(response.vendorId, "vendor-northstar");
  assert.equal(response.signals.length, 3);
  const company = response.signals.find((s) => s.kind === "company_identity_match")!;
  const payee = response.signals.find((s) => s.kind === "payee_identity_match")!;
  assert.equal(company.source.receiptId, "rcpt-enrich-1");
  assert.equal(payee.source.receiptId, "rcpt-enrich-1"); // same paid call → reused receipt
  assert.equal(company.source.costCents, 10);
  for (const signal of response.signals) {
    assert.equal(signal.source.mode, "live_zero");
  }
});

test("buildEvidenceResponse rejects a paid call with no receipt", () => {
  const bad: ZeroServiceCall = { ...enrichmentCall, receiptId: undefined };
  assert.throws(() => buildEvidenceResponse(vendor, [bad]), /missing a receiptId/);
});

test("buildEvidenceResponse allows a free call with no receipt", () => {
  const free: ZeroServiceCall = {
    provider: "FakeFree",
    serviceId: "fake.free",
    costCents: 0,
    observedAt: "2026-07-17T19:30:02.000Z",
    signals: [{ kind: "web_presence", value: true, outcome: "pass", detail: "Footprint found" }],
  };
  const response = buildEvidenceResponse(vendor, [free]);
  assert.equal(response.signals[0].source.receiptId, undefined);
  assert.equal(response.signals[0].source.costCents, 0);
});

test("POST /v1/evidence returns normalized live_zero evidence with a transport", async () => {
  const reply = await handleEvidenceRequest(
    { method: "POST", path: "/v1/evidence", body: { vendor } },
    { transport: fakeTransport([enrichmentCall, rdapCall]) },
  );
  assert.equal(reply.status, 200);
  const body = reply.body as { vendorId: string; signals: unknown[] };
  assert.equal(body.vendorId, "vendor-northstar");
  assert.equal(body.signals.length, 3);
});

test("unkeyed runtime request returns 503 and never fixture-shaped evidence", async () => {
  const reply = await handleEvidenceRequest(
    { method: "POST", path: "/v1/evidence", body: { vendor } },
    { transport: null }, // no Zero session
  );
  assert.equal(reply.status, 503);
  assert.deepEqual(reply.body, { error: "Zero session not configured" });
  assert.ok(!(reply.body as Record<string, unknown>).signals);
});

test("createZeroTransport returns null without a Zero session key", () => {
  assert.equal(createZeroTransport({}), null);
  assert.equal(createZeroTransport({ ZERO_API_KEY: "   " }), null);
});

test("bearer token is enforced when configured", async () => {
  const deps = { transport: fakeTransport([rdapCall]), token: "secret-abc" };
  const denied = await handleEvidenceRequest(
    { method: "POST", path: "/v1/evidence", body: { vendor } },
    deps,
  );
  assert.equal(denied.status, 401);
  const ok = await handleEvidenceRequest(
    { method: "POST", path: "/v1/evidence", authorization: "Bearer secret-abc", body: { vendor } },
    deps,
  );
  assert.equal(ok.status, 200);
});

test("malformed vendor payload returns 400", async () => {
  const reply = await handleEvidenceRequest(
    { method: "POST", path: "/v1/evidence", body: { vendor: { id: "" } } },
    { transport: fakeTransport([]) },
  );
  assert.equal(reply.status, 400);
});

test("a failing Zero call surfaces as 502, not fabricated evidence", async () => {
  const throwing: ZeroTransport = {
    async gather() {
      throw new Error("settlement declined");
    },
  };
  const reply = await handleEvidenceRequest(
    { method: "POST", path: "/v1/evidence", body: { vendor } },
    { transport: throwing },
  );
  assert.equal(reply.status, 502);
  assert.match((reply.body as { error: string }).error, /settlement declined/);
});

test("GET /health reports whether a Zero session is configured", async () => {
  const off = await handleEvidenceRequest(
    { method: "GET", path: "/health", body: undefined },
    { transport: null },
  );
  assert.deepEqual(off.body, { ok: true, sessionConfigured: false });
  const on = await handleEvidenceRequest(
    { method: "GET", path: "/health", body: undefined },
    { transport: fakeTransport([]) },
  );
  assert.deepEqual(on.body, { ok: true, sessionConfigured: true });
});

test("unknown routes 404 and body guard rejects non-vendor payloads", async () => {
  const reply = await handleEvidenceRequest(
    { method: "GET", path: "/nope", body: undefined },
    { transport: null },
  );
  assert.equal(reply.status, 404);
  assert.equal(isEvidenceRequestBody({ vendor }), true);
  assert.equal(isEvidenceRequestBody({}), false);
});
