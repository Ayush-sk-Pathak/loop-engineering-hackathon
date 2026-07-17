# Continuum ↔ backend integration notes (lane E — investigate-first)

**Author:** lane E (`feat/continuum-integration`, worktree `.claude/worktrees/E`).
**Date:** 2026-07-17. **Status:** E1 investigation complete. This is a findings
report, not a wiring change — per the lane E contract, no wiring lands until PM +
human accept the E2 recommendation (see `docs/boards/OPERATING-MANUAL.md:115-131`).

Product spelling is **Continuim** (decision 0016); the folder is named `Continuum`.
Paths use the folder name as-is.

---

## 0. Headline (read this first)

**The `Continuum/` frontend has zero backend integration today.** It is a visually
complete, multi-page Next.js app whose every surface is driven by (a) hardcoded
fixtures in `src/lib/data/workspaces.ts` and (b) a **client-side simulation engine**
(`src/lib/simulation/engine.ts`) that fakes the whole remediation loop with
`setTimeout`, persisting only to `localStorage`. There is **no `fetch`, no
`process.env`/`NEXT_PUBLIC_*`, no `src/app/api/**`, no WebSocket/SSE, no polling** of
any server anywhere in the tree.

It also models a **different domain** than the backend: two workspaces
`northwind` (apparel dye) + `meridian` (GPU) and its own `SimulationSnapshot`/
`Workspace` type system — **not** the backend's `datacenter`/`apparel` scenarios and
`DemoState`. So integration is *additive* (introduce the first data layer) **and**
*translational* (map `DemoState` → the frontend's view-model, or retype the frontend).

By contrast, `apps/dashboard` (lane C) is already wired to the real control-plane and
is the screen the §14 demo script is bound to.

---

## 1. Build health (E1 evidence — required deliverable)

Run inside `Continuum/` on `feat/continuum-integration` (Node v22.14.0, npm 10.9.2):

- `npm install --no-audit --no-fund` → **clean, 332 packages, exit 0.**
- `npm run build` (`next build`) → **green, exit 0**, 14 routes, all `○ (Static)`
  prerendered (confirms nothing fetches at request time — the app is fully static/mock).

```
Route (app)                    Size   First Load JS
○ /                            3.38 kB  159 kB
○ /_not-found                    995 B  103 kB
○ /console                       131 B  103 kB   (redirect → /continuum)
○ /continuum                     499 B  159 kB
○ /dashboard                     847 B  117 kB
○ /incidents                     131 B  103 kB   (redirect → /reports)
○ /inventory                     781 B  117 kB
○ /learning                      131 B  103 kB   (redirect → /continuum)
○ /procurement                   601 B  117 kB
○ /reports                       999 B  117 kB
○ /settings                      956 B  117 kB
○ /suppliers                    1.16 kB  117 kB
```

**One non-blocking warning:** Next infers the workspace root from multiple lockfiles
(repo-root `package-lock.json` + `Continuum/package-lock.json`) and picks the repo root.
Build still succeeds. If it ever matters, set `outputFileTracingRoot: __dirname` in
`Continuum/next.config.ts`. Not fixing now (no wiring pre-approval).

**Standalone confirmed:** `Continuum/` is *not* a root npm workspace member (root
workspaces = `apps/*`, `packages/*`, `services/*`); it has its own lockfile and only 4
runtime deps (`next`, `react`, `react-dom`, `framer-motion`). No `@continuim/contracts`
linkage. No env vars required to build. Node ≥ 20 needed (Next 15 / React 19); nothing
pins it (`no engines`/`.nvmrc`).

---

## 2. The backend surface (what there is to wire *to*)

Control-plane = plain `node:http` server, `services/control-plane/src/server.ts`,
default **port 4000**. CORS open. Every screen's data is one payload: **`GET /api/state`**
returns the whole `DemoState` (`packages/contracts/src/index.ts:204-237`). There are **no**
separate endpoints for events / PO / vendors / logs — they are all fields of `DemoState`:

- timeline/log → `state.events[]` (`DecisionEvent[]`, 14 `DecisionPhase` values)
- vendors + evidence status → `state.vendors[]` + `state.blacklistedVendorIds[]` + `state.learning.provenVendorIds[]`
- the PO → `state.order?` (present only after a successful run)
- KPIs / spend / denial → `state.metrics` (`atRiskPoValuePreventedCents`, `verificationSpendCents`, `verificationMode`, `authorizationMode`, `deniedRequestId?`, `deniedEnforcementPoint?`)
- inventory → `state.inventory` (**single SKU**, not a list) ; monitor → `state.monitor.lastCheckAt`

Command endpoints (POST, drive the loop):

| Endpoint | Effect |
|---|---|
| `POST /api/demo/consume` | consume one unit — the "Simulate node failure / consume stock" button; `409` if running or qty≤0 |
| `POST /api/demo/run` | fire a full synthetic run (`source:"local"`) |
| `POST /api/demo/reset` `{hard?}` | soft reset keeps scenario + learning ledger; `hard:true` also clears incidents |
| `POST /api/demo/scenario` `{id:"datacenter"\|"apparel"}` | switch scenario; `409` if running |
| `POST /api/events/stockout` (+ `x-continuim-webhook-secret`) | Nexla webhook ingress (not a UI button) |

### The proxy pattern to replicate

`apps/dashboard/app/api/control/[...path]/route.ts` (28 lines) is a same-origin
catch-all: `CONTROL_PLANE = process.env.CONTROL_PLANE_INTERNAL_URL ?? "http://127.0.0.1:4000"`
(server-side only — browser never sees the address), forwards method/body/query,
`cache:"no-store"`, exports `GET`+`POST`. Browser calls `/api/control/api/state` and
`/api/control/api/demo/*` (the `/api/` doubles by design). `operations-dashboard.tsx`
**polls `/api/state` every 400 ms** (`setInterval`), re-fetching after each command.

To wire Continuum the same way you'd add `Continuum/src/app/api/control/[...path]/route.ts`
(a copy), set `CONTROL_PLANE_INTERNAL_URL`, and poll `/api/control/api/state`.

---

## 3. Page → backend surface map

Real pages (8) + redirect stubs (3). "Backend need" = what `/api/state` / `/api/demo/*`
would feed the page if wired.

| Route | File | Renders today (all mock) | Backend surface it maps to | Fit |
|---|---|---|---|---|
| `/` | `src/app/page.tsx` | Marketing landing + embedded `AgentTheater` demo | none for marketing; theater ⇒ `GET /api/state` + `POST /api/demo/consume\|run\|reset` | n/a (marketing) |
| `/continuum` | `src/app/continuum/page.tsx` | `AgentTheater`: 6-stage pipeline (Detect→Source→Verify→Guard→Procure→Learn), vendors, transcript, outcome tiles | `state.runStatus`+`events[]` (phase→stage), `vendors[]`, `metrics`, `order?` | **Closest analog to the §14 hero**, but pipeline stages ≠ 14 `DecisionPhase`s (needs a phase→stage map) |
| `/dashboard` | `src/app/dashboard/page.tsx` | KPI grid, incident callout, activity feed, outcome (blocked vs protected value) | `state.metrics`, `events[]`, `inventory`, `scenario` | Good |
| `/inventory` | `src/app/inventory/page.tsx` | table of monitored "assets" (multiple) | `state.inventory` = **one SKU only** | **Shape gap** (list vs single) |
| `/procurement` | `src/app/procurement/page.tsx` | purchase-order table (`workspace.purchases[]`, multiple) | `state.order?` = **one optional PO** | **Shape gap** (list vs single/absent) |
| `/reports` | `src/app/reports/page.tsx` | governance metrics + "blocked payments" bar chart; hardcoded "$0.04"/"100%" | `state.metrics` + `learning` + `events[]` | Partial |
| `/settings` | `src/app/settings/page.tsx` | guardrails (policy string, spend ceiling), connected integrations | **no endpoint** — policy is env (`AUTH_MODE`/`VERIFICATION_MODE`); spend ceiling not in `DemoState` | **No backend** |
| `/suppliers` | `src/app/suppliers/page.tsx` | vendor registry grid (evidence, region, quote, SLA) | `state.vendors[]` + `blacklistedVendorIds[]` + `learning.provenVendorIds[]` | Good |
| `/console` | → `/continuum` | redirect | — | — |
| `/incidents` | → `/reports` | redirect | — | — |
| `/learning` | → `/continuum` | redirect | — | — |

---

## 4. Rendered-vs-available data (the gaps both ways)

**Frontend shows richer/structured data the backend does not expose structurally.**
`/api/state` surfaces evidence, attestation, and Zero receipts **only as free-text
`DecisionEvent.detail` strings**, not typed fields. So even a faithful wiring cannot
populate Continuum's structured panels directly:

- `VendorCard` evidence signals (`EvidenceSignal` label/value/state) — backend
  `VerificationVerdict`/`EvidenceSignal` (`contracts:45-84`) are **not** in `/api/state`.
- Attestation summary (vendor, payee, quote, amount cap, evidence hash, expiry, nonce)
  — backend `VendorAttestation` (`contracts:86-105`) is **not** in `/api/state`;
  only an `attested` `DecisionEvent` detail string exists.
- Zero "service names / price / wallet delta / receipt IDs" — appear only inside
  `sourced`/`verifying` event detail strings.

**Frontend also invents concepts with no backend equivalent:** workspaces, KPI copy,
`spendCeiling`, per-asset `source` labels, `reportRows`, the `LedgerEntry` warm-path
memory (backend's `learning` is only `{incidentCount, lastResolutionMs, provenVendorIds}`).

**Backend exposes fields the frontend ignores:** `metrics.verificationMode` /
`authorizationMode` (the honest **mode badges** the §14 demo requires), `deniedRequestId`,
`monitor.lastCheckAt`, `updatedAt`.

**Money convention matches** — both sides use integer **cents** (`Supplier.baseFee`,
`PurchaseAttempt.amount`, `metrics.*Cents`; `formatCurrency` divides by 100). Good.

---

## 5. Mock / hardcoded data catalog

| Source | Location | What it fakes |
|---|---|---|
| Fixture workspaces | `src/lib/data/workspaces.ts` | `WORKSPACES.northwind` (dye) + `.meridian` (GPU): scenario, assets, suppliers+evidence, purchases, activity, kpis, reportRows, spendCeiling, integrations |
| Flattened suppliers / scenarios | `src/lib/data/{suppliers,scenarios}.ts` | derived views of the above |
| Simulation engine | `src/lib/simulation/engine.ts` | scripted `setTimeout` state machine; hardcoded strings incl. `"403 · Payment denied"`, `"Evidence cost: $0.04"`; `Math.random()` PO numbers |
| localStorage ledger | `src/lib/simulation/ledger.ts` | keys `continuum.ledger.v1` / `continuum.incidents.v1`; `seedIncidents()` adds 2 more hardcoded incidents |
| Integration name-drops (labels only) | `workspaces.ts` `integrations[]` + `source` fields | "Nexla / Zero / Pomerium / StableEmail / CloudBurst" — display strings, nothing calls them |

**The single integration seam:** `src/lib/store.tsx` — `ContinuumProvider` +
`useContinuum()`. Every page/component reads data **exclusively** through this hook
(`{snapshot, ledger, incidents, workspace, workspaceId, setWorkspace, trigger, reset,
setSpeed}`), bound to `continuumEngine` (`store.tsx:13,50`) and `getWorkspace()`
(`store.tsx:14,88`). **This is the one choke point to re-point at a real `/api/state`
poller.** Domain types to reconcile live in `src/lib/types.ts` (`SimulationSnapshot`,
`Workspace`, `Supplier`, `Scenario`, `IncidentRecord`, `LedgerEntry`, …).

**Dead code (not on any route; flagged, not touched):** `IncidentRail`
(`components/agent/IncidentRail.tsx`), `IncidentTable`, `LearningMatrix`
(`components/ops/*`) — leftovers referencing undefined dark-theme Tailwind tokens
(`bone`, `amber`, `ink-elevated`). They compile but are unused.

---

## 6. §14 demo-readiness gap (feeds the E2 recommendation)

The demo (`docs/DEMO.md`, PRD §14) runs off **one operations screen** + two external
tabs. Against its required on-screen elements, Continuum today:

| Demo requirement | Backend field | Continuum today |
|---|---|---|
| Mode badges "Live Zero"/"Fixture", "Pomerium"/"Development" | `metrics.verificationMode`, `metrics.authorizationMode` | ❌ only static "integrations" labels; not bound to real mode |
| Scenario dropdown **datacenter ↔ apparel** + scenario-aware button | `POST /api/demo/scenario` | ❌ workspace switcher is **northwind/meridian** (wrong scenarios & labels) |
| Monitor last-check ticks + `stockout_risk` w/ no run action | `monitor.lastCheckAt`, `events[]` | ❌ scripted `setTimeout`, not a real monitor |
| Zero: service names, price, wallet delta, ≥3 receipt IDs | event `detail` strings | ❌ hardcoded "$0.04" |
| Pomerium 403 + request ID | `metrics.deniedRequestId`, `authorization_denied` event | ❌ hardcoded "403 DENIED" |
| Attestation summary (payee, cap, evidence hash, expiry, nonce) + 201 | `attested` event detail (not structured) | ❌ not in this form |
| PO ID, "20 units inbound scheduled", on-hand = 0, StableEmail msg ID | `order.id`, `order.inboundStatus`, `inventory.currentQty` | ❌ hardcoded |
| Two closing numbers incl. literal **"$2,400 at-risk PO value prevented"** | `metrics.atRiskPoValuePreventedCents`, `verificationSpendCents` | ⚠️ has outcome tiles, different labels/numbers |
| Learning / proven-vendor chip | `learning.provenVendorIds` | ⚠️ has localStorage warm-path, not backend-fed |

Honesty constraint (decision 10): mode badges must reflect *real* modes with external
proof; a scripted animation cannot honestly display "Live Zero"/"Pomerium".

---

## 7. Wiring-effort estimate per surface (rough, for E2)

Assumes the proxy-route copy (~15 min) + a `DemoState → view-model` adapter is built once.

| Surface | Effort | Notes |
|---|---|---|
| proxy route + `/api/state` poller in `store.tsx` | **M** | swap `continuumEngine` source; keep `useContinuum()` contract |
| `DemoState → SimulationSnapshot/Workspace` adapter | **L** | different type systems; the real cost |
| `/suppliers`, `/dashboard` | S each | map cleanly once adapter exists |
| `/continuum` (hero theater) | **M** | need `DecisionPhase(14) → pipeline stage(6)` map + structured fields the API only gives as event strings |
| `/inventory`, `/procurement` | S–M | list-vs-single shape gaps to resolve |
| scenario reframe northwind/meridian → datacenter/apparel | **M** | labels, copy, default workspace, scenario-aware button |
| add missing §14 demo elements (mode badges, literals, receipts) | **M** | required before this could be the recording screen |
| `/settings`, `/reports` | S | mostly static; leave mock or derive |

S ≈ <1h, M ≈ 1–3h, L ≈ 3h+. **Full faithful replace of the demo screen is a day-plus;
not feasible before the 16:30 deadline.** A single wired hero view (`/continuum` or
`/dashboard`) as a non-load-bearing bonus is ~half a day if the adapter is built.

---

## 8. Recommendation (summary — full version goes to PM as the E2 decision-request)

**Supplement, do not replace (before submission).** Keep `apps/dashboard` as the
demo-of-record for the §14 recording — it is wired, proven, maps 1:1 to `DemoState`,
and the script is bound to its exact elements. `Continuum/` is a stronger *product*
surface but is fully mocked, differently typed, on the wrong scenarios, and missing
several demo-load-bearing elements; swapping it in ~2h before deadline is high demo-risk
and can't honestly show the Live-Zero/Pomerium mode badges. Adopt Continuum
post-submission; optionally, if PM wants, wire **one** Continuum view to `/api/state`
via the copied proxy as an explicitly off-critical-path bonus. Decision is PM + human's.
