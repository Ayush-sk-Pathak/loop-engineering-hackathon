# Aegis — Product Requirements Document (PRD)

> **Status:** Locked concept, pre-build. Written 2026-07-17 for the Loop Engineering
> Hackathon (submission 4:30 PM). This is the single source of truth for *what* we are
> building, *why*, and *who builds what*. The binding design shape is
> `docs/architecture.md`; the settled decisions and their rejected alternatives are in
> `docs/STRATEGY-LEDGER.md`. Keep this in sync when scope settles.

---

## 1. The one-liner

**Aegis** — an autonomous stockout-rescue procurement agent that verifies every supplier
with real, paid checks *before* it is allowed to spend a cent, so it **cannot be scammed**.

**The pitch that wins the room:**
> "Everyone here gave an AI agent a wallet today. We built the reason you can."

Every other team's autonomous-spend demo is, unintentionally, the setup line for ours: the
moment you let an agent move company money, the first question a real buyer asks is *"what
stops it from getting scammed?"* Aegis makes the answer the product.

---

## 2. The hackathon (context & hard constraints)

- **Event:** Loop Engineering Hackathon (organizer: tokens& / Creators Corner). Sponsors:
  **Nexla, Pomerium, Akash, Metaview (Fillmore), Zero.xyz, Amazon.**
- **Theme:** *"Build self-directing agent loops that plan, act, observe, and self-correct
  across the build cycle."* Scrappy-but-real autonomous workflows.
- **Date & clock (2026-07-17):** doors 9:30 AM · hacking begins **11:00 AM** · lunch 1:30 PM ·
  **submission 4:30 PM** · judging 4:45 PM · finalist presentations 6:00 PM · awards 7:00 PM.
  → **~5.5 hours of build time.**
- **Deliverables (all required):** a **public GitHub repo**, a **3-minute demo recording**,
  and a complete Devpost submission.
- **Judging — 5 criteria, 20% each:**
  1. **Idea** — problem-solving potential & real-world value.
  2. **Technical Implementation** — quality of execution.
  3. **Tool Use** — effective use of sponsor tools.
  4. **Presentation** — 3-minute demo quality.
  5. **Autonomy** — agent effectiveness with **real-time data** and **minimal manual
     intervention**.
- **Prizes we target (in priority order):**
  - **Best use of Zero.xyz — $2,000 Amazon gift card (1st).** Primary target.
  - **Most Innovative Use of Pomerium — $1,000 cash.** Secondary target.
  - Nexla ($750 + $5k credits) and Akash ($500/$250) — *coverage*; contend only if the core is done.

**How Aegis maps to the criteria:** the verify-before-you-pay loop is *literally*
plan→act→observe→self-correct (Autonomy + Idea); the paid checks are live real-world data
(Autonomy); Zero + Pomerium are load-bearing, not bolted on (Tool Use); the "$ fraud
blocked" reveal is a clean 3-minute story (Presentation).

---

## 3. The problem (and the cash metric)

**Procurement fraud and vendor impersonation cost businesses billions.** Fake supplier
sites, typosquatted domains, "our bank details changed" emails, and phantom vendors that
take a wholesale payment and vanish. The moment of **maximum vulnerability is a stockout
emergency**: revenue is bleeding every second an item is out of stock, so a rushed buyer —
human *or* agent — skips due diligence and wires money to the first vendor that answers.

Two linked losses in one sentence: **"Stockouts lose revenue every second — but rushing the
fix is how you wire $40k to a fake supplier."**

**Cash-metric hook (to source precisely before the slide):** anchor on **Business Email
Compromise** — the FBI IC3 has reported BEC losses in the **~$2.9B/year** range, and
vendor-impersonation / fraudulent-bank-change / fake-invoice scams are its largest category.
Pair with the retail out-of-stock loss figure (commonly cited near ~$1T globally). *Deep
research did not verify these numbers — Owner 4 sources the exact current figures before they
appear anywhere.* (`STRATEGY-LEDGER` envelope, 2026-07-17.)

---

## 4. The solution (the Procurement Trust Loop)

An autonomous agent whose procurement loop has **fraud defense built into every step**, and
whose ability to spend is **physically gated** on verification passing.

**The loop (plan → act → observe → self-correct):**
1. **Observe / trigger.** Inventory for a hot SKU crosses its safety threshold → a
   `stockout_risk` event fires (Nexla FlexFlow stream).
2. **Plan.** The agent states its goal and success criteria: *rescue SKU X; verify every
   candidate before any money moves; order from the first that passes.*
