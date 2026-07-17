# Vendor Fraud Interceptor — Business Brief

**One-liner:** The trust layer that lets an AI agent spend real money on suppliers without getting scammed.

## The problem
Stockouts bleed revenue every second a popular item is unavailable — and the rushed emergency reorder is exactly when procurement fraud slips through: typosquatted vendor domains, "updated bank details" emails, and phantom suppliers that take a wholesale payment and vanish. Procurement and B2B payment fraud costs businesses tens of billions annually. As companies hand purchasing decisions to autonomous agents, the first question every buyer asks is: *what stops the agent from wiring $40k to a fake supplier?* Today, nothing does.

## The solution
An autonomous stockout-rescue agent with fraud defense wired into every step of its loop. When inventory drops, it sources backup vendors, **pays for verification before any money moves** (registry status, domain age, bank-to-entity match, fraud score), and is **physically incapable of paying an unverified vendor** — the payment API is gated by policy, not by the agent's own judgment. Vendors that fail verification are blacklisted and the agent re-sources autonomously. Plan → act → observe → self-correct, with fraud as the correction signal.

## Why now
Agents could not hold or spend money until wallet-native infrastructure (Zero) arrived. The moment they can, autonomous spending becomes a real attack surface. This product is the guardrail that makes agentic procurement deployable.

## Market & value
- **Who pays:** mid-market and enterprise e-commerce, marketplaces, and distributors running high-SKU catalogs with automated replenishment.
- **Value metric:** dollars of fraud blocked + revenue recovered from faster stockout resolution. Both are cash numbers a CFO understands instantly.
- **Wedge:** ships as a trust/verification layer on top of existing procurement and agent stacks — not a rip-and-replace.

## Business model (directional)
- Per-verified-transaction fee (a few cents of margin on each Zero verification lookup), or
- SaaS seat + usage tier for the agent runtime and policy console.

## Why we win the room
Every team at this hackathon is giving an agent a wallet today. **We built the reason you can trust it with one.** Clear cash story, natural use of 4+ sponsor tools, and a self-correction loop the judges can see on screen.
