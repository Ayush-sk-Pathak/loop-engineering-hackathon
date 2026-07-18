# Continuim Lessons Learned

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

## The Half-Renamed Repo (2026-07-17)

A repo-wide rename (StockShield→Continuim, decision 0016) produced two same-class
incidents in one hour: `merge-sweep-committed-stale-index` (the reconciliation sweep
edited the working tree during a merge but was never staged, so the merge commit kept
old-name files) and `rename-sweep-merge-race` (work merged in the rename window carried
old-name imports). Both looked green for a while because **two layers of stale state
lie**: working-tree greps pass while the commit differs, and warm `node_modules`
symlinks resolve names that a clean install 404s on.

*Prevention:* a rename or sweep is complete only when verified at the **commit** level —
`git grep <old-name> HEAD` — and by a **clean `npm install`** (fresh relink), never by
working-tree grep or an already-warm tree. During a merge, every sweep edit must be
`git add`-ed before `git commit`; verify the index, not the working tree. A repo-wide
rename should land as one commit covering every workspace member plus the lockfile.

## The Green Verifier, Wrong Config (2026-07-17)

The live demo failed while every check was green. `.env` had been left at
`VERIFICATION_MODE=live_zero` (no Zero session exists on the machine), so every real run
died fail-closed at `verifying` — but `demo:verify` kept passing because it launches its
services with its own pinned env (`VERIFICATION_MODE=fixture`), and `doctor:prize` only
checks that vars are *set*, not that the services they point at *respond*. Same family as
the Half-Renamed Repo: the verifier exercised a different state than the one that ships.
Evidence: `errors.jsonl` `stale-live-mode-env`.

*Prevention:* before any run that matters (demo, recording, deploy), execute one
end-to-end run **under the exact runtime config** — the real `.env`, the real entrypoint —
not just the self-contained verifier. A verifier that pins its own env proves the code
path, never the configuration. After any live/prize event, sweep `.env` back to a mode the
machine can actually satisfy.