3. **Act — source.** Produce ≥2 candidate backup vendors (demo: 1 legitimate + 1 planted
   fraudulent lookalike — typosquatted domain, ~2-week-old registration, no footprint).
4. **Act — verify (the paid Zero step).** For each candidate, the agent **spends real USDC
   via Zero.xyz** on a bundle of checks (see §5): business/contact enrichment, domain-age
   scrape, adverse-media news, and optionally an AI phone call. It aggregates a verdict.
5. **Observe + self-correct.** The fraud vendor fails the checks → the agent **blacklists it,
   logs why, and widens the search / picks the next candidate.** It never proceeds on a
   rejected vendor. *(If the agent's reasoning is wrong and it tries to pay the fraud vendor
   anyway, step 6 stops it — and the agent reasons about the denial and recovers.)*
6. **Act — gate & order.** The PO/payment call goes through **Pomerium**, which authorizes it
   **only if the vendor holds a valid verification attestation**. Unverified → `403`.
   Verified → the PO is placed, emailed via StableEmail (Zero), and inventory refills.
7. **Account.** The dashboard shows the decision trail and a **"$ fraud blocked / revenue
   saved"** counter.

**Why this beats stockout-rescue or fraud-detection alone:**
- One sentence carries **both** cash stories (lost revenue + wired-to-a-fraudster).
- The **self-correction is legible on screen** — sourced a vendor → verification failed →
  blacklist, widen, retry — the agent visibly recovers from being *targeted*. That is the
  hackathon theme, embodied.
- It answers the **unspoken question behind every autonomous-spend demo in the building**,
  which lets us pitch Aegis as the missing **trust layer for the whole room.**

**Defense in depth (the core architectural bet):** the agent's LLM reasoning is the *soft*
layer (it verifies and self-corrects); **Pomerium is the *hard* layer** (the payment API
rejects unverified vendors at the proxy, even if the reasoning is wrong or prompt-injected).
Removing the agent's verify step must *still* not let a fraudulent PO through. That property
is what makes autonomous spending trustworthy — and it's a live, provable demo beat.

---

## 5. What is real vs. what is staged (honesty ledger)

This matters because our pitch *is* honesty, and because the Zero judges scrutinize the paid
step hardest.

**Genuinely live (must not be faked):**
- **The Zero.xyz paid verification calls.** Assembled from tools deep research confirmed
  exist and settle USDC (`STRATEGY-LEDGER` decision 3):
  - **Business/contact enrichment** — Apollo / PDL / Crustdata: does this vendor company have
    a real digital footprint, employees, history? *Fraud shell → empty.*
  - **Web scrape + domain age** — Firecrawl / BrightData (+ WHOIS): *fraud domain → registered
    ~14 days ago.*
  - **Adverse-media / legitimacy** — news/search (serp): *fraud shell → no legitimate mentions.*
  - **(Showstopper, optional)** — **StablePhone AI call** to the vendor's listed number:
    *fraud number → dead / unregistered.* The agent literally phones the supplier to check
    it's real, live on stage.
- **The Pomerium denial.** A real `403` at the proxy when the fraud vendor lacks an
  attestation.

**Deliberately staged (controllable, for a deterministic 3-minute demo):**
- The two vendors are **planted** (1 legit, 1 fraud), engineered so the real checks above
  cleanly separate them.
- The stockout is triggered on cue (drop stock to zero in the storefront).
- The storefront, inventory, and PO side are our own mock commerce environment.

**Explicitly NOT done:** no credit-bureau / registry / fraud-score "lookup" (absent from
Zero), and **no fake verification vendor** we call through Zero. If a specific Zero tool is
missing on the day, **swap to another real Zero tool — never a mock** (`architecture.md
§Invariants`).

---

## 6. Requirements

### 6.1 Functional (must-have for the demo — P0)
- **F1.** A storefront shows a hot item; dropping its stock to zero fires a `stockout_risk`
  event the agent receives.
- **F2.** The agent sources ≥2 candidate backup vendors for the SKU.
- **F3.** For each candidate the agent makes **real paid Zero calls** and produces a verdict
  (`verified | rejected`, with reasons and the USD spent).
- **F4.** A rejected (fraud) vendor is **blacklisted and logged**, and the agent **re-sources
  / advances** to the next candidate without human input.
- **F5.** A PO to an unverified vendor is **denied by Pomerium (`403`)**; a PO to a verified
  vendor **succeeds**, emails the PO (StableEmail), and refills inventory.
- **F6.** The dashboard renders the **live decision trail** and the **"$ fraud blocked /
  revenue saved"** counter.

