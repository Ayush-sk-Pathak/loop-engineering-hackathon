# Contributing

## First Run

```bash
npm run setup
npm run doctor
npm run check
npm run dev
```

`npm run setup` is idempotent. It creates `.env.local` only when missing, installs the
Git hook, and leaves existing secrets untouched. Never commit `.env.local`.

## Ownership

| Owner | Primary paths | Interface boundary |
|---|---|---|
| Agent Core | `services/agent`, Claude adapter under `services/control-plane` | consumes frozen contracts only |
| Zero Verification | `services/verification`, `config/zero-services.json` | returns normalized `EvidenceSignal[]` with receipts |
| Policy + Procurement | `services/procurement`, `infra/pomerium`, `deploy/akash` | preserves signed attestation and path binding |
| Dashboard + Data | `apps/dashboard`, Nexla setup, `docs/DEMO.md` | posts/reads schema v1.1 contracts |

Do not change `packages/contracts` casually. Contract changes require all four owners to
acknowledge the migration because they affect every workstream.

## Branch And Merge

```bash
git switch main
git pull --ff-only
git switch -c feat/<owner>-<short-task>

# work, then:
npm run check
git add <intentional-files>
git commit -m "feat(<area>): concise result"
git fetch origin
git rebase origin/main
npm run check
git push -u origin HEAD
```

Merge the reviewed branch to `main` only while `npm run check` is green. Do not force-push
`main`, commit another owner's unfinished files, or use `git add .` without reviewing
`git status --short`. `main` is the **single long-lived branch**; feature branches are
short-lived and deleted after merge. There is no standing `dev` branch.

## Integration Rules

- Fixture mode must remain visibly labeled in state and UI.
- A live paid evidence signal requires a provider, service ID, exact cost, timestamp, and
  receipt ID.
- Pomerium mode requires both its signed identity assertion and Continuim's signed,
  request-bound vendor attestation.
- A `403` from Node is local behavior. Only a matching Pomerium authorize log proves the
  sponsor integration.
- A PO schedules inbound stock. It does not refill on-hand stock or prove payment.
- Use synthetic/ineligible/high-risk for the planted candidate; do not claim proven fraud.

## Before Handoff

Run `npm run check`, update `docs/PROJECT_STATUS.md` when the summary changes, append a dated
entry to `docs/CURRENT_STATE.md`, and record any new live integration proof in its runbook.
