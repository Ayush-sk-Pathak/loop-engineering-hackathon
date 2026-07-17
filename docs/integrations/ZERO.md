# Zero.xyz Integration

**Owner:** Zero Verification. **Status:** core three-service live bundle settled and locked on
2026-07-17; optional news/contact services remain cut.

## Gate Before Coding

1. Discover candidate services from the live Zero surface.
2. Make one paid call for each candidate using the funded demo wallet.
3. Record exact service ID, provider, price, input shape, output shape, receipt ID, observed
   latency, and fallback in `config/zero-services.json`.
4. Only then set `verifiedAt` and `VERIFICATION_MODE=live_zero`.

The public catalog currently shows plausible company enrichment, web extraction, search/news,
phone, LLM, and StableEmail services. That proves availability candidates, not that the exact
bundle works with the team's wallet today.

## Settled Core Services (catalog re-verified and paid 2026-07-17)

Re-checked against the live Zero surface on 2026-07-17. Exact service IDs, capability
coordinates, prices, and run receipts are recorded in `config/zero-services.json`.

| EvidenceKind | Candidate Zero service | Listed price | Notes |
|---|---|---|---|
| `company_identity_match` | **Riley Craig x402 Agent Store — Company Domain Lookup** | $0.01/call settled | Domain enrichment returns age, registrar, email/website presence, and company summary; payee identity is derived from the quoted legal name. |
| `payee_identity_match` | *Derived from the company-enrichment call* — **no bank/payee-verification service exists in the catalog** | — (reuses the enrichment receipt) | Compare quote `payeeName` vs the enriched legal entity. One paid enrichment call backs both this and `company_identity_match` → shared `receiptId`. |
| `domain_age_days` | **WHOIS Lookup (RDAP)** | $0.001/call settled | Returns `createdDate`; adapter maps it to age in days. |
| `web_presence` | **J-sey Data API — Web Scrape Endpoint** | $0.002/call settled | Returns page text for a live web-presence signal. |
| `news_presence` | **Serper Google News Search** (alt: Exa Search API) | $0.04/call (Exa $0.007) | Independent trade/news mentions of the vendor. |
| `contact_reachable` | **StablePhone AI Call** + **StablePhone Call Status & Transcript** | $0.54/call + free | ⚠ Cost + consent/latency risk; A8 is an explicit go/no-go, default no-go. Off the core evidence path. |
| `typosquat_detected` | *Computed locally* (lookalike / edit-distance vs known-supplier domains) — **no brand-abuse/typosquat service exists in the catalog** | — | Optionally corroborated by a young `domain_age_days` + failed `company_identity_match`. |

**Required-signal coverage** (`REQUIRED_SIGNALS` in `services/verification/src/policy.ts`:
`company_identity_match`, `domain_age_days`, `web_presence`, `payee_identity_match`,
`typosquat_detected`): all five are reachable — three via paid Zero services (enrichment,
RDAP, scrape), two derived (payee from the enrichment call, typosquat computed).
`news_presence` and `contact_reachable` are non-required extras.

**Evidence-spend estimate** (Stage-Proof ratio): the settled core bundle is $0.013 for the
three calls,
excluding A8-gated StablePhone ($0.54). Against the datacenter PO value (20 × $127.50 =
$25,500) that is well under 0.001% of governed value.

## Invocation model (verified 2026-07-17)

Zero exposes **no direct REST endpoint**; paid services are invoked through the `zero` CLI:
`zero fetch <capabilityUrl> --capability <token> -d '<inputJson>' --json --max-pay <usdc>`,
which returns `{ runId, ok, status, latencyMs, payment, body }`. `runId` anchors the
settlement receipt (`zero review <runId>`), `payment` carries the cost, `body` is the service
output. Auth is a wallet: `ZERO_PRIVATE_KEY` (or a `zero auth login` session).

`services/zero-adapter` implements this in `CliZeroClient` (real runs) behind an injectable
`ZeroClient` seam that unit tests fake, so A4 is run-and-record, not write-integration.
Per-service `capabilityUrl`/`capabilityToken` (from `zero get <serviceId>`) and the
`payment`->cents parsing are settled in A4.

**Credential (settled 2026-07-17):** the adapter gates live mode on `ZERO_PRIVATE_KEY` — the
wallet the `zero` CLI consumes (or a `zero auth login` session). `config/example.env` uses
`ZERO_PRIVATE_KEY` (commit 192724f, supersedes the provisional `ZERO_API_KEY`). Absent ⇒ the
adapter answers 503, never fabricated evidence.

### A4 settle checklist (mechanical — keep it run-and-record)

For each core service (enrichment, RDAP, web):
1. `zero get <serviceId>` → copy its `capabilityUrl` + capability token into
   `services/zero-adapter` `CANDIDATE_SERVICES` and `config/zero-services.json`.
2. Make one live `zero fetch … --json` call; capture the `body` shape and confirm the mapper
   in `src/signals.ts` reads it (esp. the RDAP registration date and enrichment name/domain).
3. Record `runId` (receipt), price (`payment` → cents), and observed latency in
   `config/zero-services.json`; set `verifiedAt` only after ≥3 services settle.
4. `npm run check`, then a live e2e with `VERIFICATION_MODE=live_zero`.

## Adapter Contract

Set `ZERO_EVIDENCE_ADAPTER_URL` to Owner 2's small HTTP adapter. Continuim sends:

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
