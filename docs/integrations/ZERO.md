# Zero.xyz Integration

**Owner:** Zero Verification. **Status:** adapter contract implemented; live services not yet
settled or locked.

## Gate Before Coding

1. Discover candidate services from the live Zero surface.
2. Make one paid call for each candidate using the funded demo wallet.
3. Record exact service ID, provider, price, input shape, output shape, receipt ID, observed
   latency, and fallback in `config/zero-services.json`.
4. Only then set `verifiedAt` and `VERIFICATION_MODE=live_zero`.

The public catalog currently shows plausible company enrichment, web extraction, search/news,
phone, LLM, and StableEmail services. That proves availability candidates, not that the exact
bundle works with the team's wallet today.

## Candidate Live Services (catalog re-verified 2026-07-17 — candidates, NOT settled)

Re-checked against the live `zero.xyz/browse` surface on 2026-07-17 (CLAUDE.md decision 3).
These are **candidates only** — `config/zero-services.json` `verifiedAt` stays `null` until
item A4 settles one live paid call per service and records the real service ID, price, and
receipt. Prices below are the catalog's listed per-call rates, not settled figures.

| EvidenceKind | Candidate Zero service | Listed price | Notes |
|---|---|---|---|
| `company_identity_match` | **Wiza Company Enrichment API** (alt: PDL Company Enrich) | $0.02/call (PDL $0.10) | Enrich by name/domain → firmographics; corroborate legal name ↔ domain. |
| `payee_identity_match` | *Derived from the company-enrichment call* — **no bank/payee-verification service exists in the catalog** | — (reuses the enrichment receipt) | Compare quote `payeeName` vs the enriched legal entity. One paid enrichment call backs both this and `company_identity_match` → shared `receiptId`. |
| `domain_age_days` | **Domain Availability Checker (RDAP)** | $0.001/call | ⚠ Listed as an availability checker; A4 must confirm its RDAP response surfaces the registration/creation date (age), not just availability. Required WHOIS/domain-age candidate; A6 wires it as the named service. |
| `web_presence` | **Firecrawl Scrape via StableEnrich** (alt: Exa Search API) | $0.0126/call (Exa $0.007) | Fetch the vendor domain / find a corroborating footprint. |
| `news_presence` | **Serper Google News Search** (alt: Exa Search API) | $0.04/call (Exa $0.007) | Independent trade/news mentions of the vendor. |
| `contact_reachable` | **StablePhone AI Call** + **StablePhone Call Status & Transcript** | $0.54/call + free | ⚠ Cost + consent/latency risk; A8 is an explicit go/no-go, default no-go. Off the core evidence path. |
| `typosquat_detected` | *Computed locally* (lookalike / edit-distance vs known-supplier domains) — **no brand-abuse/typosquat service exists in the catalog** | — | Optionally corroborated by a young `domain_age_days` + failed `company_identity_match`. |

**Required-signal coverage** (`REQUIRED_SIGNALS` in `services/verification/src/policy.ts`:
`company_identity_match`, `domain_age_days`, `web_presence`, `payee_identity_match`,
`typosquat_detected`): all five are reachable — three via paid Zero services (enrichment,
RDAP, scrape), two derived (payee from the enrichment call, typosquat computed).
`news_presence` and `contact_reachable` are non-required extras.

**Evidence-spend estimate** (Stage-Proof ratio): a full required bundle ≈ Wiza $0.02 +
RDAP $0.001 + Firecrawl $0.0126 ≈ **~$0.03–0.13/vendor** (PDL raises the enrichment leg),
excluding A8-gated StablePhone ($0.54). Against the datacenter PO value (20 × $127.50 =
$25,500) that is well under 0.001% of governed value.

## Adapter Contract

Set `ZERO_EVIDENCE_ADAPTER_URL` to Owner 2's small HTTP adapter. StockShield sends:

```json
{
  "vendor": {
    "id": "vendor-northstar",
    "legalName": "Northstar Supply Cooperative",
    "domain": "northstar-supply.example",
    "quote": {}
  }
}
```

The adapter returns normalized evidence:

```json
{
  "vendorId": "vendor-northstar",
  "signals": [
    {
      "kind": "company_identity_match",
      "value": true,
      "outcome": "pass",
      "detail": "Company name and domain agree across sources",
      "source": {
        "provider": "exact-provider-name",
        "serviceId": "exact-zero-service-id",
        "mode": "live_zero",
        "costCents": 10,
        "observedAt": "2026-07-17T19:30:00.000Z",
        "receiptId": "real-settlement-or-provider-receipt"
      }
    }
  ]
}
```

The control plane rejects mismatched vendor IDs, non-live modes, malformed evidence, and paid
signals without receipts. If one paid call supports multiple signals, reuse its `receiptId`;
the policy deduplicates cost by receipt.

## Policy Guidance

- Company identity, payee identity, and typosquat results are stronger than missing news.
- An LLM may normalize or explain evidence but is not an independent evidence source.
- A missing required class yields `insufficient_evidence`, not `eligible`.
- Domain age, sparse footprint, or an unanswered call alone do not prove fraud.

## Stage Proof

Keep the Zero wallet balance, exact service names, per-call price, and receipt IDs visible.
The useful ratio is evidence spend versus governed PO value. Do not describe a direct paid API
call as Zero usage unless Zero actually discovered/activated and settled it.
