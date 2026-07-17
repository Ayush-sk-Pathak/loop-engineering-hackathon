# Multi-tab operating manual — wave of 2026-07-17

One PM tab (`P`) + four worker tabs (`A`,`B`,`C`,`D`) coordinated through the
multi-agent-chatter board. This file is the **scope contract of record** for the wave;
project law (`CLAUDE.md`, `docs/STRATEGY-LEDGER.md`) overlays it. The execution plan
this implements is the approved plan of 2026-07-17 (PM tab holds it); the work items
are the 17 open boxes in `docs/ROADMAP.md`.

## Board quickref (all tabs)

```
BOARD="python3 ~/.claude/skills/multi-agent-chatter/board.py"
$BOARD since --tab <id>            # read mail (advances cursor) — ALWAYS before working
$BOARD watch --tab <id>            # doorbell — run via shell in background, restart after each fire
$BOARD append --from <id> --to P --kind status --state "<short>" --msg "<facts>"
$BOARD append --from <id> --to P --kind blocked --needs "<exactly what unblocks>"
$BOARD append --from <id> --to P --kind done --commit <sha> --suite "<verification>" --msg "<item id>"
$BOARD append --from <id> --to P --kind token-request --msg "<why>"   # wait for token-grant
$BOARD append --from <id> --to P --kind decision-request --msg "<the call needed>"
```

The board resolves to the same directory from every worktree. `done` is refused
without a commit sha. Never edit `BOARD.md` (generated) or hand-write board JSON.

## Hard rules (every worker)

1. **Single-writer:** touch only your owned paths below. Needing a change elsewhere =
   post the requested lines to the board (`note` or `decision-request`), the owner or PM lands it.
2. **Never touch `.env.local` in the MAIN checkout** — a human teammate owns it and is
   adding real keys. Your worktree gets its own secretless copy of `config/example.env`.
   Missing key/credential ⇒ `blocked --needs <exact env var>` — never fake, never
   silently fall back to fixture (decision 0010).
3. **Every task = a commit on your branch; push nothing; only PM merges** (`--no-ff`,
   `npm run check` green). Never commit to `main`; never force-push anything.
4. **Token before any serialized resource:** canonical stack (ports 3000/4000/4001/4100),
   paid Zero wallet spend, Pomerium cluster mutations, live demo runs. `token-request`
   → wait for `token-grant` → run → `token-release` immediately.
5. **Scope is fixed.** Don't narrow it to make something pass; `decision-request` and stop.
6. **Doc cadence (same commit):** finishing a ROADMAP item ⇒ that commit also appends
   `docs/CURRENT_STATE.md` (dated, with commit hash/artifact source) and ticks your own
   ROADMAP line. Live claims land in your `docs/integrations/*` runbook **before** you
   claim them on the board. Errors → `logs/errors.jsonl` (schema `logs/README.md`).
7. **Ports:** use your lane's block (below) for any servers you run in your worktree.
   3000/4000/4001/4100 belong to the token holder. Never set `SQLITE_PATH` to an
   absolute/shared path — the default relative `data/` path keeps worktrees isolated.
   Dashboard off-3000 must be started directly:
   `node node_modules/next/dist/bin/next dev apps/dashboard --port <port>` (the
   `dev:web` script hardcodes 3000).

## Lane contracts

### A — Zero (branch `feat/zero-live`, worktree `.claude/worktrees/A`, ports: adapter 4110, stack 4200/4201)

**Owns:** `services/verification/**`, new `services/zero-adapter/**`,
`config/zero-services.json`, `docs/integrations/ZERO.md`. Root `package.json`: may
append own test/script lines at END of list only.

| Item | Done criterion |
|---|---|
| A1 (now) Zero evidence adapter: new `services/zero-adapter` HTTP service implementing the exact contract in `docs/integrations/ZERO.md` (POST evidence request `{vendor}` → `{vendorId, signals[]}` with `source.provider/serviceId/mode/costCents/observedAt/receiptId`), bearer-token check (`ZERO_EVIDENCE_ADAPTER_TOKEN`), receipt reuse across signals | `npm run check` green with new tests appended; server starts standalone; unit tests use a fake Zero transport; **unkeyed runtime request returns 503 "Zero session not configured" — never fixture-shaped `live_zero` data** |
| A2 (now) Service-candidate research: shortlist of live Zero services covering the EvidenceKinds incl. a named WHOIS/domain-age candidate; recorded in ZERO.md as *candidates, not verified*; re-verify the live catalog at zero.xyz/browse first (CLAUDE.md standing protocol) | ZERO.md updated; `verifiedAt` stays null |
| A3 (now) Downtime-rate citation research (operator-specific figure + source) | Citation + source posted to board as `note` for wave 3 |
| A4 (keys) Settle ≥3 live paid calls, fill the lock (`verifiedAt`, service ids/prices/receipt ids/latency) — **PM grants token + user pre-approves wallet budget first** | `doctor:prize` Zero rows PASS; receipts in ZERO.md |
| A5 (keys) Live e2e on canonical stack | decision trail shows `evidenceMode:"live_zero"` + receipt IDs |
| A6 (W3) WHOIS/domain-age anchor wired as named service | settled WHOIS receipt in lock; signal detail names provider |
| A7 (W3) Cited downtime rate in `services/verification/src/scenarios.ts` | check green; CURRENT_STATE carries source; board handoff to C for the label |
| A8 (W3) StablePhone go/no-go eval, 15-min timebox, default no-go | verdict on board + `logs/DECISIONS.jsonl` line |

