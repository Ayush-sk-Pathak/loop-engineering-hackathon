# Three-Minute Demo

## Recording plan (compressed — 40-min emergency, 2026-07-17)

Per PM directive `bfe48689`: **one rehearsal, then record immediately** — timed ×2 collapsed
to **×1** (deviation logged in CURRENT_STATE). Keep, never cut: **Zero receipts + Pomerium
denial**. Cut for this recording: C6 renders (the "Illustrative incident rate" label stays
unchanged), StableEmail/Akash/StablePhone/demand-audit.

Fallbacks, honestly labeled (never fake a sponsor surface):
- **Nexla live is optional.** If no console operator appears, use the local monitor path and
  narrate it as the disclosed local monitor (`source: monitor`, sanctioned by PRD §14.3) — do
  not imply a live Nexla flow.
- **T+15 fixture fallback.** If the Zero service lock has not landed, record with `Fixture
  evidence` + whatever Pomerium proof exists, labeled as such, rather than miss the recording.

## Before Recording

Run this whole checklist before recording **and again before every denial rehearsal** — the
`403` denial is the prize-critical beat and the first thing to break on a repeat run.

1. **Bring the prize stack up green.**

   ```bash
   npm run doctor:prize
   npm run check
   ```

2. **Hard-reset the incident ledger — before EVERY denial rehearsal, not just the first run.**

   ```bash
   curl -X POST http://127.0.0.1:4000/api/demo/reset \
     -H "content-type: application/json" --data '{"hard": true}'
   ```

   This is the #1 rehearsal failure. The Learning Layer remembers completed runs: after any
   prior run the agent emits `recalled_history` and **skips the unattested-denial beat**, so
   the `403` moment will not play. Only `{"hard": true}` clears the incident ledger.

3. **Lock the scenario to Datacenter.** If Apparel was toggled while testing, switch the
   dashboard dropdown back to Datacenter (or `POST /api/demo/scenario {"id":"datacenter"}`),
   **then hard-reset again (step 2)** — switching scenario clears the decision trail but
   **not** the incident ledger, so the denial beat stays suppressed until you hard-reset. The
   consume button and copy are scenario-aware ("Consume dye stock" on Apparel), so a stale
   scenario shows on camera.

4. **Confirm the mode badges read `Live Zero` and `Pomerium`** in the top bar — not Fixture
   or Development. If they read otherwise the live path is not wired; disclose the local
   fallback, do not narrate it as live.

5. **Stage the proof tabs and record clean.** Keep the Pomerium authorize log and the
   received PO email open in separate tabs. Record a single continuous critical path where
   possible.

Use a **soft** reset (the dashboard Reset button) only when you deliberately *want* the
learning beat (`recalled_history` + proven-vendor chip) as a second run after the main arc —
never before the denial beat.

## Script

**0:00-0:15 - Hook**

“A datacenter incident has consumed its replacement memory. Continuim watches the spares
pool, buys the recovery part, and keeps authorization outside the model.”

**0:15-0:40 - Autonomous trigger**

Open **Client console**, inject a node fault, and take your hands off the controls. The
client detector waits for the telemetry breach, posts the incident to the control-plane
bridge, and the always-on monitor starts the procurement loop. Switch to **Operations** to
show the live denial, evidence decision, authorized PO, and inbound schedule. Do not say
the vendors were discovered dynamically; they are disclosed synthetic candidates.

**0:40-1:00 - Load-bearing denial**

The agent selects the cheaper candidate and submits its plan using the authenticated general
agent identity. Pomerium returns `403` because no vendor-scoped capability exists. Show the
request ID and `allow:false` authorize log. The origin has no matching request.

**1:00-1:40 - Paid observation**

The agent observes the denial, replans, and buys current vendor evidence through Zero. Show
the exact service names, price, wallet delta, and receipt IDs. The deterministic policy marks
the lookalike candidate **ineligible** from the combined contradictions; it does not proclaim
legal fraud from domain age alone.

**1:40-2:10 - Capability and recovery**

The second candidate passes. Show the attestation summary: vendor, payee, quote, amount cap,
evidence hash, expiry, and nonce. The agent retries with the matching Pomerium vendor service
identity and receives `201`.

**2:10-2:35 - Outcome**

Show the PO ID, StableEmail receipt/message ID if the adapter is live, and “20 units inbound
scheduled.” On-hand remains zero because a PO is not physical receipt.

**2:35-3:00 - Close**

Point to the two numbers: paid evidence cost and **$2,400 at-risk PO value prevented**.

“It noticed the shortage, recovered without another human action, and rejected a plan that
lacked authority. Zero makes fresh evidence economical. Pomerium makes the result
enforceable.”

## Optional Closer — Same Loop, Any Industry (only if under time)

Flip the dashboard scenario dropdown from **datacenter** to **apparel** (navy dye,
halted production line) and say one line: “Same engine, different industry — the item and
vendors are seed data, the loop and its authorization boundary never change.” Do not run a
second full loop on stage; the toggle plus one sentence is the whole beat.

## Claims To Avoid

- “We paid the supplier.” The demo issues a PO.
- “Inventory refilled.” It schedules inbound stock.
- “$2,400 fraud blocked.” Use at-risk PO value prevented.
- “Pomerium validates our custom signature.” It validates machine identity; the origin
  validates Continuim's signed attestation and object bindings.
- “Zero has a credit bureau or supplier registry.” It does not in this design.
- “Vendor sourcing is live.” The candidate set is synthetic and disclosed.
- “The illustrative downtime rate is a measured loss.” It is scenario data unless replaced
  with a cited operator-specific figure.

## Fallback Rules

- If a Zero service fails, substitute another service already settled and recorded in the
  service lock. Never switch silently to fixture evidence.
- If Pomerium lacks an authorize log, do not claim a live Pomerium denial.
- If Nexla or Akash is unavailable, disclose the local fallback rather than simulating the
  sponsor surface.
- StablePhone and StableEmail are optional if they threaten the core Zero + Pomerium proof.
