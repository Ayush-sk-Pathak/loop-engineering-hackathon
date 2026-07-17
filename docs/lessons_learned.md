# StockShield Lessons Learned

> A **prevention doc, not a bug changelog.** Each lesson is a named disease — the
> class of mistake — with the rule that now prevents the whole class. Read the
> relevant diseases **before** repeating any past class of work. Raw incident
> evidence lives in `logs/errors.jsonl` (append-only; schema in `logs/README.md`);
> when a disease repeats there, promote it to a named entry here and cross-link the
> `docs/STRATEGY-LEDGER.md` decision it produced.

## The meta-lesson: read, don't guess

1. When something fails and the data is available (logs, DB rows, file contents,
   DOM), read the data before forming a hypothesis.
2. Reproduce with real inputs before declaring a fix.
3. A fix isn't done until something (a test, a check) fails if the disease returns.
4. Record what **didn't** work alongside what did — dead-ends re-tried are the most
   expensive kind of drift.

## The failure-modes to design against (the diseases)

**1. Assuming a tool exists because the pitch needs it.** The original Concepts A/B/C
   all assumed Zero.xyz brokered a data source (supplier registry / credit bureau /
   freight index) that a deep-research pass proved does not exist. A whole concept was
   built on an unverified capability.
   *Prevention:* before any integration, verify the capability against the vendor's live
   surface (`zero.xyz/browse`, the plugin repo, the actual API) — not the marketing page,
   not memory. For Zero specifically, re-verify **on the day**; the catalog is dynamic.
   (Cross-link: `STRATEGY-LEDGER` decision 3.)

**2. Faking the one thing the judges scrutinize.** The tempting shortcut — mock a
   "verification vendor" and call it through Zero — fakes exactly the moment the Zero
   prize is judged on, and it guts a pitch whose whole premise is being the *honest* trust
   layer.
   *Prevention:* the load-bearing demo beat must use the real tool. If the specific tool is
   missing, swap to another *real* tool of the same platform — never a mock. (Cross-link:
   `STRATEGY-LEDGER` decision 3; `architecture.md §Invariants`.)

**3. Confusing caller identity with request-object identity.** The agent is the HTTP caller;
   the selected vendor is data in the request. A shared agent token therefore cannot make a
   vendor-specific authorization decision.
   *Prevention:* use a vendor-scoped machine identity at Pomerium and independently bind the
   signed vendor attestation to every mutable PO field at the origin.

**4. Returning idempotent state before authorization.** An early idempotency lookup can
   disclose or return a prior protected result to an unauthenticated retry.
   *Prevention:* authorize every request before idempotency lookup, fingerprint the complete
   request, and consume the authorization nonce once.

**5. Treating a mode label as an integration.** Setting `source: nexla` or displaying a
   sponsor name does not prove traffic crossed that sponsor's system.
   *Prevention:* every live mode has an external artifact: a Zero receipt, Pomerium authorize
   log, Nexla event ID, StableEmail message ID, or Akash lease.

## Incident index (evidence → where fixed → guarded by)

| # | Principle | Concrete incident | Fix location | Test |
|---|-----------|-------------------|--------------|------|
