# CLAUDE.md — the StockShield Constitution

> Standing instructions for every Claude Code session in this repository.
>
> **Start here:** `vision.md` (the north star) →
> `docs/PROJECT_STATUS.md` (30-second orientation) → `START-HERE.md`
> (the full session reading order). The full plan lives in `docs/PRD.md`.

**Project:** StockShield — a policy-enforced autonomous procurement agent that buys current vendor evidence before receiving a vendor-scoped capability to issue a purchase order.

**Stack:** TypeScript/Node (agent core + procurement API), Next.js/React (storefront + ops dashboard), Anthropic Claude via the Claude Agent SDK (planning/explanation), Zero.xyz (paid evidence + StableEmail), Pomerium (vendor-scoped machine-identity gate), Nexla FlexFlow (real-time inventory stream -> stockout trigger), SQLite (state + replay protection), Docker on Akash (hosting).

---

## The doc system (what lives where)

Docs are split by *what drifts*: intent, laws, decisions, past, future, design, evidence.
Never blend them; never delete — supersede. Absolute ISO dates and commit hashes always,
never "recently".

| Doc | Role | Update rule |
|---|---|---|
| `vision.md` | **Intent** — north star and product boundary | Change only with explicit product-direction approval. |
| `CLAUDE.md` (this file) | **Laws** — behavioral rules + standing protocols | Rare and deliberate. |
| `docs/PRD.md` | **The plan** — hackathon context, requirements, architecture, demo, team split | The single source of truth for what we're building and why. Update deliberately as scope settles. |
| `docs/architecture.md` | **Design** — the blueprint of record | Deliberate; protected like CLAUDE.md. |
| `docs/STRATEGY-LEDGER.md` | **Decisions & invariants** — settled calls, rejected options, honest envelope | Update as decisions settle; **never silently reverse — log a supersede to `logs/DECISIONS.jsonl` first.** Injected every session by the SessionStart hook. |
| `docs/PROJECT_STATUS.md` | **Snapshot** — ≤25 bullets, 30-second orientation | Replace-in-place, only when a summary-level fact changes. Never a substitute for a CURRENT_STATE entry. |
| `docs/CURRENT_STATE.md` | **Past** — append-only dated session log | Append newest at the bottom; every claim carries a source (commit hash, file path, or measured result). |
| `docs/ROADMAP.md` | **Future** — checkboxes | Tick `[x]` in the **same commit** that CURRENT_STATE logs the item done; done items carry `(commit, YYYY-MM-DD)`. Never delete shipped items. |
| `docs/lessons_learned.md` | **Prevention** — named diseases + the rule that stops the class | Curated; promote from `logs/errors.jsonl` when a disease repeats. |
| `logs/DECISIONS.jsonl` | **Why-trail** — decision records the ledger cites | Append-only, never edited. Schema in `logs/README.md`. |
| `logs/errors.jsonl` | **Evidence** — raw error/incident log | Append-only, never edited. Schema in `logs/README.md`. |

---

## Behavioral principles

Adapted verbatim from Andrej Karpathy's published guidelines for reducing common LLM
coding mistakes ([multica-ai/andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills/blob/main/CLAUDE.md)).
**Tradeoff:** these bias toward caution over speed. For trivial tasks
(typos, one-line fixes), use judgment. For anything that ships, validates, or changes
shared state — follow them.

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

**Anti-pattern to avoid:** jumping to a diagnosis without checking the data. When
something fails and the data is available (logs, DB rows, file contents), READ THE DATA
FIRST. Hypotheses without data are guesses.

*Anchor:* <!-- fill with a real incident from this project when one happens -->

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

*Anchor:* <!-- fill with a real incident from this project when one happens -->

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: every changed line should trace directly to the user's request.

*Anchor:* <!-- fill with a real incident from this project when one happens -->

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work")
require constant clarification.

*Anchor:* <!-- fill with a real incident from this project when one happens -->

---

## Standing protocols

### Hackathon reality (2026-07-17 — submission 4:30 PM)

This is a ~5.5-hour sprint. When these principles collide with the clock, the tiebreaker
is: **a smaller thing that runs and demos beats a bigger thing that doesn't.** Every
feature must be reachable from the 3-minute demo script in `docs/PRD.md §14`. If it isn't
on that script, it isn't in scope today.

### Documentation cadence (same-commit, never batched)

Update `docs/CURRENT_STATE.md` after any major change, before the session ends, or
before a context compact — whichever comes earliest. The entry rides in the **same
commit** as the change. When CURRENT_STATE logs an item done, tick its ROADMAP box **in
the same commit**. Multiple owners hand off through these docs; an undocumented change is
invisible to every other owner.

### After any error is caught or fixed (AUTOMATIC — do this every time)

1. Append one entry to `logs/errors.jsonl` (schema: `logs/README.md`) — the evidence,
   not a narrative: symptom, root cause, what worked, **what didn't**, fix commit.
2. If the same *class* of error has appeared before, promote it: add or extend a named
   disease in `docs/lessons_learned.md` with a `*Prevention:*` rule.

### Decisions

When a call is settled that a fresh session might re-open or silently contradict:
append a record to `logs/DECISIONS.jsonl`, then add/update the numbered entry in
`docs/STRATEGY-LEDGER.md` — including **what was rejected ("do not re-propose")** and
why. Reversing a ledger decision requires an explicit supersede entry first.

### Memory & recalled facts

A recalled memory or doc claim that names a file, function, or flag reflects what was
true when written — **verify it against the repo before acting on it.** In particular:
**re-verify Zero.xyz's live tool catalog at `zero.xyz/browse` before relying on any tool**
— the catalog is dynamic and the whole build depends on which tools actually exist
(see `docs/STRATEGY-LEDGER.md` decision 3).

### Branch model

`main` is the **single long-lived branch** (demo-stable). Each owner works on a
short-lived `feat/<area>` branch and merges to `main` only after `npm run check` is
green; feature branches are deleted after merge. There is no standing `dev` branch.
Never force-push `main`. The full workflow is in `CONTRIBUTING.md`.

---

## Enforcement lives below the harness

`npm run setup` installs `scripts/githooks/pre-commit`. The hook rejects runtime environment
files and recognizable private credentials, then runs `npm run check`. It does not make
shared documentation read-only; a team must be able to keep design and status synchronized.

---

**Scaffolded by `/starter-pack` on 2026-07-17.**
