<!-- IMMUTABLE VISION DOCUMENT — user-authored 2026-07-17.
  This file is Loop Engineering Hackathon's north star. It is written in the user's own words
  and is changed ONLY with the user's explicit line-by-line approval — never by an
  agent, never as work ships, only when the product INTENT itself changes.
  (Enforcement: filesystem read-only 444 + the git pre-commit hook in
  scripts/githooks/ — see CLAUDE.md §Enforcement lives below the harness.) -->

# Vision

Every minute a bestseller sits at zero stock is an outage that bleeds revenue and hands customers to a competitor — so the fix has to be fast, and it has to be autonomous, because a human in the loop is exactly the delay you can't afford. But speed is dangerous: the rushed reorder is precisely how a buyer wires $40k to a fake supplier. Continuim resolves that tension. The moment stock hits zero, it detects the outage from live inventory data and immediately sources backup distributors — but before any money moves, it pays cents to verify each one: domain age, bank-account-to-entity match, business-registry status, fraud score. Vendors that fail are blacklisted and the agent re-sources on its own; among those that pass, it picks the best price and cuts a purchase order. The payment rail is gated by a hard access proxy, so even if the agent's judgment is wrong, it physically cannot pay a vendor that hasn't cleared verification. Two numbers move on every rescue: the downtime it closed — minutes of stockout saved, revenue recovered — and the fraud it blocked. It's the reason you can finally let an agent restock your shelves at machine speed and trust it with the wallet.

<!-- Approved extensions are appended below as dated sections — never interleaved
     into the text above. Each extension also requires explicit line-by-line user
     approval before it is written.

## Extension — <title> (added YYYY-MM-DD)
-->