**NOT in scope:** `runtime.ts`/`server.ts`/`store.ts`, `packages/contracts`, dashboard
files (citation label is C's), `compose.yaml` (request service block via board),
StableEmail, Pomerium, `scripts/doctor.ts`, `config/example.env` (post lines to board).

### B — Pomerium / Procurement / Deploy (branch `feat/pomerium-live`, worktree `.claude/worktrees/B`, ports 4300/4301)

**Owns:** `services/procurement/**`, `infra/pomerium/**`, `deploy/akash/**`,
`compose.yaml`, `Dockerfile`, `docs/integrations/POMERIUM.md`, `docs/integrations/AKASH.md`.

| Item | Done criterion |
|---|---|
| B1 (now) Final PPL from `infra/pomerium/vendor-policy.example.yaml` + exact cluster runbook in POMERIUM.md (private route → `procurement:4001`, Pass Identity Headers, service accounts `procurement-agent` + `vendor:vendor-northstar`) | policy yaml final; runbook has the click-path/CLI |
| B2 (now) Prize-mode compose topology verified (procurement `expose`-only; connector/tunnel block if the Pomerium Zero route needs one) | `docker compose config` valid; `docker compose up --build` healthy in dev mode |
| B3 (now) StableEmail module **inside `services/procurement`** (`src/email.ts`, post-201 hook in procurement's server, `EMAIL_MODE=off` default, fake-transport tests, disclosed non-Zero fallback labeled as such) — **no `packages/contracts` change** | check green; with `EMAIL_MODE=off` all preexisting tests untouched |
| B4 (now) Akash prep: local image build + SDL replace-marker procedure in AKASH.md | `docker build .` succeeds |
| B5 (keys) Pomerium Zero cluster + route + 2 service accounts + PPL applied (token) | `doctor:prize` `POMERIUM_*` rows PASS |
| B6 (keys) Capture denial + allow on canonical origin (token): `403` + Pomerium/Envoy request ID + `allow:false` authorize log + **no matching origin request**, then `201` with `vendor:vendor-northstar` on the same route | artifacts pasted into POMERIUM.md same-commit; an app-generated 403 does not count |
| B7 (W3) StableEmail live send (token): Zero receipt + message ID + received message | in runbook; email visible in a mail tab |
| B8 (W3) Akash publish + lease — **gate first:** `doctor:prize` ∧ `build` ∧ `docker compose up --build` green | lease + provider + digest + URL in AKASH.md; never on demo critical path |

**NOT in scope:** `runtime.ts` (live Pomerium is already env-driven), `packages/contracts`
(no emailMessageId field), dashboard, StablePhone, Zero evidence, `scripts/doctor.ts`,
`config/example.env` (post lines to board).

### C — Nexla / Dashboard / Demo (branch `feat/nexla-demo`, worktree `.claude/worktrees/C`, ports: dashboard 3100, stack 4400/4401)

**Owns:** `apps/dashboard/**`, `docs/integrations/NEXLA.md`, `docs/DEMO.md`.

> **External UI handoff (2026-07-17):** a human teammate is separately working on UI and
> their work will be handed over later. Keep every dashboard edit surgical (chips,
> badges, labels — no restyling, no component refactors, no file moves) so that drop
> merges cleanly. PM reconciles the handoff when it arrives.

| Item | Done criterion |
|---|---|
| C1 (now) Local ingress rehearsal in own worktree stack: POST `config/nexla-stockout.example.json` to own control plane | `202 {"accepted":true}`; `/api/state` trail carries `correlationId` = posted `eventId` |
| C2 (now) Dashboard: event-ID/correlation chip legible; mode badges (Live Zero / Fixture, Pomerium / Development) verified for every mode combination | visual check + `npm run build:web` green |
| C3 (now) FlexFlow design in NEXLA.md: source → v1.1 transform → `currentQty <= threshold` filter → destination POST with `X-StockShield-Webhook-Secret` | NEXLA.md updated |
| C4 (now) Rehearsal checklist hardening in DEMO.md — hard reset `curl -X POST .../api/demo/reset --data '{"hard":true}'` before EVERY denial rehearsal; datacenter scenario lock | DEMO.md reviewed/updated |
| C5 (keys) Live FlexFlow flow → canonical ingress (token) | 202; Nexla event ID as `correlationId` in canonical trace; flow+event IDs in NEXLA.md same-commit |
| C6 (W3) Citation label flip (`operations-dashboard.tsx` "Illustrative incident rate" → A's cited wording; DEMO.md claims line) + explainer render from D's decision-event metadata — sequenced after A7/D merges | `build:web` green; visible in a run |
| C7 (W4) Timed demo ×2 + recording choreography support | two timed durations logged; recording done |

**NOT in scope:** `server.ts`/`runtime.ts`/store (event-ID plumbing already exists),
`packages/contracts`, `scenarios.ts` values, Pomerium/Zero config, `scripts/doctor.ts`.

### D — Agent core / LLM (branch `feat/agent-explainer`, worktree `.claude/worktrees/D`, ports 4500/4501)

**Owns:** `services/agent/**`, new `services/control-plane/src/claude.ts`;
`services/control-plane/src/runtime.ts` single-writer **from wave 3** (may edit
on-branch earlier). Sole lane allowed a new dependency (`@aws-sdk/client-bedrock-runtime`).

| Item | Done criterion |
|---|---|
| D1 (now) Optional planner/explainer port in `LoopPorts` (`services/agent/src/index.ts`), no-op default. May rank eligible options + explain evidence; **never adjudicates, never mints capability, output never feeds verify/authorize inputs** (decisions 0008/0014). Explainer text via decision-event `metadata` | all 15 existing tests green with port absent; new tests: policy-wins-on-disagreement + disagreement logged |
| D2 (now) `claude.ts`: Bedrock Converse, cross-region inference profile `us.anthropic.claude-haiku-4-5-*` (bare id throws on-demand-throughput errors), `ANTHROPIC_API_KEY` fallback, `PLANNER_MODE=off` default, injected transport | fake-transport unit tests green; `npm run check` green |
| D3 (now) `runtime.ts` wiring on-branch, held unmerged | branch rebases cleanly on main |
| D4 (keys, if AWS/Anthropic keys arrive) One live call trace | trace into CURRENT_STATE; `PLANNER_MODE=off` run byte-identical in decisions |
| D5 (conditional) Replay mode — only if PM triggers after a flaky slice | captured artifacts replay; modes distinguished |

**Merge discipline:** D merges NOTHING until PM declares core proof green (decision 0012).

**NOT in scope:** demand-audit branch (separately scheduled as an exclusive serialized
window — see plan W3-X), `packages/contracts`, dashboard rendering, verification
policy, procurement, `server.ts`.

## Hotspots (nobody but the named writer touches these)

| File | Rule |
|---|---|
| `services/control-plane/src/runtime.ts` | frozen waves 0–2 → single-writer D from wave 3 |
| `services/control-plane/src/server.ts`, `store.ts`, `scripts/doctor.ts` | frozen; PM-integrated-only |
| `packages/contracts/**` | PM-integrated-only + all-owner board ack; target zero changes |
| `config/example.env` | PM-integrated-only — post requested lines on the board |
| root `package.json` | lanes append own lines at END only; PM resolves conflicts at merge |
| `package-lock.json` | dependency freeze for A/B/C; D's change merges alone |
| `compose.yaml`, `Dockerfile` | single-writer B |
| `operations-dashboard.tsx`, `docs/DEMO.md` | single-writer C (A/D deliver data via board) |
| `docs/PROJECT_STATUS.md`, `docs/STRATEGY-LEDGER.md`, `docs/PRD.md` | PM-integrated-only |
| `docs/CURRENT_STATE.md`, `logs/*.jsonl` | any lane appends; `merge=union` handles crossings |

## Waves

- **W1 (now):** A1–A3 ∥ B1–B4 ∥ C1–C4 ∥ D1–D3. No gate — start immediately.
- **W2 (per-sponsor, when the user announces keys for that sponsor):** A4–A5 → B5–B6 →
  PM-led live vertical slice → C5. Token-serialized; wallet spends need user-approved budget.
- **W3 (after PM declares core proof green):** A6 → D-merge → C6a → B7 → A7 → C6b → A8 → B8.
- **W3-X:** demand-audit/purge branch — exclusive all-hands window, PM-scheduled, user go required.
- **W4:** doctor:prize + build + timed demo ×2 + recording + runbook sweep + submission.
