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
