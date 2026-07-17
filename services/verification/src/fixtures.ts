import type { EvidenceSignal, VendorCandidate } from "@stockshield/contracts";

const observedAt = () => new Date().toISOString();
const source = (serviceId: string) => ({
  provider: "StockShield fixture",
  serviceId,
  mode: "fixture" as const,
  costCents: 0,
  observedAt: observedAt(),
});

export const DEMO_VENDORS: VendorCandidate[] = [
  {
    id: "vendor-lookalike",
    legalName: "Northstar Distributi0n LLC",
    tradingName: "Northstar Distribution",
    domain: "northstar-distribution.example",
    phone: "+1-555-010-0999",
    synthetic: true,
    quote: {
      id: "quote-lookalike-1",
      sku: "LAPTOP-14",
      unitPriceCents: 120_00,
      currency: "USD",
      availableQty: 20,
      leadTimeDays: 1,
    },
  },
  {
    id: "vendor-northstar",
    legalName: "Northstar Supply Cooperative",
    tradingName: "Northstar Supply",
    domain: "northstar-supply.example",
    phone: "+1-555-010-0140",
    synthetic: true,
    quote: {
      id: "quote-northstar-1",
      sku: "LAPTOP-14",
      unitPriceCents: 127_50,
      currency: "USD",
      availableQty: 20,
      leadTimeDays: 2,
    },
  },
];

export function fixtureEvidence(vendor: VendorCandidate): EvidenceSignal[] {
  if (vendor.id === "vendor-lookalike") {
    return [
      { kind: "company_identity_match", value: false, outcome: "fail", detail: "No matching company profile", source: source("fixture-company") },
      { kind: "domain_age_days", value: 14, outcome: "fail", detail: "Registered 14 days ago", source: source("fixture-rdap") },
      { kind: "web_presence", value: false, outcome: "fail", detail: "No corroborating footprint", source: source("fixture-web") },
      { kind: "news_presence", value: false, outcome: "warn", detail: "No established mentions", source: source("fixture-news") },
      { kind: "contact_reachable", value: false, outcome: "fail", detail: "Listed number unreachable", source: source("fixture-phone") },
      { kind: "bank_entity_match", value: false, outcome: "fail", detail: "Payee name differs from legal entity", source: source("fixture-payee") },
      { kind: "typosquat_detected", value: true, outcome: "fail", detail: "Lookalike spelling detected", source: source("fixture-domain") },
    ];
  }
  return [
    { kind: "company_identity_match", value: true, outcome: "pass", detail: "Company and domain agree", source: source("fixture-company") },
    { kind: "domain_age_days", value: 1840, outcome: "pass", detail: "Established domain history", source: source("fixture-rdap") },
    { kind: "web_presence", value: true, outcome: "pass", detail: "Consistent business footprint", source: source("fixture-web") },
    { kind: "news_presence", value: true, outcome: "pass", detail: "Independent trade mentions found", source: source("fixture-news") },
    { kind: "contact_reachable", value: true, outcome: "pass", detail: "Published contact channel responded", source: source("fixture-phone") },
    { kind: "bank_entity_match", value: true, outcome: "pass", detail: "Payee and legal entity agree", source: source("fixture-payee") },
    { kind: "typosquat_detected", value: false, outcome: "pass", detail: "No lookalike domain pattern", source: source("fixture-domain") },
  ];
}
