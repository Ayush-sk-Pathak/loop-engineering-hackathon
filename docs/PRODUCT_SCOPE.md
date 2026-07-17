# Vendor Fraud Interceptor — Product Scope

**Event:** Loop Engineering Hackathon — July 17, 2026 · AWS Builder Loft, SF
**Hard deadline:** Submissions close **4:30 PM**. Stop coding **3:45 PM**, record the 3-min video after.

---

## 1. Goal
Build a demonstrable autonomous procurement agent that resolves a stockout **and** blocks vendor fraud in a single self-correcting loop, showcasing ≥3 sponsor tools with a scriptable 3-minute demo.

## 2. Judging alignment (20% each)
| Criterion | How we score |
|---|---|
| Autonomy | Nexla event fires the loop; agent sources, verifies, pays, and re-sources with zero manual steps. |
| Idea | Fraud + stockout = two crystal-clear cash stories in one product. |
| Technical Implementation | Real Pomerium policy enforcement (visible 403), real Zero payment loop. |
| Tool Use | Nexla + Zero + Pomerium (+ Fillmore/AWS/Akash) = 3–5 sponsor tools. |
| Presentation | Deterministic, planted-vendor demo — no live-API roulette. |

## 3. Core user story
> A resource hits zero → agent sources backup vendors → pays cents to verify each → tries to pay the fraudulent one → **Pomerium denies it** → agent blacklists it, self-corrects to the verified vendor → PO sent → resource restored → dashboard shows "$X fraud blocked, $Y loss avoided."

The loop is **scenario-agnostic** — it's a data-driven vendor list + inventory item. We ship **two locked scenarios** (below) that run through the *same* engine to prove it generalizes across industries.

## 3a. Locked demo scenarios
Both use identical code; only the seed data (item + vendors + numbers) differs. Live-demo one, then flip a dropdown to the other to show "same loop, any industry."

**Scenario A — On-prem enterprise compute (Case 0b, the serious one):**
- Item: GPU node in a regulated on-prem cluster (bank / hospital / trading firm).
- Trigger: node failure / capacity wall — no elastic scaling, SLA at risk.
- Verified vendor: `AuthorizedGPU Distribution` (traceable to manufacturer, multi-year registry).
- Fraud vendor: `TitanServer-Parts` (3-week-old domain, untraceable part provenance, shell/personal bank account — counterfeit / deposit-and-vanish front).
- Optional burst-capacity beat: agent spills overflow to a verified provider (AWS / Akash) to hold the SLA while procuring.
- Outcome counter: **"$95,000 counterfeit-hardware order blocked · SLA maintained · no compromised part in a regulated cluster."**
- Pitch weight: strongest Pomerium fit; counterfeit part = compliance/security incident, not just cost.

**Scenario B — Sock manufacturer out of dye (Case 1, the simple one):**
- Item: navy-blue dye for the bestselling sock line.
- Trigger: primary dye supplier logs a shipment delay; line halts in 18 hrs at ~$3,000/hr.
- Verified vendor: `Meridian Colorants` (6-year registry history).
- Fraud vendor: `PacificDye Co.` (typosquat of legit `Pacific Dyes Inc.`, 2-week-old domain, foreign shell bank account).
- Outcome counter: **"$18,000 fraud wire blocked · $54,000 production downtime avoided."**
- Pitch weight: cleanest, most legible cash story; safest live-demo run.

**Demo plan:** run **Scenario B live** (simplest, most deterministic, lowest risk on stage), then flip to **Scenario A** and narrate the on-prem/regulated stakes as the "this scales into serious infrastructure" closer.

## 4. In scope (MVP — must ship)
1. **Mock backend**: inventory store + payment/PO API (the thing Pomerium guards).
2. **Pomerium proxy** (Docker, self-hosted) with a policy: *allow payment only if `vendor.verified == true`.* Must produce a real 403.
3. **Zero integration**: agent wallet + at least one real paid verification lookup + payment for the winning order.
4. **Agent loop (Claude)**: plan → source → verify → attempt pay → observe denial → self-correct → complete. Emits a live trace.
5. **Nexla feed**: streams inventory + vendor list; fires the stock-below-threshold trigger.
6. **Demo dashboard**: item/inventory gauge, live agent log, fraud-blocked / loss-avoided counter, and a **scenario dropdown** to switch between Scenario A (on-prem GPU) and Scenario B (sock dye).
7. **Seed data for both locked scenarios** (§3a): each is one item + two planted vendors (verified + fraudulent), driven through the same engine. Fraud signals: young domain, mismatched/shell bank entity, untraceable provenance.

## 5. Stretch (only if MVP is green by ~2:30)
- **Fillmore** for autonomous PO outreach to the verified vendor (fallback: AWS SES).
- **Akash** deployment of the agent runtime (for the Akash prize) instead of/alongside AWS.
- **Scenario A burst beat**: agent spills overflow compute to a verified AWS/Akash provider to hold the SLA while procuring — makes Akash's role concrete on screen.
- Second fraud pattern (e.g., "changed bank details mid-transaction") to show the loop generalizing.
- Loop Jail framing: present the procurement agent as an untrusted tenant inside a spend + policy sandbox.

## 6. Out of scope (explicitly NOT building)
- Real supplier integrations or real money movement beyond Zero's demo wallet.
- Auth/multi-tenant/user accounts.
- Persistent database (in-memory or SQLite is fine).
- Polished production UI — dashboard only needs to read clearly on a projector.
- ML fraud model — verification is a rules/lookup check, not a trained classifier.

## 7. Architecture (summary)
```
Nexla (inventory + vendor feed) ──► Agent loop (Claude)
                                     │  1. buy verification ──► Zero (wallet + paid lookup)
                                     │  2. attempt payment  ──► Pomerium proxy ──► Payment/PO API
                                     │         (deny if vendor.verified != true → 403)
                                     │  3. send PO ──────────► Fillmore / SES
                                     ▼
                              Demo dashboard (live trace + $ counters)
```

## 8. Risks & mitigations
| Risk | Mitigation |
|---|---|
| Zero has no purchasable verification dataset at the event | Run our own mock "verified registry" service and pay it via Zero; disclose honestly in the demo. |
| Fillmore has no public API (waitlist product) | Keep it stretch-only; SES/SMTP fallback. Still 4 tools without it. |
| Pomerium setup eats time | Self-host Core in Docker; a single route + one policy is enough. Prove the 403 first, before agent logic. |
| Live demo flakiness | Everything planted and deterministic; record a backup screen capture by 3:45. |

## 9. Build order (dependency-first)
1. Mock payment/PO backend + inventory store.
2. Pomerium in Docker → prove a 403 on unverified payment.
3. Zero wallet + one real verification lookup.
4. Agent loop tying 1–3 together with self-correction.
5. Nexla feed as the trigger source.
6. Dashboard + live trace.
7. Fillmore/SES outreach (stretch).
8. **3:45 PM — freeze. Record video. Finalize Devpost + push public repo.**

## 10. Submission checklist
- [ ] 3-minute demo video
- [ ] Devpost entry complete (problem, tools used, architecture, team)
- [ ] Public GitHub repo pushed
- [ ] README with setup + architecture diagram
- [ ] Sponsor tools clearly credited (≥3)
