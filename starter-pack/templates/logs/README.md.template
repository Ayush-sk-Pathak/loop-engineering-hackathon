# logs/ — append-only evidence trails

> One JSON object per line. **Append-only, never edited, never deleted** — these are
> ground truth; the curated views (`docs/STRATEGY-LEDGER.md`,
> `docs/lessons_learned.md`) point INTO them. Absolute ISO dates.

## `DECISIONS.jsonl` — the why-trail

One entry per settled decision; ledger entries cite the `id`. Reversing a decision
requires a new entry whose `supersedes` names the old id — a silent reversal is drift.

```json
{"id": "0001", "date": "YYYY-MM-DD", "decision": "what we decided", "why": "the reasoning that would otherwise be re-derived", "rejected": ["alternative considered and killed — do not re-propose"], "supersedes": null}
```

## `errors.jsonl` — the incident evidence log

One entry per caught/fixed error (CLAUDE.md §"After any error" makes this automatic).
The evidence, not a narrative. A resolved entry points at the commit or rule that
killed the *class*, not just the instance.

```json
{"date": "YYYY-MM-DD", "error_type": "short-kebab-class", "symptom": "the observable failure, verbatim where possible", "root_cause": "the disease, in prose", "what_worked": "the fix", "what_didnt": ["dead-ends tried and rejected"], "fix_commit": "abc1234", "files": ["path/one.py"], "status": "fixed"}
```

When the same `error_type` recurs, promote it to a named disease in
`docs/lessons_learned.md` with a `*Prevention:*` rule.
