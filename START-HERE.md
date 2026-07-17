# START HERE — session reading order for StockShield

> Every session (human or AI) starts here. Read in this order — each layer grounds
> the next. The strategy ledger is also injected automatically at session start by
> the hook in `.claude/settings.json`.

**Building today?** Read `docs/PRD.md` end to end first — it is the full plan (hackathon
context, requirements, architecture, the 3-minute demo, and who owns what). Then find
your workstream in `docs/PRD.md §10`.

1. **`vision.md`** — the north star (intent; user-authored, approval-locked) —
   and **`CLAUDE.md`** — the laws (behavioral rules + standing protocols).
2. **`docs/PRD.md`** — the plan of record — and **`docs/architecture.md`** — the
   blueprint (design).
3. **`docs/STRATEGY-LEDGER.md`** — settled decisions, rejected options, the honest
   envelope — and **`docs/ROADMAP.md`** — the current front and what's next.
4. **`docs/PROJECT_STATUS.md`** — the 30-second snapshot — then the tail of
   **`docs/CURRENT_STATE.md`** — the most recent session entries (the detail).

Evidence trails when you need them: `logs/DECISIONS.jsonl` (why-trail),
`logs/errors.jsonl` (incidents), `docs/lessons_learned.md` (prevention rules —
read before repeating any past class of work).
