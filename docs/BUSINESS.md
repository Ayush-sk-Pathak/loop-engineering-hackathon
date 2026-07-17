# Continuim Business Brief

**One-liner:** Autonomous recovery for critical spares, with procurement authority enforced
outside the agent.

## Problem

Critical infrastructure cannot wait for a manual procurement workflow when its spares pool
is depleted. The same urgency also makes vendor impersonation and payee substitution harder
to investigate. Delegating the workflow to an agent solves the speed problem but creates an
authorization problem: untrusted vendor data and model reasoning must not become final
spending authority.

## Product

Continuim monitors inventory, starts recovery at a threshold, and lets an agent compare
candidates and acquire current evidence. A deterministic policy can issue a narrowly scoped,
expiring capability. Pomerium authenticates the vendor-scoped machine identity at the route;
the private origin independently verifies the signed capability and exact PO bindings.

The result is faster decision-making with a separate control over whether a PO can be
committed. The current demo issues a PO and schedules inbound stock. It does not transfer
supplier funds or claim delivery.

## Buyer And Value

- Infrastructure and operations teams managing expensive, scarce, or regulated spares.
- Procurement and security teams that need machine-actionable policy plus an audit trail.
- Value measured as recovery time, governed PO value, evidence cost, and prevented
  unauthorized PO exposure.

## Wedge

Start as a control plane in front of an existing procurement API. Inventory and sourcing
systems remain replaceable adapters. The defensible part is the evidence-to-capability chain,
the protected route, and the decision record.

## Commercial Direction

- Usage fee per governed procurement attempt or evidence bundle.
- Platform tier for policies, audit retention, integrations, and multi-team controls.

These are directional business hypotheses, not validated pricing.

## Why The Demo Is Credible

The stage shows both failure and success through the same API: an authenticated but
unauthorized plan is denied, the agent changes its plan, and a request with the correct
identity and signed object binding succeeds. Live claims require the receipts and logs listed
in `docs/DEMO.md`.
