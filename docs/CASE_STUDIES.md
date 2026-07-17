# Vendor Fraud Interceptor — Business Case Studies

Concrete scenarios showing the same loop across industries: a stockout emergency creates time pressure → the agent must source a backup vendor fast → a fraudulent lookalike is waiting to exploit the rush → the agent verifies, gets denied at the payment gate, self-corrects, and completes safely. Each ends in a hard cash number.

Use one as the primary demo (Case 1) and keep the others as "this generalizes" talking points.

---

## Case 0 — AI company out of GPU compute (hero demo for this crowd)
**Business:** A fast-growing AI startup running a real-time inference product (voice agents, live video, or agentic coding). Their app just went viral — traffic 40x'd overnight.
**The emergency:** Their reserved GPU capacity is maxed. Inference latency is spiking, requests are timing out, and every minute of degraded service is churning paying users and burning their launch moment. They need **backup H100/H200 capacity online in minutes**, not the weeks a cloud reservation takes.
**The rush:** An on-call engineer (or their autonomous ops agent) needs spare GPU capacity *now* and will click "pay" on the first broker that says "available immediately." This is exactly the moment vetting dies.
**The fraud vector (this market is a live fraud swamp):** The GPU/compute gray market is flooded with scams during every shortage —
- **Deposit-and-vanish brokers:** "We have 200x H100 ready, wire a deposit" → capacity never materializes, money gone.
- **Oversold / phantom capacity:** resellers who sell the same cluster ten times or list capacity they don't control.
- **Typosquatted "cloud provider" lookalikes:** cloned websites impersonating a known GPU cloud, freshly registered domains, payment to a shell account.
- **Remarked/stolen hardware fronts** posing as legitimate providers.
The fraudulent option always looks the best: lowest $/GPU-hour and "instant availability."
**The loop:**
1. Nexla streams GPU utilization + latency; agent trips the "capacity < demand" threshold as timeouts climb.
2. Agent sources two backup compute providers: "H100-Cloud.io" (fraud — 11-day-old domain, oversold capacity, payment to a shell entity) and a verified provider — a legitimate GPU reseller **or Akash**, whose decentralized providers expose verifiable on-chain deployment + provider attestation.
3. Agent pays cents via Zero to verify both: Akash/verified provider → clean, provider attestation checks out; H100-Cloud.io → domain age + entity mismatch + no verifiable capacity proof → **red**.
4. Agent, chasing the cheaper $/GPU-hr, attempts to pay H100-Cloud.io first. **Pomerium denies the payment** (no `verified` claim on the provider). Agent reasons: "provider failed verification — blacklist, re-route to verified capacity."
5. Agent spins up the backup workload on the verified provider (Akash deployment), latency recovers, service is restored.
**Outcome:** **"$85,000 deposit-and-vanish scam blocked · $220,000 in churned revenue + reputation saved · inference back online in 6 minutes."**
**Why this is the hero for *this* hackathon:**
- **Self-referential:** the agent is autonomously sourcing the compute it runs on — loop engineering eating its own dog food.
- **Akash gets a real, earned role:** it's the *verified, attestable* backup capacity, not a bolted-on logo.
- **Every judge feels this pain:** the compute shortage is the defining infra story of the moment, and everyone in the room has hunted for GPUs.
- **Timely fraud:** GPU-broker scams are real and current; nobody will doubt the threat.

*Hardware variant (same story, physical goods):* a **data center operator** mid-build can't get transformers/switchgear or GPUs (multi-year lead times during the AI build-out). Emergency sourcing → broker offers "immediate stock" of scarce switchgear at a suspicious price → deposit-and-vanish or counterfeit-hardware fraud → agent verifies, Pomerium blocks, re-routes to a verified distributor. Outcome framed as "$X equipment-fraud blocked · project timeline protected."

---