### 6.2 Should-have (P1, if core is green)
- **S1.** The StablePhone AI-call verification beat.
- **S2.** The counterfactual toggle: "bypass the agent's reasoning" → Pomerium **still**
  denies the fraud PO (proves defense-in-depth live).
- **S3.** Per-check cost readout so the wallet visibly debits as checks run (reinforces "real
  money, real Zero").

### 6.3 Nice-to-have (P2, only if ahead)
- **N1.** Deployed on Akash with a public URL.
- **N2.** A second fraud pattern (e.g. "changed bank details" mid-order) to show the loop
  generalizes.

### 6.4 Non-functional
- **NFR1 — Determinism.** The demo path must not depend on live-API roulette beyond the Zero
  calls and the Pomerium denial; everything else is planted/controllable.
- **NFR2 — Autonomy.** From the stockout trigger to the refill, **zero manual intervention**
  in the loop (judged criterion).
- **NFR3 — Traceability.** Every agent decision writes a `logs/DECISIONS.jsonl`-style record
  visible in the trail.
- **NFR4 — Time box.** Everything must be reachable from the 3-minute script (§9). Not on the
  script = not in scope.
- **NFR5 — Secrets.** Wallet keys / API creds are env-only (`.env`, git-ignored + pre-commit
  refuses `.env*`).

---

## 7. Tool stack (only genuine fits — see `STRATEGY-LEDGER` decisions 3–5)

| Tool | Role in Aegis | Why it genuinely fits | Prize |
|---|---|---|---|
| **Zero.xyz** ⭐ | The agent's **wallet** + the **paid verification loop** (enrichment, domain-age scrape, adverse-media, AI call) + PO email via StableEmail. Pays per-call in USDC on Base (x402), one wallet, hard ceiling. | The paid checks are the observe-step of the loop and they **settle real money** — a textbook micro-payment loop, not a demo mock. | **Primary — $2,000** |
| **Pomerium** ⭐ | Identity-aware policy gate in front of the **payment/PO API**; policy = *attested-vendors-only*. Unverified vendor → `403` at the proxy. | The agent **physically cannot** pay an unverified vendor even if its reasoning is wrong — capability-based backstop, the "trust layer." | **Secondary — $1,000** |
| **Nexla** | **FlexFlow** (GA, Kafka) streams inventory levels → fires the `stockout_risk` trigger (the loop's observe/trigger layer). | Real-time trigger over a data feed is exactly FlexFlow's job. (MCP Studio is Early Access → **not** used; same-day risk.) | Coverage |
| **Akash** | Hosts the containers (Docker Compose → Akash SDL). | Legit hosting. **Honest:** "we hosted a container" is a weak Akash-prize case — coverage only, don't over-invest. | Coverage |
| ~~Fillmore~~ | **Dropped.** | Recruiting-only (sourcing/outreach/scheduling); cannot draft POs — domain mismatch. PO email uses StableEmail instead. | — |

**Agent brain:** Anthropic **Claude** via the Claude Agent SDK (reasoning + tool-calling for
the loop). **Amazon** is a prize sponsor (gift cards), not an integration.

---

## 8. Infrastructure & architecture (summary — full blueprint in `architecture.md`)

**Services (mono-repo):**
- `apps/dashboard` — Next.js/React storefront + ops dashboard (decision trail, $ counter).
- `services/inventory` — Nexla FlexFlow flow (or local webhook/poller fallback) → `stockout_risk`.
- `services/agent` — TS + Claude Agent SDK; the plan/act/observe/self-correct loop.
- `services/verify` — TS + Zero.xyz; `verify(vendor) → verdict`; writes attestations.
- `services/procurement` — the `POST /po` payment/PO API, **fronted by Pomerium**; sends PO
  via StableEmail.
- `packages/contracts` — shared TypeScript types for the five seams + mocks.
- `deploy/akash` — Docker Compose + Akash SDL.

**Data stores:** SQLite for inventory, vendors, blacklist, and the **attestation store**
(the row Pomerium's policy checks). Keep it trivial — it's a demo.

**The five interface seams (freeze these first — `architecture.md §Data flow`):**
1. `stockout_risk { sku, currentQty, threshold, ts }` — inventory → agent.
2. `verify(vendor) → verdict { status, riskScore, reasons[], costUSD }` — agent → verify.
3. `attestation { vendorId, status:"verified", sig, expires }` — verify → (store Pomerium reads).
4. `POST /po { vendorId, sku, qty } → 200 | 403` — agent → procurement (through Pomerium).
5. `decision_event { phase, vendor, detail, ts }` — agent → dashboard.

**Runtime data flow:**
`storefront → Nexla trigger → agent(plan) → verify×N via Zero → attestation on pass →
agent POST /po → Pomerium(attested?) → 200 order + StableEmail + refill, or 403 →
agent self-corrects → dashboard trail + $ counter.`

**Deployment:** local `docker compose up` for dev and as the demo fallback; Akash SDL if time
permits (P2). The demo can run entirely local — Akash is a bonus, never the critical path.

---

## 9. The 3-minute demo script (deterministic)

> Practiced twice, timed. The narrator line is the pitch; the screen proves it.

- **0:00–0:20 — The hook.** "Everyone here gave an agent a wallet today. Here's the problem
  nobody's solving: the second you let an agent spend, it can get scammed. Procurement fraud
  is a multi-billion-dollar problem — and a stockout is when buyers skip diligence." Storefront
  on screen, hot item selling.
- **0:20–0:45 — Trigger.** Stock hits zero → `stockout_risk` fires (Nexla). The agent states
  its plan: *rescue this SKU, but verify every supplier before paying.* It sources **two**
  backup distributors — one legit, one lookalike.
- **0:45–1:45 — The paid verify loop (the star).** On screen, the agent spends cents via
  **Zero** on each vendor: enrichment, domain age, adverse-media, and an **AI phone call**.
  Vendor 1 comes back clean. Vendor 2 lights up **red** — 14-day-old typosquatted domain, no
  footprint, dead phone. The wallet visibly debits. The agent **blacklists** vendor 2 and
  logs exactly why.
- **1:45–2:30 — The hard backstop.** Show the counterfactual: force the agent to try paying
  the fraud vendor anyway (reasoning "goes wrong"). **Pomerium denies the payment call —
  `403`.** The agent reasons about the denial, keeps vendor 2 blacklisted, and proceeds with
  the verified vendor. *"Even if the AI is wrong, it cannot pay a supplier it didn't verify."*
- **2:30–3:00 — Resolution + the line.** PO fires to the verified vendor (StableEmail),
  inventory refills, counter reads **"$2,400 fraud blocked · $X revenue saved."** Close:
  *"Everyone here gave an agent a wallet. Aegis is the reason you can."*

---

## 10. Team plan — who codes what (team of 4)

Four vertical slices with clean seams; after the first 45 minutes everyone builds against the
shared mocks in `packages/contracts` in parallel. Each owner owns their slice **and** its
piece of the demo.

### Owner 1 — Agent Core (the brain / the loop)
- **Owns:** `services/agent` — the plan→act→observe→self-correct loop; vendor sourcing;
  calling `verify` per candidate; the **blacklist + re-source + retry** self-correction;
  issuing `POST /po`; handling the Pomerium `403` by reasoning + recovering; emitting
  decision events + `logs/DECISIONS.jsonl`.
- **Consumes seams:** 1 (in), 2 + 4 (out), 5 (out). **Depends on:** Owner 2's `verify`,
  Owner 3's `/po`. Builds against their mocks until integration.
- **Success:** given a stockout, the agent autonomously reaches a verified PO and never orders
  from the fraud vendor — provable end to end with mocks, then live.

### Owner 2 — Zero Verification (prize-critical)
- **Owns:** `services/verify` — wallet setup (`~/.zero/config.json`, funded, hard ceiling);
  the real paid calls (enrichment, scrape+WHOIS, news, StablePhone); verdict aggregation;
  writing the signed **attestation** on pass; per-check cost reporting.
- **FIRST TASK (blocks others):** re-verify `zero.xyz/browse` — confirm Apollo/PDL, Firecrawl,
  serp, StablePhone/StableEmail are live and settle from our wallet; report the exact tool
  names to the team. If one is missing, pick the real substitute and update `architecture.md`.
- **Produces seams:** 2 (out), 3 (attestation). **Success:** `verify(fraudVendor)` returns
  `rejected` with real evidence and a real wallet debit; `verify(legitVendor)` returns
  `verified` + attestation.

### Owner 3 — Pomerium + Procurement API + Akash (infra / the hard backstop)
- **Owns:** `services/procurement` (`POST /po` → StableEmail PO + inventory refill); the
  **Pomerium** deployment + policy (*authorize only if vendor has a valid attestation*); the
  attestation store Pomerium reads; `deploy/akash`.
- **Fallback:** if Pomerium cloud setup stalls, ship a thin identity-aware reverse-proxy
  policy check that enforces the same invariant, and note it — the *invariant* is what's
  judged, and we can still credit Pomerium if the policy engine is wired.
- **Produces seams:** 3 (consumes), 4 (the gated endpoint). **Success:** PO to unverified →
  `403` at the proxy; to verified → `200`; the invariant holds even if the agent is bypassed.

### Owner 4 — Storefront / Dashboard + Nexla + Demo
- **Owns:** `apps/dashboard` (storefront, inventory gauge, **live decision-trail panel**,
  **"$ fraud blocked / revenue saved" counter**); `services/inventory` (Nexla FlexFlow flow →
  `stockout_risk`, with a local webhook fallback); the **two planted vendors** dataset (tuned
  so the fraud vendor fails every real check); sourcing the **cash-metric figures**; and
  **driving the 3-minute demo + recording**.
- **Consumes seams:** 5 (in), 1 (produces the trigger). **Success:** the whole story is legible
  on one screen and the demo runs start-to-finish in under 3:00, twice.

**Shared, first 45 min (all four):** agree the five seam signatures, commit
`packages/contracts` types + mocks, scaffold the repo skeleton, and Owner 2 runs the Zero
catalog re-verification. **Nobody writes real integration code before the seams are frozen.**

---

## 11. Timeline (the ~5.5-hour box)

| Time | Phase | Everyone |
|---|---|---|
| 11:00–11:45 | **Foundation** | Freeze seams; commit contracts + mocks; repo skeleton; **Owner 2 re-verifies Zero catalog**. |
| 11:45–14:15 | **Parallel build (mocks)** | Each owner builds their slice against mocks. Lunch (1:30) in shifts — don't stop the clock. |
| 14:15–15:15 | **Integration** | Drop mocks, wire real seams; plant + tune the two vendors; prove the invariants (403 + counterfactual). |
| 15:15–16:00 | **Harden + deploy** | Akash deploy (or local fallback); fix the top 3 demo-path bugs only; freeze scope. |
| 16:00–16:30 | **Demo + submit** | Rehearse twice timed; record the 3-min video; README + push public repo; submit on Devpost. |

**Rule:** at 15:15 the scope is frozen — after that it's polish and the demo, nothing new.

---

## 12. Risks & mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| A required Zero tool isn't live on the day | Med | **Owner 2 re-verifies at 11:00** before any code; swap to another real Zero tool; the verify step is tool-agnostic by design. |
| Pomerium setup eats the clock | Med | Owner 3 starts Pomerium first thing; documented **reverse-proxy fallback** that enforces the same attested-only invariant. |
| Nexla FlexFlow integration slow | Med | **Local webhook/poller fallback** for the trigger; Nexla is not on the critical path. |
| Wallet funding / x402 settlement friction | Med | Fund the wallet at 11:00; set a hard ceiling; keep per-check spend to cents; pre-test one real settled call before building on it. |
| Scope creep past 3:15 PM | High | Hard scope freeze at 15:15; **only demo-path features count** (NFR4). |
| Cash-metric numbers wrong on the slide | Low | Owner 4 sources exact FBI IC3 BEC + stockout figures with links before they appear. |
| Live-demo flake | Med | Everything but the Zero calls + Pomerium 403 is planted/deterministic; rehearse twice; keep a recorded backup of a clean run. |

---

## 13. Definition of done (submission checklist)

- [ ] End-to-end: stockout → source → **real** paid verify → blacklist fraud → Pomerium-gated
      PO to the verified vendor → refill, running with zero manual steps in the loop.
- [ ] The fraud PO is **denied at Pomerium (`403`)**; the counterfactual proves defense-in-depth.
- [ ] Wallet visibly debits on real Zero calls (screenshot/receipt captured).
- [ ] Dashboard shows the decision trail + "$ fraud blocked / revenue saved".
- [ ] Public GitHub repo: README (what/why, architecture diagram, tool mapping, run steps).
- [ ] 3-minute demo video recorded and uploaded.
- [ ] Devpost submission complete (all required fields, repo + video links).
- [ ] `docs/CURRENT_STATE.md` + `docs/ROADMAP.md` reflect final state (same-commit cadence).

---

## 14. Open questions (carry into the build)

1. **Exact live Zero tool names** for enrichment / scrape / news / phone — Owner 2 confirms at
   11:00 (`zero.xyz/browse`). Everything downstream keys off this.
2. **Pomerium ↔ attestation store** read path — can the policy read our SQLite/JWT attestation
   within the time box, or do we use the reverse-proxy fallback? Owner 3 decides by 12:30.
3. **Precise cash-metric figures** (BEC + stockouts) with citations — Owner 4.
4. **Vision.md** — the north star still needs the user's line-by-line approval (see §1/§4 as
   the proposed wording); nothing lands in `vision.md` until then.
