# Three-Minute Demo

## Before Recording

```bash
npm run doctor:prize
npm run check
```

**Hard-reset the incident ledger first.** The Learning Layer remembers completed runs:
after any prior run, the agent emits `recalled_history` and **skips the unattested-denial
beat** — the prize-critical 403 moment will not play. Before the recording (and before
each full rehearsal of the denial beat), clear the ledger:

```bash
curl -X POST http://127.0.0.1:4000/api/demo/reset \
  -H "content-type: application/json" --data '{"hard": true}'
```

A plain reset (dashboard Reset button) is **soft** — it keeps the ledger on purpose. Use
soft reset when you *want* to show the learning beat (`recalled_history` + proven-vendor
chip) as a second run after the main arc.

Confirm the dashboard says **Live Zero** and **Pomerium**, not Fixture or Development. Keep
the Pomerium authorize log and the received PO email ready in separate tabs. Record a single
continuous critical path where possible.

## Script

**0:00-0:15 - Hook**

“A datacenter incident has consumed its replacement memory. StockShield watches the spares
pool, buys the recovery part, and keeps authorization outside the model.”

**0:15-0:40 - Autonomous trigger**

Click **Simulate node failure** until the final safe spare is consumed, then take your hands
off the controls. Show the monitor's last-check time change and the `stockout_risk` event
appear without a run action. If the live Nexla path is ready, show its event ID; otherwise
call this the disclosed local monitor. Do not say the vendors were discovered dynamically.
They are disclosed synthetic candidates.

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
  validates StockShield's signed attestation and object bindings.
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
