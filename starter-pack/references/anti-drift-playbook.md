# Keeping the North Star Grounded — an anti-drift playbook

> **Status:** Reference / methodology · **Source:** distilled from the anti-drift work of a
> real, long-lived AI-agent project · **Audience:** this starter-pack scaffold, or any repo
> where an AI agent does multi-session work against a fixed goal.
>
> This is the "why" behind every file the starter pack lays down. The worked examples are
> anonymized but real.

---

## 0. The one-sentence thesis

**A north-star document captures *intent*; drift happens in the *decisions and invariants* made
while pursuing it.** Ground those separately, inject them mechanically every session, and enforce
the immutable ones *below* the agent — never trust the agent to "remember to read the vision."

---

## 1. Why a vision document is necessary but NOT sufficient

We started believing `vision.md` — immutable, user-authored, re-injected verbatim — was enough
to prevent drift. It isn't. Three gaps showed up in practice:

1. **Vision can ground the *product* while missing the *builder*.** In the project this playbook
   comes from, `vision.md` was re-injected into downstream worker agents — but that did nothing
   to ground the *dev session*: the agent building the system itself. Two different contexts; the
   vision only rode into one of them by default. **Lesson: be explicit about *which* context each
   grounding document actually enters.**

2. **Long sessions don't drift on intent — they drift on decisions.** "What are we building" stays
   stable (that's what vision holds). What drifts is "which approach did we pick," "what tradeoff
   did we settle," "didn't we already reject X." A vision paragraph holds none of that. A four-hour
   session will quietly re-open a settled call or contradict it, and nothing flags it.

3. **A fresh session starts blank and over-claims.** Without the load-bearing decisions in front of
   it, a new session re-litigates them from scratch — or worse, silently assumes the *rejected*
   option. Example we caught: the vision promised a broad, general capability, but the system at
   that point handled exactly one narrow case. A fresh session confidently claimed we were "close"
   to the general capability — because nothing wrote down, plainly, *what the system could not do
   yet.*

**The fix is not a bigger vision document. It is a second layer — and a delivery mechanism.**

---

## 2. The core principle: layer grounding by what drifts

Different things drift at different rates, are owned by different parties, and prevent different
failures. One file cannot hold them coherently. Split by: *who* changes it, *how fast* it changes,
and *what drift* it prevents.

| Layer | Document | Owner | Drift it prevents | Change discipline |
|---|---|---|---|---|
| **Intent** | `vision.md` | user only | building the wrong thing | immutable; user-only edits |
| **Laws** | `CLAUDE.md` / constitution | user (rarely) | violating the paradigm/values | rare, deliberate |
| **Decisions & invariants** | `docs/STRATEGY-LEDGER.md` | agent + user | re-litigating / contradicting settled calls | append-only, explicit supersede |
| **State — past** | `docs/CURRENT_STATE.md` | agent | redoing done work; false "done" | updated each session |
| **State — future** | `docs/ROADMAP.md` | agent + user | losing the thread of what's next | checkboxes + dates |
| **Facts** | memory nodes + index | agent | forgetting cross-session context | verify-before-use |
| **Ground truth** | append-only logs (`logs/*.jsonl`) | agent | claims unbacked by evidence | append-only, never edited |

The starter pack scaffolds all of these. **The piece that most prevents drift and is usually
missing from ad-hoc setups is the *Decisions & Invariants ledger* — plus the hook that injects
it.** That's the highest-leverage part of the whole scaffold.

---

## 3. The mechanisms — documents are inert; these are what actually hold

### 3a. Mechanical injection beats "read the vision first"

Never rely on the agent to *choose* to read the grounding. Inject it **every session, verbatim,
before the agent does anything**, with a `SessionStart` hook.

- **The mechanism:** `.claude/settings.json` → `hooks.SessionStart` runs
  `cat docs/STRATEGY-LEDGER.md`. The load-bearing decisions are in the context window before the
  first user turn.
- **In this scaffold:** shipped as `templates/claude/settings.json.template`. This is the single
  highest-leverage anti-drift move — everything else is inert without it.

### 3b. Immutability + enforcement *below* the harness

The north star cannot drift if the agent *cannot edit it*. Instructions request; the environment
enforces.

- **The mechanism:** `vision.md` is `chmod 444` **and** a git pre-commit hook rejects any commit
  touching protected paths. A documented `--no-verify` override exists **only** for user-authorized
  changes.
- **In this scaffold:** `templates/scripts/bootstrap.sh` + `templates/scripts/githooks/pre-commit`
  protect `vision.md`, `CLAUDE.md`, and `docs/architecture.md`, and refuse staged `.env*` files.

### 3c. Record decisions append-only, with explicit supersede

**A decision reversed silently *is* drift.** The ledger's standing rule: *"do not reverse any of
these without logging an explicit supersede to the decisions log."*

Each load-bearing entry carries four things, not one:
- **the decision** (what we do),
- **why** (the reasoning that would otherwise be re-derived),
- **what was rejected** — and *"do not re-propose"* (see 4b),
- **a pointer** to the full record (a `logs/DECISIONS.jsonl` id, a commit).

### 3d. Verify recalled memory against ground truth

Memory reflects what was true **when written**. A recalled fact that names a file, function, or flag
must be **re-verified before you act on it** — stale memory is a drift vector precisely because it's
confident and specific while pointing you wrong.

Corollary: **regenerate derived views from ground truth**, never trust a stored copy — repo map from
the AST, file inventory from `git ls-files`, routes from framework conventions, schema from DB
introspection. A registry that can disagree with reality eventually will.

### 3e. Separate future / past / design (temporal doc discipline)

- `docs/CURRENT_STATE.md` = the **past** (what's built, verified).
- `docs/ROADMAP.md` = the **future** (what's next, as `[ ]`/`[x]`).
- `docs/architecture.md` = the **design** (how it's shaped).

Never blend them. Never delete — **supersede** (strike through / move to a "superseded" tail, keep
history). Use **absolute ISO dates and commit hashes**, never "recently" or "the other day."

---

## 4. The tests that catch drift (run these while *writing* the ledger)

### 4a. The re-litigation test
For every decision ask: *"Would a fresh session re-open this, or silently contradict it?"* If yes, it
belongs in the always-injected ledger — **with its rationale and its rejected alternatives.** If a
decision is so obvious no session would reverse it, it doesn't need to be in the ledger.

### 4b. The rejected-option test
For every settled decision, write down **what you rejected and "do not re-propose."** Drift very often
*is* the quiet re-proposal of a settled-and-rejected path. Anonymized worked example:
> *Rejected, do not re-propose: a centralized hosted service holding every user's credentials —
> catastrophic custody risk, nothing pre-committed to verify against, violates a core law of the
> project.*

### 4c. The envelope-honesty test
Write down, plainly, **what the system CANNOT do.** Drift loves to over-claim. One honest sentence
stops it:
> *The system today handles exactly one narrow case on a frozen scaffold; it is NOT close to the
> vision's general capability.*

That line means a fresh session cannot confidently promise capability the system lacks.

### 4d. The invariant test
For every cross-cutting rule, make it **enforceable**, not just stated. A stated invariant drifts; an
enforced one can't. Worked example: a "ships zero net-new capability" rule was only *implied* until
it was backed with an import-boundary lint + a regeneration test. **If an invariant matters,
something in CI should fail when it's violated.**

---

## 5. How this scaffold implements it (map to the shipped files)

1. **`docs/STRATEGY-LEDGER.md`** — the missing load-bearing layer, scaffolded *empty but
   structured*: **Current front** (1 paragraph, kept current) · **Load-bearing decisions** (numbered;
   decision + why + rejected/do-not-re-propose + pointer) · **Standing directives & envelope**
   (working rules + the honest "cannot do yet" line).
2. **A `SessionStart` hook** (`.claude/settings.json`) that `cat`s the ledger every session — the
   piece that makes the ledger load-bearing instead of decorative.
3. **A pre-commit hook + bootstrap script** that set `core.hooksPath`, chmod 444 the immutable
   layer, and reject staged edits to it (documented override: `git commit --no-verify`).
4. **`docs/lessons_learned.md` discipline** — curated; each lesson = **symptom → root cause → the
   rule that now prevents the whole class** (fix diseases, not symptoms). Cross-link each lesson to
   the ledger decision it produced.
5. **`logs/errors.jsonl` discipline** — each entry is the **evidence** (the failing output/state),
   not a narrative, including **what didn't work**. A resolved entry points at the commit or rule
   that killed the *class*, not just the instance.
6. **The memory-verification rule** — written into the scaffolded CLAUDE.md: verify any recalled
   fact that names a path/flag/function before acting on it.

---

## 6. The shortest version (if you keep only this)

- **Vision** = intent. Immutable. User-only.
- **Ledger** = decisions + invariants + honest envelope. Injected into **every dev session by a
  hook** — this is the layer that actually stops drift.
- **Enforce** the immutable things *below* the agent (`444` + git hooks), don't just ask.
- **Rejected options** and **"what we can't do"** are first-class content — write them down.
- **Verify** recalled memory; **regenerate** derived views from ground truth.
- **Append-only** decisions with explicit supersede; keep **past / future / design** in separate
  files with absolute dates.

The vision tells a fresh session *where north is.* The ledger, injected mechanically, tells it *which
roads are already closed, which are already walked, and how far the map actually extends.* You need
both, and you need the hook — or the second one never gets read.