## Case 0b — Enterprise with on-prem compute (regulated-buyer framing)
**Business:** A regulated enterprise that *must* run on-prem — a bank's risk/fraud modeling cluster, a hospital's imaging-AI cluster, a trading firm's low-latency inference, or a defense/gov workload. They can't just spill to public cloud for data-sovereignty, latency, or compliance reasons.
**The emergency (no elastic scaling — you're hardware-bound):** Either a **GPU node / storage array fails** in the cluster, or a **workload spikes** (month-end risk run, a health crisis surging imaging volume) and on-prem capacity is exhausted. Downtime breaches an SLA, stalls a compliance deadline, or halts revenue — and on-prem has no "add capacity" button.
**The two moves the agent makes at once — each with its own fraud surface:**
1. **Keep service alive now:** burst the overflow workload to a *verified* external provider (AWS / Akash) as a stopgap. *Fraud surface:* phantom/oversold capacity resellers, typosquatted cloud lookalikes.
2. **Fix it durably:** emergency-procure the replacement hardware (GPU, DIMM, PSU, NVMe, switchgear). *Fraud surface:* **counterfeit and remarked components** (downgraded or fake chips sold as new — a documented, rampant problem) and deposit-and-vanish brokers for scarce parts.
**The fraud vector:** During the shortage, a broker "TitanServer-Parts" offers the exact scarce GPU at a suspiciously good price with "immediate stock." Domain is 3 weeks old, the part's supply chain can't be traced to an authorized distributor, and payment routes to a personal/shell account — classic counterfeit-hardware or deposit-and-vanish front.
**The loop:**
1. Nexla streams on-prem node health + utilization; agent trips on a node failure or a capacity-exceeded threshold.
2. Agent sources both a replacement-part vendor and (optionally) a burst-capacity provider — a fraudulent broker vs. a verified authorized distributor / verified burst provider (AWS/Akash).
3. Agent pays cents via Zero to verify each: authorized distributor → clean, traceable to manufacturer; TitanServer-Parts → domain age + untraceable part provenance + shell banking → **red**.
4. Agent, chasing the cheaper/faster option, attempts to pay the broker first. **Pomerium denies the payment** (unverified vendor). Agent blacklists it, re-routes to the verified distributor, and fires the burst deployment to keep the SLA intact meanwhile.
5. Cluster restored with genuine hardware; no counterfeit part ever enters the fleet.
**Outcome:** **"$95,000 counterfeit-hardware order blocked · SLA maintained via verified burst · no compromised part in a regulated cluster."**
**Why on-prem *strengthens* the pitch:**
- **Deepest Pomerium fit:** on-prem enterprises (finance, healthcare, defense, gov) are the most zero-trust, audited-procurement buyers on earth — "secure your agentic runtime" is aimed squarely at them.
- **Counterfeit hardware in a regulated cluster isn't just cost — it's a compliance/security incident** (unknown firmware, supply-chain compromise). Raises the stakes beyond dollars.
- **Broadens the market:** the same product now covers cloud-native startups *and* regulated on-prem enterprises — bigger TAM story for judges.
- **Hybrid burst is a natural, non-forced role for AWS *and* Akash** as the verified stopgap capacity.

---

## Case 1 — Sock manufacturer out of dye (alternate demo)
**Business:** A mid-size sock manufacturer supplying three retail chains. Their signature navy-blue line is their bestseller.
**The emergency:** Their primary dye supplier logs a shipment delay. Inventory of navy dye will hit zero in 18 hours, halting the production line. Every idle hour costs ~$3,000 in penalties and missed orders.
**The rush:** A buyer needs a backup dye vendor *now* and will skip the usual 3-day vetting.
**The fraud vector:** A fraudulent supplier, "PacificDye Co." (typosquat of the legit "Pacific Dyes Inc."), appears in the sourcing feed with an aggressively low price and "immediate stock." Its domain is 2 weeks old and its listed bank account belongs to a shell entity in a different country.
**The loop:**
1. Nexla flags navy-dye inventory below the safety threshold.
2. Agent sources two backup dye vendors: PacificDye Co. (fraud) and Meridian Colorants (legit, verified 6-year registry history).
3. Agent pays cents via Zero to verify both: Meridian → clean; PacificDye → domain age 14 days, bank-entity mismatch, fraud score high → **red**.
4. Agent attempts the cheaper PacificDye order first. Pomerium denies the payment (no `verified` claim). Agent reasons: "vendor failed verification, blacklist and re-route."
5. Agent places the order with Meridian; Fillmore sends the PO.
**Outcome:** Line stays running. **"$18,000 fraud wire blocked · $54,000 production downtime avoided."**

---

## Case 2 — Coffee roaster out of a single-origin bean
**Business:** A specialty coffee roaster with a wholesale subscription program. Their Ethiopian single-origin is sold out for 4 weeks of committed orders.
**The emergency:** The importer's container is stuck in customs. Roaster will miss subscription shipments — churn risk on 1,200 subscribers.
**The fraud vector:** A "broker" emails an irresistible spot-lot offer with an **"updated bank details"** note and a freshly registered domain. Classic invoice-redirect fraud.
**The loop:** Nexla flags green-coffee inventory low → agent sources two spot-lot brokers → Zero verification shows the cheap broker's bank account doesn't match the registered business entity → Pomerium blocks the payment → agent routes to the verified importer's spot lot.
**Outcome:** **"$26,000 redirect-fraud payment blocked · 1,200 subscriptions retained."**

---

## Case 3 — Craft brewery out of aluminum cans
**Business:** A regional craft brewery; canned IPA is 70% of revenue.
**The emergency:** Aluminum can supplier hit by a plant outage. Canning line goes dark in 2 days.
**The fraud vector:** A "phantom vendor" lists huge can inventory at market price, takes deposits, and vanishes — no registry footprint, no verifiable address, payment to a personal account.
**The loop:** Nexla flags can inventory → agent sources two can suppliers → Zero verification: phantom vendor has no business-registry match and a personal (not business) bank account → Pomerium denies → agent re-sources to a verified converter.
**Outcome:** **"$40,000 deposit-and-vanish scam avoided · canning line uninterrupted."**

---

## Case 4 — EV parts supplier out of a wiring harness
**Business:** A Tier-2 automotive supplier feeding a just-in-time assembly plant. A missing wiring harness stops the whole line — penalties run $10k+ per hour.
**The emergency:** Primary harness vendor reports a QA hold; zero buffer stock.
**The fraud vector:** A typosquatted lookalike of a real Tier-1 supplier's domain, cloned website, spoofed contact — impersonation fraud targeting a high-value emergency order.
**The loop:** Nexla flags the JIT shortfall → agent sources two harness vendors → Zero verification: the lookalike's domain is 3 weeks old and its SSL/registry details don't match the impersonated company → Pomerium blocks → agent orders from the genuine, verified supplier.
**Outcome:** **"$120,000 impersonation order intercepted · assembly line kept running."**

---

## Case 5 — Cosmetics brand out of a preservative (regulated input)
**Business:** A skincare brand; a specific cosmetic-grade preservative is required for their bestselling serum and can't be substituted without reformulation.
**The emergency:** Regulatory recall at the primary chemical supplier. Need a compliant backup immediately.
**The fraud vector:** A cheap "grey-market" vendor claims cosmetic-grade certification it doesn't hold — fraudulent certification + shell-company banking.
**The loop:** Nexla flags preservative inventory → agent sources two chemical vendors → Zero verification: the cheap vendor's certification can't be matched to any registry record and its bank entity is a shell → Pomerium denies → agent buys from the verified, certified supplier.
**Outcome:** **"$15,000 uncertified-supplier payment blocked · reformulation + recall exposure avoided."**

---

## The through-line (say this to judges)
Every one of these is the same failure mode: **a real business under time pressure, a fraudster who shows up precisely because there's an emergency, and an autonomous buyer that would otherwise pay first and ask questions never.** The Vendor Fraud Interceptor makes verification a non-skippable step and makes "pay an unverified vendor" *physically impossible* at the policy layer — so speed and safety stop being a trade-off.
