import assert from "node:assert/strict";
import test from "node:test";
import type { VendorCandidate } from "@continuim/contracts";
import { buildEvidenceResponse } from "./adapter.ts";
import { mapDomainAge, mapEnrichment, mapNewsPresence, mapWebPresence } from "./signals.ts";
import {
  CANDIDATE_SERVICES,
  LiveZeroTransport,
  type ZeroClient,
  type ZeroRunResult,
  type ZeroServiceRef,
} from "./transport.ts";

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

// --- pure mappers ---

test("mapEnrichment corroborates a matching company and derives payee identity", () => {
  const drafts = mapEnrichment(
    { name: "Northstar Supply Cooperative", domain: "northstar-supply.example" },
    vendor,
  );
  assert.equal(drafts.length, 2);
  const company = drafts.find((d) => d.kind === "company_identity_match")!;
  const payee = drafts.find((d) => d.kind === "payee_identity_match")!;
  assert.equal(company.value, true);
  assert.equal(company.outcome, "pass");
  assert.equal(payee.value, true);
});

test("mapEnrichment fails company and payee when the record does not corroborate", () => {
  const drafts = mapEnrichment({ name: "Totally Different Ltd", domain: "elsewhere.example" }, vendor);
  const company = drafts.find((d) => d.kind === "company_identity_match")!;
  const payee = drafts.find((d) => d.kind === "payee_identity_match")!;
  assert.equal(company.value, false);
  assert.equal(company.outcome, "fail");
  assert.equal(payee.value, false); // quoted payee ≠ the (different) enriched entity
});

test("mapDomainAge computes age from an RDAP registration event", () => {
  const now = new Date("2026-07-17T00:00:00.000Z");
  const drafts = mapDomainAge(
    { events: [{ eventAction: "registration", eventDate: "2019-01-01T00:00:00.000Z" }] },
    now,
  );
  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].kind, "domain_age_days");
  assert.ok((drafts[0].value as number) > 2000);
  assert.equal(drafts[0].outcome, "pass");
});

test("mapDomainAge flags a young domain and omits (never invents) when no date is present", () => {
  const now = new Date("2026-07-17T00:00:00.000Z");
  const young = mapDomainAge({ registrationDate: "2026-07-07T00:00:00.000Z" }, now);
  assert.equal(young[0].value, 10);
  assert.equal(young[0].outcome, "fail");
  assert.deepEqual(mapDomainAge({ available: false }, now), []);
});

test("mapWebPresence and mapNewsPresence read scrape and news payloads", () => {
  assert.equal(mapWebPresence({ markdown: "# Northstar Supply\nWholesale memory." })[0].value, true);
  assert.equal(mapWebPresence({})[0].value, false);
  assert.equal(mapNewsPresence({ news: [{ title: "Northstar expands" }] })[0].outcome, "pass");
  assert.equal(mapNewsPresence({ news: [] })[0].outcome, "warn");
});

// --- gather orchestration with a fake ZeroClient (no CLI, wallet, or network) ---

function fakeClient(bodies: Record<string, unknown>): ZeroClient {
  return {
    async run(service: ZeroServiceRef): Promise<ZeroRunResult> {
      return { runId: `run-${service.serviceId}`, costCents: 2, body: bodies[service.serviceId] ?? {} };
    },
  };
}

const liveBodies: Record<string, unknown> = {
  [CANDIDATE_SERVICES.enrichment.serviceId]: { domain: "northstar-supply.example" },
  [CANDIDATE_SERVICES.domain.serviceId]: {
    events: [{ eventAction: "registration", eventDate: "2019-01-01T00:00:00.000Z" }],
  },
  [CANDIDATE_SERVICES.web.serviceId]: { text: "Northstar Supply" },
};

test("gather runs the candidate services and reuses one receipt for company+payee", async () => {
  const transport = new LiveZeroTransport(fakeClient(liveBodies));
  const { signals } = buildEvidenceResponse(vendor, await transport.gather(vendor));
  const kinds = signals.map((s) => s.kind).sort();
  assert.deepEqual(kinds, [
    "company_identity_match",
    "domain_age_days",
    "payee_identity_match",
    "web_presence",
  ]);
  const company = signals.find((s) => s.kind === "company_identity_match")!;
  const payee = signals.find((s) => s.kind === "payee_identity_match")!;
  assert.equal(company.source.receiptId, `run-${CANDIDATE_SERVICES.enrichment.serviceId}`);
  assert.equal(payee.source.receiptId, company.source.receiptId); // one paid call → shared receipt
  for (const signal of signals) assert.equal(signal.source.mode, "live_zero");
});

test("gather throws (never fabricates) when the domain service returns no registration date", async () => {
  const bodies = { ...liveBodies, [CANDIDATE_SERVICES.domain.serviceId]: { available: false } };
  const transport = new LiveZeroTransport(fakeClient(bodies));
  await assert.rejects(transport.gather(vendor), /no registration date/);
});
