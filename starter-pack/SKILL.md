---
name: starter-pack
description: |
  Scaffold the full anti-drift doc system into a project: CLAUDE.md constitution
  (Karpathy's four rules verbatim), user-approved immutable vision.md, START-HERE.md,
  docs/ (PROJECT_STATUS, CURRENT_STATE, ROADMAP, architecture, STRATEGY-LEDGER,
  lessons_learned), append-only logs/ (DECISIONS.jsonl + errors.jsonl), a SessionStart
  hook that injects the strategy ledger every session, and enforcement below the agent
  (chmod 444 + pre-commit via scripts/bootstrap.sh). Works on brand-new projects (full
  scaffold) AND existing repos (gap analysis — adds only what's missing, never
  overwrites). Use when asked to "set up a new agent project", "scaffold the doc
  system", "starter pack", "starting stack", or "bootstrap my claude setup".
  PROACTIVE TRIGGER: suggest this when starting substantive work in a repo that has
  no CLAUDE.md. This skill CREATES the doc system; day-to-day upkeep follows the
  standing protocols the scaffolded CLAUDE.md itself defines.
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - AskUserQuestion
---

# starter-pack — scaffold the anti-drift doc system

You are laying down a doc system whose whole point is preventing agent drift across
long, multi-session projects. Its design (why each piece exists) is in
`references/anti-drift-playbook.md` next to this file — skim it if unsure why a step
matters. The templates live in `templates/` next to this file; resolve that directory
from this SKILL.md's own path.

The system's layers: **intent** (`vision.md`, user-only) → **laws** (`CLAUDE.md`) →
**design** (`docs/architecture.md`) → **decisions** (`docs/STRATEGY-LEDGER.md`,
injected every session by a hook) → **past** (`docs/CURRENT_STATE.md`) / **future**
(`docs/ROADMAP.md`) → **evidence** (`logs/*.jsonl`, append-only). The immutable layer
is enforced *below* the agent: chmod 444 + a pre-commit hook.

## 1. Detect project state

- Target = the current working directory unless the user names another.
- `git rev-parse --is-inside-work-tree` — if not a repo, ask whether to `git init`
  (a repo is required: the enforcement layer is a git hook).
- Glob for the pieces: `CLAUDE.md`, `vision.md`, `START-HERE.md`,
  `docs/{PROJECT_STATUS,CURRENT_STATE,ROADMAP,architecture,STRATEGY-LEDGER,lessons_learned}.md`
  (case-insensitively — accept existing variants like `docs/VISION.md` or `ROADMAP.md`
  at root as satisfying the slot), `logs/*.jsonl`, `.claude/settings.json`,
  `scripts/githooks/pre-commit`.
- **New project** (nothing exists): full scaffold, steps 2–6.
- **Retrofit** (some pieces exist): present the gap table (exists / missing / partial)
  and scaffold ONLY the missing pieces. **Never overwrite or edit an existing doc** —
  if an existing doc lacks a convention (e.g. a CURRENT_STATE with no append-only rule
  block), report the gap and let the user decide; don't "fix" it. An existing
  `.claude/settings.json` gets the SessionStart hook **merged in** (read it, add only
  the missing hook entry, keep everything else byte-identical).

## 2. Interview the user

Gather via AskUserQuestion + free text:

1. **Project name + one-liner** (what is this?).
2. **The vision — in the user's own words.** Ask them to write/dictate it. You may
   propose refinements for clarity, but the text that lands in `vision.md` requires
   the user's **explicit line-by-line approval**: show the exact final text and get a
   yes before writing. **HARD GATE — never write vision.md content the user has not
   approved verbatim.** If the user wants to defer, write the file with a
   `<!-- TODO: user vision pending — this file is a placeholder; run /starter-pack
   again or edit deliberately -->` body and SKIP protecting it in step 4 (a
   placeholder must stay editable).
3. **Stack** (languages/frameworks/services — one line is fine).
4. **Branch model**: a dev/stable pair (recommended for multi-agent work — e.g. all
   work on `dev`, fast-forward `main` only after validation) or single-branch. Record
   the answer as prose for the `{{BRANCH_MODEL}}` slot.

## 3. Stamp the templates

For each missing piece, copy the corresponding file from `templates/`, filling
placeholders: `{{PROJECT_NAME}}`, `{{PROJECT_ONE_LINER}}`, `{{DATE}}` (today, ISO
`YYYY-MM-DD`), `{{VISION_TEXT}}` (the approved verbatim text), `{{STACK}}`,
`{{BRANCH_MODEL}}`. Mapping:

| Template | Destination |
|---|---|
| `CLAUDE.md.template` | `CLAUDE.md` |
| `vision.md.template` | `vision.md` |
| `START-HERE.md.template` | `START-HERE.md` |
| `docs/*.template` | `docs/<same name>` |
| `logs/README.md.template` | `logs/README.md` |
| `claude/settings.json.template` | `.claude/settings.json` (merge if exists) |
| `scripts/bootstrap.sh` | `scripts/bootstrap.sh` (chmod +x) |
| `scripts/githooks/pre-commit` | `scripts/githooks/pre-commit` (chmod +x) |

Rules:
- The Karpathy four rules in `CLAUDE.md.template` are **verbatim — never paraphrase,
  reorder, or trim them.**
- Seed `logs/DECISIONS.jsonl` with entry `0001` (one line, schema in
  `logs/README.md`): the adoption of this doc system — it gives the ledger its first
  citable id. Create `logs/errors.jsonl` empty.
- If the repo has no `.gitignore`, seed one with at least `.env*` and
  `.claude/settings.local.json`.

## 4. Wire the enforcement + initial commit (ORDER MATTERS)

1. Stage the scaffold by name (`git add CLAUDE.md vision.md START-HERE.md docs/...
   logs/... .claude/settings.json scripts/...` — never `git add -A`; other work may
   be in flight).
2. Commit **before** running bootstrap (the hook isn't active yet, so the scaffold's
   own commit isn't rejected): `chore: scaffold starter-pack doc system`. Commit on
   the project's dev branch per the chosen branch model; if the repo is on
   `main`/`master` and the model has a dev branch, create and switch to it first.
   **Never push.**
3. `bash scripts/bootstrap.sh` — sets `core.hooksPath = scripts/githooks` and
   chmod 444 on `vision.md`, `CLAUDE.md`, `docs/architecture.md`. (chmod doesn't
   dirty git — only the exec bit is tracked.) Skip the 444 on any placeholder
   vision.md (step 2.2).
4. Verify, don't assume: `git config core.hooksPath` prints `scripts/githooks`;
   `ls -l vision.md` shows `-r--r--r--`. Then prove the hook bites with a live
   round-trip: `chmod u+w vision.md`, append a scratch character,
   `git add vision.md`, `git commit -m test` → must **REJECT**; then undo cleanly:
   `git restore --staged vision.md && git checkout -- vision.md && chmod 444 vision.md`.
   In retrofit mode on a repo with existing history, ask before running this live test.

## 5. Retrofit-specific care

- A repo with an existing `core.hooksPath` or an active `.git/hooks/pre-commit`: do
  NOT clobber it. Report what exists; offer to append the protected-paths checks into
  the existing hook instead (show the diff before applying).
- Existing docs that fill a slot under a different name (e.g. `docs/VISION.md`)
  satisfy the slot — record the actual path in the stamped CLAUDE.md doc-map table
  rather than creating a duplicate.
- If the repo already has a CLAUDE.md, do not touch it; instead output a short
  "recommended additions" note (doc-map table, error-logging protocol, enforcement
  section) for the user to merge deliberately.

## 6. Report and hand off

End with:
- A table of every piece: created / merged / already existed (skipped) / deliberately
  skipped, with paths.
- The verification results from step 4 (hook rejects, 444 set, hooksPath set).
- The maintenance loop, briefly: the scaffolded CLAUDE.md's standing protocols keep
  the docs current (same-commit cadence — sweep them before every session end or
  context compact); ledger entries get added as decisions settle (with "Rejected, do
  not re-propose"); errors append to `logs/errors.jsonl` automatically per CLAUDE.md;
  vision.md changes = user approval + `chmod u+w` + `git commit --no-verify` +
  re-run `scripts/bootstrap.sh`.
- Remind: the SessionStart ledger injection takes effect from the NEXT session.

## Guardrails (hard rules)

- **Never write vision.md content the user hasn't approved line by line.** Verbatim
  means verbatim.
- **Never overwrite or rewrite an existing doc** — retrofit adds, reports gaps, and
  merges only into `.claude/settings.json` (additively).
- **Never push.** Never commit to `main`/`master` when the branch model has a dev
  branch.
- Stage by name, never `git add -A`.
- Don't manufacture content for the empty slots (architecture thesis, roadmap
  milestones) beyond the template placeholders — those get filled by real work, not
  by the scaffold.
