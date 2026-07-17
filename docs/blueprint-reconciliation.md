# Blueprint reconciliation — "get both"

> Records how the external tool-blueprint (AWS Bedrock brain, x402/testnet, `--demo-mode`,
> Python stack) reconciles with the committed StockShield architecture. Decision **0014**.
> The rule: **adopt the blueprint's additive wins through the ports the PRD already defines;
> reject the parts that reverse a load-bearing decision or discard the green TS slice.**
> The deterministic core (`0007`, `0008`) and the honest-mode discipline (`0010`) are unchanged.

## Already resolved by the team (no action)

- **Rational 403 (`0009`).** The denial is a pre-verification authorization failure on the
  general-agent identity, not a forced purchase of a known-bad vendor. Keep.
- **Mode/artifact discipline (`0010`).** No silent fixture→live swap; every sponsor claim needs
  an external artifact. This *is* the honest half of the blueprint's `--demo-mode`.
- **Honest counter + refill.** "At-risk PO value prevented" (not "fraud dollars blocked");
  "inbound scheduled" (not "inventory refilled"). Keep (PRD Non-Claims).
- **Payee-mismatch beat.** The blueprint's "bank-entity mismatch" survives honestly as
  `payee_identity_match` (a hard failure in the evidence policy) — without claiming bank
  verification. Keep.

## ADOPT (additive — behind existing ports)

| # | What | Why it's a win | Owner | Done when |
|---|---|---|---|---|
| A | **Back the LLM planner/explainer port with AWS Bedrock** — `@aws-sdk/client-bedrock-runtime` Converse, model id `us.anthropic.claude-haiku-4-5-*` (the cross-region **inference-profile** id — the bare `anthropic.*` id throws "on-demand throughput isn't supported"). Anthropic-key path is the fallback. **LLM explains, never adjudicates (`0008` holds).** | Adds the **Amazon/AWS** sponsor surface + credits; gives the demo a visible "Claude reasons about the evidence" moment — with the deterministic policy still the authority. | 1 | Bedrock Converse call returns reasoning shown on the dashboard next to the policy verdict; if they disagree, policy wins and the disagreement is logged. Stays in TypeScript. |
| B | **Labeled real-artifact replay mode.** Capture *real* receipts / tx hashes / Pomerium authorize logs / Bedrock verdicts during a green run, then replay them for the recording — **clearly badged "replay" in the dashboard.** | Flake-proof 3-minute demo without venue wifi risk; honest because it's disclosed and the artifacts are genuine (consistent with `0010`). | 4 | Dashboard shows a `live | replay` badge; replay plays back only captured real artifacts, never invents them; `doctor:prize` still distinguishes them. |
| C | **Name the one real paid Zero call as the authentic anchor** — a real **domain-age / WHOIS** paid call that genuinely catches the ~2-week typosquat. Compose the other evidence classes from **real Zero catalog tools** (scrape=web presence, enrichment=company identity, serp=news), each with a receipt. | Makes "the agent pays cents before money moves" concretely true on one unimpeachable call, and frames the composite honestly. | 2 | The typosquat is caught by a live domain-age call with a real receipt in the trace. |
| D | **StableEmail primary, with a disclosed non-Zero email fallback.** Behind one email adapter: prize mode = StableEmail (Zero, message-ID proof); fallback = generic API/SMTP **not claimed as a Zero tool.** | Keeps the Zero surface for the PO send while guaranteeing a real, inspectable send if StableEmail stalls. | 3 | PO send works in prize mode via StableEmail with a message ID; fallback path is labeled as non-sponsor. |

## REJECT (reverses a decision or discards working code)

| What the blueprint proposed | Why we reject it |
|---|---|
| **Rewrite to Python (Flask/Streamlit/boto3)** | The green vertical slice is already TypeScript (tests passing). Every blueprint idea has a TS equivalent (`@aws-sdk`, JS `x402-fetch`, the Next.js dashboard). A rewrite discards working code with hours left. |
| **LLM emits the `PASS \| BLACKLIST` verdict (the authorization decision)** | Reverses `0008`. The deterministic `vendor-risk-v1` policy adjudicates; the LLM only explains. We keep the LLM's *reasoning on screen* (item A), which is what the blueprint actually wanted. |
| **Build our own x402-priced KYB endpoint** | `0003` rejected standing up a verification service we call "through Zero." Compose real Zero catalog tools instead (item C). Testnet + a self-hosted facilitator is at most a labeled last-resort for the single paid call, never the KYB source. |
| **"$X fraud blocked" / "inventory refills" wording** | Violates committed invariants: "at-risk PO value prevented", "inbound scheduled, not refilled". Keep the honest labels. |

## Sequencing

Items **A–D are P2** ("after core proof is green") — they must not jump ahead of the P1
sponsor proof (live Zero settlements + live Pomerium route/authorize logs). Build order stays:
**P1 live Zero → Pomerium vertical slice**, then **C** (fold the real paid-call anchor into that
Zero work), then **A/B/D**. See `docs/ROADMAP.md`.
